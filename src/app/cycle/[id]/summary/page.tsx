'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface PayrollRecord {
  id: string; employee_id: string; gross_pay: number; net_pay: number;
  paye: number; ee_nic: number; pension_ee: number; total_employer_cost: number;
  employee?: { name: string; payroll_id: string };
}
interface PayrollCycle {
  id: string; month: number; year: number; status: string;
  approved_at: string | null; approved_by: string | null;
  paid_confirmed_at: string | null; xero_confirmed: boolean;
}
interface StaffNotification {
  id: string; employee_id: string; variance_summary: string; email_sent_at: string | null;
  employee?: { name: string; payroll_id: string };
}
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
function fmt(n: number) { return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n); }

export default function CycleSummaryPage() {
  const params = useParams(); const router = useRouter(); const cycleId = params.id as string;
  const [cycle, setCycle] = useState<PayrollCycle | null>(null);
  const [records, setRecords] = useState<PayrollRecord[]>([]);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const supabase = createClient();
  useEffect(() => { if (cycleId) loadData(); }, [cycleId]);
  async function loadData() {
    setLoading(true);
    try {
      const [{ data: c, error: ce },{ data: r, error: re },{ data: n, error: ne }] = await Promise.all([
        supabase.from('payroll_cycles').select('*').eq('id',cycleId).single(),
        supabase.from('payroll_records').select('*, employee:employees(name,payroll_id)').eq('cycle_id',cycleId),
        supabase.from('staff_notifications').select('*, employee:employees(name,payroll_id)').eq('cycle_id',cycleId),
      ]);
      if (ce) throw ce; setCycle(c); setRecords(r||[]); setNotifications(n||[]);
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setLoading(false); }
  }
  async function handleConfirmPayment() {
    setConfirmingPayment(true);
    try {
      const res = await fetch('/api/cycles/'+cycleId+'/confirm-payment',{method:'POST'});
      if (!res.ok) { const d=await res.json(); throw new Error(d.error||'Failed'); }
      await loadData();
    } catch (err: unknown) { setError(err instanceof Error ? err.message : 'Failed'); }
    finally { setConfirmingPayment(false); }
  }
  if (loading) return <DashboardLayout><div className='flex items-center justify-center h-64'><div className='animate-spin rounded-full h-12 w-12 border-b-2 border-pag-blue'></div></div></DashboardLayout>;
  if (error || !cycle) return <DashboardLayout><div className='p-6 text-red-600'>Error: {error||'Not found'}</div></DashboardLayout>;
  const tGross=records.reduce((s,r)=>s+r.gross_pay,0);
  const tNet=records.reduce((s,r)=>s+r.net_pay,0);
  const tCost=records.reduce((s,r)=>s+r.total_employer_cost,0);
  return (
    <DashboardLayout>
      <div className='max-w-5xl mx-auto p-6'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <button onClick={()=>router.push('/dashboard')} className='text-sm text-pag-blue hover:underline mb-2'>← Dashboard</button>
            <h1 className='text-2xl font-bold text-pag-navy'>{MONTHS[cycle.month-1]} {cycle.year} — Payroll Summary</h1>
            <p className='text-gray-500 text-sm mt-1'>[PAG-Payroll-{cycle.year}-{String(cycle.month).padStart(2,'0')}]</p>
          </div>
          <div>
            {cycle.status==='approved' && <button onClick={handleConfirmPayment} disabled={confirmingPayment} className='px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:opacity-50'>{confirmingPayment?'Confirming...':'Confirm Payments Made'}</button>}
            {cycle.status==='paid' && <span className='px-4 py-2 bg-green-100 text-green-700 rounded-full text-sm font-medium'>✓ Payments Confirmed</span>}
          </div>
        </div>
        <div className='grid grid-cols-4 gap-4 mb-6'>
          <div className='bg-white border rounded-lg p-4'><p className='text-xs text-gray-500 mb-1'>Status</p><p className='font-semibold text-pag-navy capitalize'>{cycle.status.replace(/_/g,' ')}</p></div>
          <div className='bg-white border rounded-lg p-4'><p className='text-xs text-gray-500 mb-1'>Approved</p><p className='font-semibold text-pag-navy text-sm'>{cycle.approved_at?new Date(cycle.approved_at).toLocaleDateString('en-GB'):'Pending'}</p></div>
          <div className='bg-white border rounded-lg p-4'><p className='text-xs text-gray-500 mb-1'>Payment Confirmed</p><p className='font-semibold text-pag-navy text-sm'>{cycle.paid_confirmed_at?new Date(cycle.paid_confirmed_at).toLocaleDateString('en-GB'):'Pending'}</p></div>
          <div className='bg-white border rounded-lg p-4'><p className='text-xs text-gray-500 mb-1'>Staff Notified</p><p className='font-semibold text-pag-navy'>{notifications.filter(n=>n.email_sent_at).length}/{notifications.length}</p></div>
        </div>
        <div className='bg-pag-navy text-white rounded-lg p-5 mb-6'>
          <h2 className='text-lg font-semibold mb-3'>Payroll Totals</h2>
          <div className='grid grid-cols-3 gap-4'>
            <div><p className='text-blue-200 text-sm'>Total Gross Pay</p><p className='text-2xl font-bold'>{fmt(tGross)}</p></div>
            <div><p className='text-blue-200 text-sm'>Total Net Pay</p><p className='text-2xl font-bold'>{fmt(tNet)}</p></div>
            <div><p className='text-blue-200 text-sm'>Total Employer Cost</p><p className='text-2xl font-bold'>{fmt(tCost)}</p></div>
          </div>
        </div>
        {records.length>0 && (
          <div className='bg-white border rounded-lg overflow-hidden mb-6'>
            <div className='px-4 py-3 bg-gray-50 border-b'><h2 className='font-semibold text-pag-navy'>Net Pay by Employee</h2></div>
            <div className='overflow-x-auto'>
              <table className='w-full text-sm'>
                <thead className='bg-gray-50 border-b'><tr>
                  <th className='text-left px-4 py-2 text-gray-600'>Employee</th>
                  <th className='text-right px-4 py-2 text-gray-600'>Gross</th>
                  <th className='text-right px-4 py-2 text-gray-600'>PAYE</th>
                  <th className='text-right px-4 py-2 text-gray-600'>NIC</th>
                  <th className='text-right px-4 py-2 text-gray-600'>Pension</th>
                  <th className='text-right px-4 py-2 text-gray-600'>Net Pay</th>
                </tr></thead>
                <tbody className='divide-y'>
                  {records.map(rec=>(
                    <tr key={rec.id}>
                      <td className='px-4 py-2 font-medium'>{rec.employee?.name} <span className='text-gray-400'>({rec.employee?.payroll_id})</span></td>
                      <td className='px-4 py-2 text-right'>{fmt(rec.gross_pay)}</td>
                      <td className='px-4 py-2 text-right text-red-600'>-{fmt(rec.paye)}</td>
                      <td className='px-4 py-2 text-right text-red-600'>-{fmt(rec.ee_nic)}</td>
                      <td className='px-4 py-2 text-right text-red-600'>-{fmt(rec.pension_ee)}</td>
                      <td className='px-4 py-2 text-right font-semibold text-green-700'>{fmt(rec.net_pay)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {notifications.length>0 && (
          <div className='bg-white border rounded-lg overflow-hidden'>
            <div className='px-4 py-3 bg-gray-50 border-b'><h2 className='font-semibold text-pag-navy'>Staff Variance Notifications</h2></div>
            <div className='divide-y'>
              {notifications.map(n=>(
                <div key={n.id} className='px-4 py-3 flex items-center justify-between'>
                  <div>
                    <p className='font-medium'>{n.employee?.name} <span className='text-gray-400 text-sm'>({n.employee?.payroll_id})</span></p>
                    <p className='text-sm text-gray-600 mt-0.5'>{n.variance_summary}</p>
                  </div>
                  <span className={'text-xs px-2 py-0.5 rounded-full '+(n.email_sent_at?'bg-green-100 text-green-700':'bg-gray-100 text-gray-500')}>{n.email_sent_at?'Sent '+new Date(n.email_sent_at).toLocaleDateString('en-GB'):'Pending'}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className='mt-6 flex gap-3'>
          <button onClick={()=>router.push('/cycle/'+cycleId+'/approve')} className='px-4 py-2 border border-pag-blue text-pag-blue rounded-lg hover:bg-blue-50 text-sm font-medium'>View Approval</button>
          <button onClick={()=>router.push('/reports')} className='px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 text-sm font-medium'>Reports</button>
        </div>
      </div>
    </DashboardLayout>
  );
}
