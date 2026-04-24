import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/graph/email';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; queryId: string } }
) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { response_text } = await request.json();
    if (!response_text?.trim()) {
      return NextResponse.json({ error: 'Response text is required' }, { status: 400 });
    }

    // Fetch the query
    const { data: query, error: queryErr } = await supabase
      .from('queries')
      .select('*')
      .eq('id', params.queryId)
      .eq('cycle_id', params.id)
      .single();
    if (queryErr || !query) {
      return NextResponse.json({ error: 'Query not found' }, { status: 404 });
    }
    if (query.status === 'resolved') {
      return NextResponse.json({ error: 'Query already resolved' }, { status: 400 });
    }

    // Fetch cycle
    const { data: cycle, error: cycleErr } = await supabase
      .from('payroll_cycles')
      .select('month, year')
      .eq('id', params.id)
      .single();
    if (cycleErr) throw cycleErr;

    // Update query with response
    const { error: updateErr } = await supabase
      .from('queries')
      .update({
        response_text: response_text.trim(),
        status: 'resolved',
        resolved_at: new Date().toISOString(),
      })
      .eq('id', params.queryId);
    if (updateErr) throw updateErr;

    // Log to quality_log
    await supabase.from('quality_log').insert({
      cycle_id: params.id,
      raised_by: 'pag',
      category: 'query',
      description: 'Query resolved: ' + query.query_text.substring(0, 100),
      resolution: response_text.substring(0, 200),
    });

    // Send E4: Query Response to Khalid
    const monthYear = cycle.year + '-' + String(cycle.month).padStart(2, '0');
    await sendEmail({
      to: 'k.subhan@rodliffeaccounting.com',
      subject: '[PAG-Payroll-' + monthYear + '] Query Response',
      html: [
        '<div style="font-family:Arial,sans-serif;max-width:600px">',
        '<div style="background:#1F3864;padding:20px;border-radius:8px 8px 0 0">',
        '<h1 style="color:white;margin:0;font-size:20px">PAG Payroll — Query Response</h1>',
        '</div>',
        '<div style="padding:24px;background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">',
        '<p>Hi Khalid,</p>',
        '<p>PAG has responded to the query raised on this payroll cycle:</p>',
        '<div style="background:#f9fafb;border-left:4px solid #1F3864;padding:12px 16px;margin:16px 0">',
        '<p style="font-weight:bold;color:#1F3864;margin:0 0 8px">Original Query:</p>',
        '<p style="margin:0;white-space:pre-wrap">' + query.query_text + '</p>',
        '</div>',
        '<div style="background:#f0fdf4;border-left:4px solid #16a34a;padding:12px 16px;margin:16px 0">',
        '<p style="font-weight:bold;color:#16a34a;margin:0 0 8px">PAG Response:</p>',
        '<p style="margin:0;white-space:pre-wrap">' + response_text + '</p>',
        '</div>',
        '<p>The query has been marked as resolved. You may now proceed with payroll processing.</p>',
        '<p style="color:#6b7280;font-size:12px">Cycle Reference: [PAG-Payroll-' + monthYear + ']</p>',
        '</div></div>',
      ].join(''),
    });

    return NextResponse.json({ success: true, message: 'Reply sent and query resolved' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
