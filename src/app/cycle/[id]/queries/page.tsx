'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface Query {
  id: string;
  cycle_id: string;
  raised_by: 'pag' | 'rodliffe';
  query_text: string;
  response_text: string | null;
  status: 'open' | 'resolved';
  link_to_form: string | null;
  created_at: string;
  resolved_at: string | null;
}

interface PayrollCycle {
  id: string;
  month: number;
  year: number;
  status: string;
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CycleQueriesPage() {
  const params = useParams();
  const router = useRouter();
  const cycleId = params.id as string;
  const supabase = createClient();

  const [cycle, setCycle] = useState<PayrollCycle | null>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [role, setRole] = useState<string>('pag_operator');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newQuery, setNewQuery] = useState('');
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [cycleId]);

  async function loadData() {
    try {
      setLoading(true);
      const { data: { user: u } } = await supabase.auth.getUser();
      if (!u) { router.push('/auth/login'); return; }
      setUser(u);

      const { data: profile } = await supabase
        .from('user_profiles').select('role').eq('user_id', u.id).maybeSingle();
      setRole(profile?.role || 'pag_operator');

      const { data: c } = await supabase
        .from('payroll_cycles').select('id,month,year,status').eq('id', cycleId).maybeSingle();
      if (!c) { router.push('/dashboard'); return; }
      setCycle(c);

      const { data: q, error: qe } = await supabase
        .from('payroll_queries').select('*').eq('cycle_id', cycleId).order('created_at', { ascending: true });
      if (qe) throw qe;
      setQueries(q || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoading(false); }
  }

  async function handleReply(queryId: string) {
    const text = replyText[queryId]?.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await supabase.from('payroll_queries').update({
        response_text: text,
        status: 'resolved',
        resolved_at: new Date().toISOString()
      }).eq('id', queryId);
      setReplyText(prev => ({ ...prev, [queryId]: '' }));
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reply');
    } finally { setSubmitting(false); }
  }

  async function handleRaiseQuery() {
    const text = newQuery.trim();
    if (!text) return;
    setSubmitting(true);
    try {
      await supabase.from('payroll_queries').insert({
        cycle_id: cycleId,
        raised_by: 'pag',
        query_text: text,
        status: 'open'
      });
      setNewQuery('');
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to raise query');
    } finally { setSubmitting(false); }
  }

  if (loading) return (
    <DashboardLayout user={user} role={role}>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-navy" />
      </div>
    </DashboardLayout>
  );

  if (error) return (
    <DashboardLayout user={user} role={role}>
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">{error}</div>
    </DashboardLayout>
  );

  const cycleLabel = cycle ? (MONTH_NAMES[(cycle.month || 1) - 1] + ' ' + cycle.year) : '';
  const openCount = queries.filter(q => q.status === 'open').length;

  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-2">
            <span>Payroll</span>
            <span>›</span>
            <span>{cycleLabel}</span>
            <span>›</span>
            <span className="text-gray-900">Queries</span>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-navy">Payroll Queries</h1>
            {openCount > 0 && (
              <span className="bg-amber-100 text-amber-800 text-sm font-medium px-3 py-1 rounded-full">
                {openCount} open
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Raise a Query</h2>
          <textarea
            className="w-full border border-gray-300 rounded-md p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-navy"
            rows={3}
            placeholder="Describe your query..."
            value={newQuery}
            onChange={e => setNewQuery(e.target.value)}
          />
          <button
            onClick={handleRaiseQuery}
            disabled={submitting || !newQuery.trim()}
            className="mt-2 px-4 py-2 bg-navy text-white text-sm font-medium rounded-md disabled:opacity-50"
          >
            Raise Query
          </button>
        </div>

        <div className="space-y-4">
          {queries.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No queries raised for this cycle.</div>
          ) : (
            queries.map(q => (
              <div key={q.id} className={`bg-white rounded-lg border p-4 ${q.status === 'open' ? 'border-amber-300' : 'border-gray-200'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${q.raised_by === 'pag' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {q.raised_by === 'pag' ? 'PAG' : 'Rodliffe'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${q.status === 'open' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                        {q.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-800">{q.query_text}</p>
                    {q.response_text && (
                      <div className="mt-2 pl-3 border-l-2 border-green-400">
                        <p className="text-xs text-gray-500 mb-0.5">Response</p>
                        <p className="text-sm text-gray-700">{q.response_text}</p>
                      </div>
                    )}
                  </div>
                </div>
                {q.status === 'open' && (
                  <div className="mt-3">
                    <textarea
                      className="w-full border border-gray-300 rounded-md p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-navy"
                      rows={2}
                      placeholder="Reply and resolve..."
                      value={replyText[q.id] || ''}
                      onChange={e => setReplyText(prev => ({ ...prev, [q.id]: e.target.value }))}
                    />
                    <button
                      onClick={() => handleReply(q.id)}
                      disabled={submitting}
                      className="mt-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-md disabled:opacity-50"
                    >
                      Reply &amp; Resolve
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
