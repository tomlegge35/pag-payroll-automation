import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendQueryResponseToKhalid } from '@/lib/graph/email';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; queryId: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { response_text } = await request.json();
    if (!response_text?.trim()) return NextResponse.json({ error: 'Response text is required' }, { status: 400 });

    const { data: query, error: queryErr } = await supabase
      .from('queries').select('*').eq('id', params.queryId).eq('cycle_id', params.id).single();
    if (queryErr || !query) return NextResponse.json({ error: 'Query not found' }, { status: 404 });
    if (query.status === 'resolved') return NextResponse.json({ error: 'Query already resolved' }, { status: 400 });

    const { data: cycle, error: cycleErr } = await supabase
      .from('payroll_cycles').select('month, year').eq('id', params.id).single();
    if (cycleErr) throw cycleErr;

    const { error: updateErr } = await supabase.from('queries').update({
      response_text: response_text.trim(), status: 'resolved', resolved_at: new Date().toISOString(),
    }).eq('id', params.queryId);
    if (updateErr) throw updateErr;

    await supabase.from('quality_log').insert({
      cycle_id: params.id, raised_by: 'pag', category: 'query',
      description: 'Query resolved: ' + query.query_text.substring(0, 100),
      resolution: response_text.substring(0, 200),
    });

    await sendQueryResponseToKhalid({
      cycleId: params.id,
      month: cycle.month,
      year: cycle.year,
      queryText: query.query_text,
      responseText: response_text,
    });

    return NextResponse.json({ success: true, message: 'Reply sent and query resolved' });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 });
  }
}
