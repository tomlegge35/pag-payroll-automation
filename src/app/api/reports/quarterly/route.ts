import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/graph/email';

export async function POST(_request: NextRequest) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch last 3 completed cycles
    const { data: cycles, error: cycleErr } = await supabase
      .from('payroll_cycles')
      .select('*')
      .in('status', ['closed', 'paid'])
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(3);
    if (cycleErr) throw cycleErr;

    if (!cycles || cycles.length === 0) {
      return NextResponse.json({ error: 'No completed cycles found' }, { status: 400 });
    }

    const cycleIds = cycles.map((c: { id: string }) => c.id);

    // Fetch quality logs for these cycles
    const { data: qualityLogs } = await supabase
      .from('quality_log')
      .select('*')
      .in('cycle_id', cycleIds);

    // Fetch variance summaries
    const { data: variances } = await supabase
      .from('variance_analysis')
      .select('cycle_id, flag, status')
      .in('cycle_id', cycleIds);

    // Fetch approval actions
    const { data: approvals } = await supabase
      .from('approval_actions')
      .select('cycle_id, action, actioned_at')
      .in('cycle_id', cycleIds);

    // Build summary stats
    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const lateInputs = (qualityLogs||[]).filter((q: { category: string }) => q.category === 'late_input').length;
    const dataErrors = (qualityLogs||[]).filter((q: { category: string }) => q.category === 'data_error').length;
    const queryCount = (qualityLogs||[]).filter((q: { category: string }) => q.category === 'query').length;
    const rejections = (approvals||[]).filter((a: { action: string }) => a.action === 'reject').length;
    const totalVariances = (variances||[]).length;
    const thresholdFlags = (variances||[]).filter((v: { flag: string }) => v.flag === 'threshold').length;

    const periodLabel = cycles.length > 0
      ? MONTHS[(cycles[cycles.length-1].month as number)-1] + ' ' + cycles[cycles.length-1].year + ' – ' + MONTHS[(cycles[0].month as number)-1] + ' ' + cycles[0].year
      : 'No period';

    const cycleRows = cycles.map((c: { month: number; year: number; initiated_at: string | null; approved_at: string | null; paid_confirmed_at: string | null }) => {
      const initDate = c.initiated_at ? new Date(c.initiated_at).toLocaleDateString('en-GB') : '-';
      const approvedDate = c.approved_at ? new Date(c.approved_at).toLocaleDateString('en-GB') : '-';
      const paidDate = c.paid_confirmed_at ? new Date(c.paid_confirmed_at).toLocaleDateString('en-GB') : '-';
      return '<tr><td style="padding:8px 12px">' + MONTHS[c.month-1] + ' ' + c.year + '</td><td style="padding:8px 12px">' + initDate + '</td><td style="padding:8px 12px">' + approvedDate + '</td><td style="padding:8px 12px">' + paidDate + '</td></tr>';
    }).join('');

    const reportHtml = [
      '<div style="font-family:Arial,sans-serif;max-width:700px">',
      '<div style="background:#1F3864;padding:24px;border-radius:8px 8px 0 0">',
      '<h1 style="color:white;margin:0;font-size:22px">PAG Payroll — Quarterly Quality Report</h1>',
      '<p style="color:#93c5fd;margin:8px 0 0;font-size:14px">' + periodLabel + '</p>',
      '</div>',
      '<div style="padding:24px;background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">',
      '<h2 style="color:#1F3864;font-size:16px">Executive Summary</h2>',
      '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">',
      '<tr style="background:#f9fafb">',
      '<td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:bold">Metric</td>',
      '<td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:bold">Value</td>',
      '</tr>',
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Cycles Completed</td><td style="padding:8px 12px;border:1px solid #e5e7eb">' + cycles.length + '</td></tr>',
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Total Variances Flagged</td><td style="padding:8px 12px;border:1px solid #e5e7eb">' + totalVariances + '</td></tr>',
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">&gt;5% Threshold Flags</td><td style="padding:8px 12px;border:1px solid #e5e7eb">' + thresholdFlags + '</td></tr>',
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Late Input Events</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:' + (lateInputs > 0 ? '#f97316' : '#16a34a') + '">' + lateInputs + '</td></tr>',
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Data Errors</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:' + (dataErrors > 0 ? '#dc2626' : '#16a34a') + '">' + dataErrors + '</td></tr>',
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Queries Raised</td><td style="padding:8px 12px;border:1px solid #e5e7eb">' + queryCount + '</td></tr>',
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Payroll Rejections</td><td style="padding:8px 12px;border:1px solid #e5e7eb;color:' + (rejections > 0 ? '#dc2626' : '#16a34a') + '">' + rejections + '</td></tr>',
      '</table>',
      '<h2 style="color:#1F3864;font-size:16px">Cycle Timeline</h2>',
      '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">',
      '<tr style="background:#1F3864;color:white">',
      '<td style="padding:10px 12px">Period</td>',
      '<td style="padding:10px 12px">Initiated</td>',
      '<td style="padding:10px 12px">Approved</td>',
      '<td style="padding:10px 12px">Paid</td>',
      '</tr>',
      cycleRows,
      '</table>',
      '<p style="color:#6b7280;font-size:12px">This report is generated automatically by the PAG Payroll Automation system. Please keep this report for your records in accordance with HMRC data retention requirements (6 years).</p>',
      '</div></div>',
    ].join('');

    const monthYear = new Date().toISOString().substring(0, 7);

    // Send E11: Quarterly Report
    await sendEmail({
      to: 'payroll@premieradvisory.co.uk',
      cc: 'k.subhan@rodliffeaccounting.com',
      subject: '[PAG-Payroll-' + monthYear + '] Quarterly Quality Report — ' + periodLabel,
      html: reportHtml,
    });

    return NextResponse.json({
      success: true,
      message: 'Quarterly report generated and emailed',
      period: periodLabel,
      stats: { cycles: cycles.length, lateInputs, dataErrors, queryCount, rejections, totalVariances, thresholdFlags },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
