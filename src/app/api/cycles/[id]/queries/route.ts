import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendQueryAlertToPAG } from '@/lib/graph/email';

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { data, error } = await supabase
      .from('queries').select('*').eq('cycle_id', params.id).order('created_at', { ascending: true });
    if (error) throw error;
    return NextResponse.json({ queries: data });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { query_text, link_to_form } = await request.json();
    if (!query_text?.trim()) return NextResponse.json({ error: 'Query text required' }, { status: 400 });

    const { data: cycle, error: cycleErr } = await supabase
      .from('payroll_cycles').select('month,year,status').eq('id', params.id).single();
    if (cycleErr) throw cycleErr;

    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single();
    const raisedBy: 'pag' | 'rodliffe' = roleData?.role === 'accountant' ? 'rodliffe' : 'pag';

    const { data: newQuery, error: insertErr } = await supabase
      .from('queries')
      .insert({ cycle_id: params.id, raised_by: raisedBy, query_text: query_text.trim(), link_to_form: link_to_form || null, status: 'open' })
      .select().single();
    if (insertErr) throw insertErr;

    await supabase.from('quality_log').insert({
      cycle_id: params.id, raised_by: raisedBy, category: 'query',
      description: 'Query raised: ' + query_text.trim().substring(0, 150),
    });

    if (raisedBy === 'rodliffe') {
      await sendQueryAlertToPAG({ cycleId: params.id, month: cycle.month, year: cycle.year, queryText: query_text });
    }

    return NextResponse.json({ success: true, query: newQuery });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 });
  }
}
