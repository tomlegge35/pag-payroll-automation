import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendQuarterlyReportEmail } from '@/lib/graph/email';

export async function POST(_request: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: cycles, error: cycleErr } = await supabase
      .from('payroll_cycles').select('*')
      .in('status', ['closed', 'paid'])
      .order('year', { ascending: false }).order('month', { ascending: false }).limit(3);
    if (cycleErr) throw cycleErr;
    if (!cycles || cycles.length === 0) return NextResponse.json({ error: 'No completed cycles found' }, { status: 400 });

    const cycleIds = cycles.map((c: { id: string }) => c.id);
    const [{ data: qualityLogs }, { data: variances }, { data: approvals }] = await Promise.all([
      supabase.from('quality_log').select('*').in('cycle_id', cycleIds),
      supabase.from('variance_analysis').select('cycle_id, flag, status').in('cycle_id', cycleIds),
      supabase.from('approval_actions').select('cycle_id, action, actioned_at').in('cycle_id', cycleIds),
    ]);

    const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    const lateInputs = (qualityLogs||[]).filter((q: { category: string }) => q.category === 'late_input').length;
    const dataErrors = (qualityLogs||[]).filter((q: { category: string }) => q.category === 'data_error').length;
    const queryCount = (qualityLogs||[]).filter((q: { category: string }) => q.category === 'query').length;
    const rejections = (approvals||[]).filter((a: { action: string }) => a.action === 'reject').length;
    const totalVariances = (variances||[]).length;
    const thresholdFlags = (variances||[]).filter((v: { flag: string }) => v.flag === 'threshold').length;

    const firstCycle = cycles[cycles.length - 1];
    const lastCycle = cycles[0];
    const periodLabel = MONTHS[(firstCycle.month as number) - 1] + ' ' + firstCycle.year + ' to ' + MONTHS[(lastCycle.month as number) - 1] + ' ' + lastCycle.year;
    const quarter = Math.ceil((lastCycle.month as number) / 3);
    const year = lastCycle.year as number;

    const cycleRows = cycles.map((c: { month: number; year: number; initiated_at: string | null; approved_at: string | null; paid_confirmed_at: string | null }) =>
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">' + MONTHS[c.month - 1] + ' ' + c.year + '</td>' +
      '<td style="padding:8px 12px;border:1px solid #e5e7eb">' + (c.initiated_at ? new Date(c.initiated_at).toLocaleDateString('en-GB') : '-') + '</td>' +
      '<td style="padding:8px 12px;border:1px solid #e5e7eb">' + (c.approved_at ? new Date(c.approved_at).toLocaleDateString('en-GB') : '-') + '</td>' +
      '<td style="padding:8px 12px;border:1px solid #e5e7eb">' + (c.paid_confirmed_at ? new Date(c.paid_confirmed_at).toLocaleDateString('en-GB') : '-') + '</td></tr>'
    ).join('');

    const reportHtml = '<div style="font-family:Arial,sans-serif;max-width:700px">' +
      '<div style="background:#1F3864;padding:24px;border-radius:8px 8px 0 0">' +
      '<h1 style="color:white;margin:0;font-size:22px">PAG Payroll — Q' + quarter + ' ' + year + ' Quality Report</h1>' +
      '<p style="color:#93c5fd;margin:8px 0 0;font-size:14px">' + periodLabel + '</p></div>' +
      '<div style="padding:24px;background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">' +
      '<h2 style="color:#1F3864">Summary</h2>' +
      '<table style="width:100%;border-collapse:collapse;margin-bottom:20px">' +
      '<tr style="background:#f9fafb"><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:bold">Metric</td><td style="padding:10px 12px;border:1px solid #e5e7eb;font-weight:bold">Value</td></tr>' +
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Cycles Completed</td><td style="padding:8px 12px;border:1px solid #e5e7eb">' + cycles.length + '</td></tr>' +
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Total Variances</td><td style="padding:8px 12px;border:1px solid #e5e7eb">' + totalVariances + '</td></tr>' +
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Threshold Flags</td><td style="padding:8px 12px;border:1px solid #e5e7eb">' + thresholdFlags + '</td></tr>' +
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Late Inputs</td><td style="padding:8px 12px;border:1px solid #e5e7eb">' + lateInputs + '</td></tr>' +
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Data Errors</td><td style="padding:8px 12px;border:1px solid #e5e7eb">' + dataErrors + '</td></tr>' +
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Queries</td><td style="padding:8px 12px;border:1px solid #e5e7eb">' + queryCount + '</td></tr>' +
      '<tr><td style="padding:8px 12px;border:1px solid #e5e7eb">Rejections</td><td style="padding:8px 12px;border:1px solid #e5e7eb">' + rejections + '</td></tr>' +
      '</table>' +
      '<h2 style="color:#1F3864">Cycle Timeline</h2>' +
      '<table style="width:100%;border-collapse:collapse">' +
      '<tr style="background:#1F3864;color:white"><td style="padding:10px 12px">Period</td><td style="padding:10px 12px">Initiated</td><td style="padding:10px 12px">Approved</td><td style="padding:10px 12px">Paid</td></tr>' +
      cycleRows + '</table></div></div>';

    await sendQuarterlyReportEmail(quarter, year, reportHtml);

    return NextResponse.json({ success: true, message: 'Quarterly report emailed', period: periodLabel,
      stats: { cycles: cycles.length, lateInputs, dataErrors, queryCount, rejections, totalVariances, thresholdFlags } });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
