import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sendEmail } from '@/lib/graph/email';

// GET: List queries for a cycle
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data, error } = await supabase
      .from('queries')
      .select('*')
      .eq('cycle_id', params.id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return NextResponse.json({ queries: data });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 });
  }
}

// POST: Raise a new query (Khalid)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { query_text, link_to_form } = await request.json();
    if (!query_text?.trim()) return NextResponse.json({ error: 'Query text required' }, { status: 400 });

    // Get cycle for subject tag
    const { data: cycle, error: cycleErr } = await supabase
      .from('payroll_cycles').select('month,year,status').eq('id', params.id).single();
    if (cycleErr) throw cycleErr;

    // Determine who is raising the query
    const { data: roleData } = await supabase.from('user_roles').select('role').eq('user_id', user.id).single();
    const raisedBy: 'pag' | 'rodliffe' = roleData?.role === 'accountant' ? 'rodliffe' : 'pag';

    // Insert query
    const { data: newQuery, error: insertErr } = await supabase
      .from('queries')
      .insert({
        cycle_id: params.id,
        raised_by: raisedBy,
        query_text: query_text.trim(),
        link_to_form: link_to_form || null,
        status: 'open',
      })
      .select()
      .single();
    if (insertErr) throw insertErr;

    // Log to quality_log
    await supabase.from('quality_log').insert({
      cycle_id: params.id,
      raised_by: raisedBy,
      category: 'query',
      description: 'Query raised: ' + query_text.trim().substring(0, 150),
    });

    const monthYear = cycle.year + '-' + String(cycle.month).padStart(2, '0');

    if (raisedBy === 'rodliffe') {
      // E3: Query Alert to PAG
      await sendEmail({
        to: 'payroll@premieradvisory.co.uk',
        subject: '[PAG-Payroll-' + monthYear + '] Query from Rodliffe',
        html: [
          '<div style="font-family:Arial,sans-serif;max-width:600px">',
          '<div style="background:#1F3864;padding:20px;border-radius:8px 8px 0 0">',
          '<h1 style="color:white;margin:0;font-size:20px">Query Raised by Rodliffe</h1>',
          '</div>',
          '<div style="padding:24px;background:white;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px">',
          '<p>Khalid has raised a query on the ' + cycle.year + '-' + String(cycle.month).padStart(2,'0') + ' payroll cycle:</p>',
          '<div style="background:#fef3c7;border-left:4px solid #f59e0b;padding:12px 16px;margin:16px 0">',
          '<p style="margin:0;white-space:pre-wrap">' + query_text + '</p>',
          '</div>',
          link_to_form ? '<p><a href="' + link_to_form + '" style="color:#2E75B6">View related form</a></p>' : '',
          '<p>Please log in to the PAG Payroll portal to respond.</p>',
          '<p style="color:#6b7280;font-size:12px">Ref: [PAG-Payroll-' + monthYear + ']</p>',
          '</div></div>',
        ].join(''),
      });
    }

    return NextResponse.json({ success: true, query: newQuery });
  } catch (error: unknown) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Server error' }, { status: 500 });
  }
}
