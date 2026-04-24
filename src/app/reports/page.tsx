'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface QualityLog {
  id: string; cycle_id: string; raised_by: string; category: string;
  description: string; root_cause: string | null; resolution: string | null;
  logged_at: string;
  cycle?: { month: number; year: number };
}

interface PayrollCycle {
  id: string; month: number; year: number; status: string;
  initiated_at: string; approved_at: string | null; paid_confirmed_at: string | null;
}

interface VarianceSummary {
  cycle_id: string;
  flag_counts: Record<string, number>;
  total_variances: number;
  unexplained: number;
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const CATEGORY_COLOURS: Record<string,string> = {
  late_input: 'bg-orange-100 text-orange-700',
  data_error: 'bg-red-100 text-red-700',
  process_deviation: 'bg-purple-100 text-purple-700',
  query: 'bg-blue-100 text-blue-700',
};

export default function ReportsPage() {
  const router = useRouter();
  const [cycles, setCycles] = useState<PayrollCycle[]>([]);
  const [qualityLogs, setQualityLogs] = useState<QualityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState<'quarter'|'all'>('quarter');
  const [generatingReport, setGeneratingReport] = useState(false);
  const supabase = createClient();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [{ data: c, error: ce }, { data: q, error: qe }] = await Promise.all([
        supabase.from('payroll_cycles').select('id,month,year,status,initiated_at,approved_at,paid_confirmed_at').order('year',{ascending:false}).order('month',{ascending:false}).limit(12),
        supabase.from('quality_log').select('*, cycle:payroll_cycles(month,year)').order('logged_at',{ascending:false}).limit(100),
      ]);
      if (ce) throw ce;
      setCycles(c||[]); setQualityLogs(q||[]);
    } catch (err: unknown) { setError(err instanceof Error?err.message:'Failed'); }
    finally { setLoading(false); }
  }

  async function generateQuarterlyReport() {
    setGeneratingReport(true);
    try {
      const res = await fetch('/api/reports/quarterly', { method: 'POST' });
      if (!res.ok) { const d=await res.json(); throw new Error(d.error||'Failed'); }
      alert('Quarterly report generated and emailed successfully');
    } catch (err: unknown) { setError(err instanceof Error?err.message:'Failed to generate report'); }
    finally { setGeneratingReport(false); }
  }

  if (loading) return <DashboardLayout><div className='flex items-center justify-center h-64'><div className='animate-spin rounded-full h-12 w-12 border-b-2 border-pag-blue'></div></div></DashboardLayout>;
  if (error) return <DashboardLayout><div className='p-6 text-red-600'>Error: {error}</div></DashboardLayout>;

  const closedCycles = cycles.filter(c => c.status==='closed'||c.status==='paid');
  const lateCycles = qualityLogs.filter(q => q.category==='late_input').length;
  const dataErrors = qualityLogs.filter(q => q.category==='data_error').length;
  const queries = qualityLogs.filter(q => q.category==='query').length;

  return (
    <DashboardLayout>
      <div className='max-w-5xl mx-auto p-6'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <h1 className='text-2xl font-bold text-pag-navy'>Quality Reports</h1>
            <p className='text-gray-500 text-sm mt-1'>Quarterly quality metrics, trends, and audit log</p>
          </div>
          <button
            onClick={generateQuarterlyReport}
            disabled={generatingReport}
            className='px-4 py-2 bg-pag-navy text-white rounded-lg text-sm font-medium hover:bg-opacity-90 disabled:opacity-50'
          >
            {generatingReport?'Generating...':'Generate Quarterly Report'}
          </button>
        </div>

        {/* KPI Summary */}
        <div className='grid grid-cols-4 gap-4 mb-6'>
          <div className='bg-white border rounded-lg p-4'><p className='text-xs text-gray-500 mb-1'>Cycles Closed</p><p className='text-3xl font-bold text-pag-navy'>{closedCycles.length}</p></div>
          <div className='bg-white border rounded-lg p-4'><p className='text-xs text-gray-500 mb-1'>Late Inputs</p><p className='text-3xl font-bold text-orange-500'>{lateCycles}</p></div>
          <div className='bg-white border rounded-lg p-4'><p className='text-xs text-gray-500 mb-1'>Data Errors</p><p className='text-3xl font-bold text-red-500'>{dataErrors}</p></div>
          <div className='bg-white border rounded-lg p-4'><p className='text-xs text-gray-500 mb-1'>Queries Raised</p><p className='text-3xl font-bold text-blue-500'>{queries}</p></div>
        </div>

        {/* Cycle Performance Table */}
        <div className='bg-white border rounded-lg overflow-hidden mb-6'>
          <div className='px-4 py-3 bg-gray-50 border-b'>
            <h2 className='font-semibold text-pag-navy'>Cycle Performance History</h2>
          </div>
          {cycles.length===0 ? <p className='p-6 text-center text-gray-500'>No cycle data</p> : (
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead className='bg-gray-50 border-b'><tr>
                  <th className='text-left px-4 py-2 text-gray-600'>Period</th>
                  <th className='text-left px-4 py-2 text-gray-600'>Status</th>
                  <th className='text-left px-4 py-2 text-gray-600'>Initiated</th>
                  <th className='text-left px-4 py-2 text-gray-600'>Approved</th>
                  <th className='text-left px-4 py-2 text-gray-600'>Paid</th>
                  <th className='text-left px-4 py-2 text-gray-600'>Actions</th>
                </tr></thead>
                <tbody className='divide-y'>
                  {cycles.map(c=>(
                    <tr key={c.id}>
                      <td className='px-4 py-2 font-medium'>{MONTHS[c.month-1]} {c.year}</td>
                      <td className='px-4 py-2'><span className={'text-xs px-2 py-0.5 rounded-full font-medium '+(c.status==='closed'||c.status==='paid'?'bg-green-100 text-green-700':c.status==='approved'?'bg-blue-100 text-blue-700':'bg-gray-100 text-gray-700')}>{c.status}</span></td>
                      <td className='px-4 py-2 text-gray-600'>{c.initiated_at?new Date(c.initiated_at).toLocaleDateString('en-GB'):'-'}</td>
                      <td className='px-4 py-2 text-gray-600'>{c.approved_at?new Date(c.approved_at).toLocaleDateString('en-GB'):'-'}</td>
                      <td className='px-4 py-2 text-gray-600'>{c.paid_confirmed_at?new Date(c.paid_confirmed_at).toLocaleDateString('en-GB'):'-'}</td>
                      <td className='px-4 py-2'><button onClick={()=>router.push('/cycle/'+c.id+'/summary')} className='text-xs text-pag-blue hover:underline'>View Summary</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quality Log */}
        <div className='bg-white border rounded-lg overflow-hidden'>
          <div className='px-4 py-3 bg-gray-50 border-b flex items-center justify-between'>
            <h2 className='font-semibold text-pag-navy'>Quality Log</h2>
            <select value={selectedPeriod} onChange={e=>setSelectedPeriod(e.target.value as 'quarter'|'all')} className='text-sm border rounded px-2 py-1'>
              <option value='quarter'>Last Quarter</option>
              <option value='all'>All Time</option>
            </select>
          </div>
          {qualityLogs.length===0 ? <p className='p-6 text-center text-gray-500'>No quality events logged</p> : (
            <div className='divide-y'>
              {qualityLogs.map(log=>(
                <div key={log.id} className='px-4 py-3'>
                  <div className='flex items-start justify-between mb-1'>
                    <div className='flex items-center gap-2'>
                      <span className={'text-xs font-medium px-2 py-0.5 rounded-full '+(CATEGORY_COLOURS[log.category]||'bg-gray-100 text-gray-700')}>{log.category.replace(/_/g,' ')}</span>
                      <span className='text-xs text-gray-400'>{log.cycle?MONTHS[log.cycle.month-1]+' '+log.cycle.year:'N/A'}</span>
                      <span className='text-xs text-gray-400'>{new Date(log.logged_at).toLocaleDateString('en-GB')}</span>
                    </div>
                    <span className='text-xs text-gray-400'>Raised by: {log.raised_by}</span>
                  </div>
                  <p className='text-sm text-gray-800'>{log.description}</p>
                  {log.resolution && <p className='text-xs text-gray-500 mt-1'>Resolution: {log.resolution}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
