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

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function QueriesPage() {
  const params = useParams();
  const router = useRouter();
  const cycleId = params.id as string;
  const [cycle, setCycle] = useState<PayrollCycle | null>(null);
  const [queries, setQueries] = useState<Query[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => { if (cycleId) loadData(); }, [cycleId]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: c, error: ce } = await supabase.from('payroll_cycles').select('id,month,year,status').eq('id', cycleId).single();
      if (ce) throw ce;
      setCycle(c);
      const { data: q, error: qe } = await supabase
        .from('queries').select('*').eq('cycle_id', cycleId).order('created_at', { ascending: true });
      if (qe) throw qe;
      setQueries(q || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoading(false); }
  }

  async function handleReply(queryId: string) {
    const text = replyText[queryId];
    if (!text?.trim()) return;
    setSubmitting(queryId);
    try {
      const res = await fetch('/api/cycles/' + cycleId + '/queries/' + queryId + '/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response_text: text }),
      });
      if (!res.ok) throw new Error('Failed to submit reply');
      setReplyText(prev => ({ ...prev, [queryId]: '' }));
      await loadData();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit reply');
    } finally { setSubmitting(null); }
  }

  if (loading) return <DashboardLayout><div className='flex items-center justify-center h-64'><div className='animate-spin rounded-full h-12 w-12 border-b-2 border-pag-blue'></div></div></DashboardLayout>;
  if (error || !cycle) return <DashboardLayout><div className='p-6 text-red-600'>Error: {error || 'Not found'}</div></DashboardLayout>;

  const openCount = queries.filter(q => q.status === 'open').length;
  const resolvedCount = queries.filter(q => q.status === 'resolved').length;

  return (
    <DashboardLayout>
      <div className='max-w-4xl mx-auto p-6'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <button onClick={() => router.back()} className='text-sm text-pag-blue hover:underline mb-2'>← Back</button>
            <h1 className='text-2xl font-bold text-pag-navy'>{MONTHS[cycle.month - 1]} {cycle.year} — Query Thread</h1>
            <p className='text-gray-500 text-sm mt-1'>All queries raised between PAG and Rodliffe for this cycle</p>
          </div>
          <div className='flex gap-3'>
            {openCount > 0 && <span className='px-3 py-1 bg-red-100 text-red-700 rounded-full text-sm font-medium'>{openCount} Open</span>}
            {resolvedCount > 0 && <span className='px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium'>{resolvedCount} Resolved</span>}
          </div>
        </div>

        {queries.length === 0 ? (
          <div className='bg-white border rounded-lg p-8 text-center text-gray-500'>
            <p className='text-lg font-medium mb-1'>No queries raised</p>
            <p className='text-sm'>No queries have been raised for this payroll cycle.</p>
          </div>
        ) : (
          <div className='space-y-4'>
            {queries.map((query) => (
              <div key={query.id} className={'bg-white border rounded-lg overflow-hidden ' + (query.status === 'open' ? 'border-orange-200' : 'border-gray-200')}>
                <div className={'px-4 py-3 border-b flex items-center justify-between ' + (query.status === 'open' ? 'bg-orange-50' : 'bg-gray-50')}>
                  <div className='flex items-center gap-2'>
                    <span className={'text-xs font-semibold px-2 py-0.5 rounded-full ' + (query.raised_by === 'rodliffe' ? 'bg-blue-100 text-blue-700' : 'bg-pag-navy text-white')}>
                      {query.raised_by === 'rodliffe' ? 'Rodliffe' : 'PAG'}
                    </span>
                    <span className='text-sm text-gray-500'>{new Date(query.created_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}</span>
                  </div>
                  <span className={'text-xs font-medium px-2 py-0.5 rounded-full ' + (query.status === 'open' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700')}>
                    {query.status === 'open' ? 'Open' : 'Resolved'}
                  </span>
                </div>
                <div className='p-4'>
                  <p className='text-gray-800 whitespace-pre-wrap'>{query.query_text}</p>
                  {query.link_to_form && (
                    <a href={query.link_to_form} className='mt-2 inline-block text-sm text-pag-blue hover:underline'>View Related Form</a>
                  )}
                  {query.response_text && (
                    <div className='mt-4 pl-4 border-l-2 border-pag-blue'>
                      <p className='text-xs text-gray-400 mb-1'>Response {query.resolved_at ? '(' + new Date(query.resolved_at).toLocaleString('en-GB', { timeZone: 'Europe/London' }) + ')' : ''}</p>
                      <p className='text-gray-700 whitespace-pre-wrap'>{query.response_text}</p>
                    </div>
                  )}
                  {query.status === 'open' && query.raised_by === 'rodliffe' && (
                    <div className='mt-4'>
                      <textarea
                        value={replyText[query.id] || ''}
                        onChange={(e) => setReplyText(prev => ({ ...prev, [query.id]: e.target.value }))}
                        placeholder='Type your response...'
                        rows={3}
                        className='w-full border border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-pag-blue resize-none'
                      />
                      <button
                        onClick={() => handleReply(query.id)}
                        disabled={submitting === query.id || !replyText[query.id]?.trim()}
                        className='mt-2 px-4 py-2 bg-pag-navy text-white rounded-lg text-sm font-medium hover:bg-opacity-90 disabled:opacity-50'
                      >
                        {submitting === query.id ? 'Sending...' : 'Send Response'}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
