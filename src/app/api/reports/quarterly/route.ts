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

    const periodLabel = MONTHS[(cycles[cycles.length-1].month as number)-1] + ' ' + cycles[cycles.length-1].year
      + ' to ' + MONTHS[(cycles[0].month as number)-1] + ' ' + cycles[0].year;

    await sendQuarterlyReportEmail({
      cycles,
      periodLabel,
      stats: { lateInputs, dataErrors, queryCount, rejections, totalVariances, thresholdFlags },
    });

    return NextResponse.json({
      success: true,
      message: 'Quarterly report generated and emailed',
      period: periodLabel,
      stats: { cycles: cycles.length, lateInputs, dataErrors, queryCount, rejections, totalVariances, thresholdFlags },
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
