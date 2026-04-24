'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface Employee {
  id: string; name: string; payroll_id: string; email: string; role: string;
  fte_salary: number | null; weekly_hours: number | null; fte: number | null;
  tax_code: string | null; ni_number: string | null; ni_category: string | null;
  pension_scheme: string | null; student_loan_type: string | null;
  start_date: string | null; end_date: string | null; status: string;
  contract_signed: boolean; contract_date: string | null;
}

interface VarianceRecord {
  id: string; cycle_id: string; metric: string; prior_value: number | null;
  current_value: number | null; variance_pct: number | null; explanation: string | null;
  status: string; flag: string;
  cycle?: { month: number; year: number };
}

interface HolidayRecord {
  id: string; cycle_id: string; entitlement_hours: number; accrued: number;
  used: number; balance: number; ytd_used: number; remaining: number;
  cycle?: { month: number; year: number };
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function fmt(n: number | null) { if (n===null) return 'N/A'; return new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n); }
function pct(n: number | null) { if (n===null) return 'N/A'; return (n>0?'+':'')+n.toFixed(1)+'%'; }

export default function EmployeeDetailPage() {
  const params = useParams(); const router = useRouter(); const empId = params.id as string;
  const [emp, setEmp] = useState<Employee | null>(null);
  const [variances, setVariances] = useState<VarianceRecord[]>([]);
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview'|'variances'|'holiday'>('overview');
  const supabase = createClient();
  useEffect(() => { if (empId) loadData(); }, [empId]);
  async function loadData() {
    setLoading(true);
    try {
      const [{ data: e, error: ee },{data: v, error: ve},{data: h, error: he}] = await Promise.all([
        supabase.from('employees').select('*').eq('id',empId).single(),
        supabase.from('variance_analysis').select('*, cycle:payroll_cycles(month,year)').eq('employee_id',empId).order('id',{ascending:false}).limit(50),
        supabase.from('holiday_tracker').select('*, cycle:payroll_cycles(month,year)').eq('employee_id',empId).order('id',{ascending:false}).limit(24),
      ]);
      if (ee) throw ee;
      setEmp(e); setVariances(v||[]); setHolidays(h||[]);
    } catch (err: unknown) { setError(err instanceof Error?err.message:'Failed'); }
    finally { setLoading(false); }
  }
  if (loading) return <DashboardLayout><div className='flex items-center justify-center h-64'><div className='animate-spin rounded-full h-12 w-12 border-b-2 border-pag-blue'></div></div></DashboardLayout>;
  if (error || !emp) return <DashboardLayout><div className='p-6 text-red-600'>Error: {error||'Employee not found'}</div></DashboardLayout>;
  const FLAG_COLOURS: Record<string,string> = { ok:'bg-gray-100 text-gray-700', threshold:'bg-amber-100 text-amber-700', new_starter:'bg-green-100 text-green-700', leaver:'bg-red-100 text-red-700', tax_code_change:'bg-purple-100 text-purple-700' };
  return (
    <DashboardLayout>
      <div className='max-w-5xl mx-auto p-6'>
        <div className='mb-6'>
          <button onClick={()=>router.push('/employees')} className='text-sm text-pag-blue hover:underline mb-2'>← All Employees</button>
          <div className='flex items-center justify-between'>
            <div>
              <h1 className='text-2xl font-bold text-pag-navy'>{emp.name}</h1>
              <p className='text-gray-500 text-sm'>{emp.payroll_id} · {emp.role} · {emp.email}</p>
            </div>
            <span className={'px-3 py-1 rounded-full text-sm font-medium '+(emp.status==='active'?'bg-green-100 text-green-700':'bg-red-100 text-red-700')}>{emp.status==='active'?'Active':'Leaver'}</span>
          </div>
        </div>
        <div className='flex gap-1 mb-6 border-b'>
          {(['overview','variances','holiday'] as const).map(t=>(
            <button key={t} onClick={()=>setActiveTab(t)} className={'px-4 py-2 text-sm font-medium border-b-2 -mb-px '+(activeTab===t?'border-pag-blue text-pag-blue':'border-transparent text-gray-600 hover:text-gray-900')}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>
        {activeTab==='overview' && (
          <div className='grid grid-cols-2 gap-6'>
            <div className='bg-white border rounded-lg p-5'>
              <h2 className='font-semibold text-pag-navy mb-3'>Employment Details</h2>
              <dl className='space-y-2 text-sm'>
                <div className='flex justify-between'><dt className='text-gray-500'>Start Date</dt><dd className='font-medium'>{emp.start_date?new Date(emp.start_date).toLocaleDateString('en-GB'):'N/A'}</dd></div>
                {emp.end_date && <div className='flex justify-between'><dt className='text-gray-500'>End Date</dt><dd className='font-medium'>{new Date(emp.end_date).toLocaleDateString('en-GB')}</dd></div>}
                <div className='flex justify-between'><dt className='text-gray-500'>FTE</dt><dd className='font-medium'>{emp.fte??'N/A'}</dd></div>
                <div className='flex justify-between'><dt className='text-gray-500'>FTE Salary</dt><dd className='font-medium'>{fmt(emp.fte_salary)}</dd></div>
                <div className='flex justify-between'><dt className='text-gray-500'>Weekly Hours</dt><dd className='font-medium'>{emp.weekly_hours??'N/A'}</dd></div>
                <div className='flex justify-between'><dt className='text-gray-500'>Pension Scheme</dt><dd className='font-medium'>{emp.pension_scheme||'N/A'}</dd></div>
              </dl>
            </div>
            <div className='bg-white border rounded-lg p-5'>
              <h2 className='font-semibold text-pag-navy mb-3'>Tax & Statutory</h2>
              <dl className='space-y-2 text-sm'>
                <div className='flex justify-between'><dt className='text-gray-500'>Tax Code</dt><dd className='font-medium'>{emp.tax_code||'N/A'}</dd></div>
                <div className='flex justify-between'><dt className='text-gray-500'>NI Category</dt><dd className='font-medium'>{emp.ni_category||'N/A'}</dd></div>
                <div className='flex justify-between'><dt className='text-gray-500'>Student Loan</dt><dd className='font-medium'>{emp.student_loan_type||'None'}</dd></div>
                <div className='flex justify-between'><dt className='text-gray-500'>Contract Signed</dt><dd className={'font-medium '+(emp.contract_signed?'text-green-600':'text-orange-600')}>{emp.contract_signed?'Yes':'No'}</dd></div>
                {emp.contract_date && <div className='flex justify-between'><dt className='text-gray-500'>Contract Date</dt><dd className='font-medium'>{new Date(emp.contract_date).toLocaleDateString('en-GB')}</dd></div>}
              </dl>
            </div>
          </div>
        )}
        {activeTab==='variances' && (
          <div className='bg-white border rounded-lg overflow-hidden'>
            {variances.length===0 ? <p className='p-6 text-center text-gray-500'>No variance history</p> : (
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead className='bg-gray-50 border-b'><tr>
                    <th className='text-left px-4 py-2 text-gray-600'>Period</th>
                    <th className='text-left px-4 py-2 text-gray-600'>Metric</th>
                    <th className='text-right px-4 py-2 text-gray-600'>Prior</th>
                    <th className='text-right px-4 py-2 text-gray-600'>Current</th>
                    <th className='text-right px-4 py-2 text-gray-600'>Change</th>
                    <th className='text-left px-4 py-2 text-gray-600'>Flag</th>
                    <th className='text-left px-4 py-2 text-gray-600'>Explanation</th>
                  </tr></thead>
                  <tbody className='divide-y'>
                    {variances.map(v=>(
                      <tr key={v.id}>
                        <td className='px-4 py-2 whitespace-nowrap'>{v.cycle?MONTHS[(v.cycle.month-1)]+' '+v.cycle.year:'N/A'}</td>
                        <td className='px-4 py-2'>{v.metric}</td>
                        <td className='px-4 py-2 text-right'>{fmt(v.prior_value)}</td>
                        <td className='px-4 py-2 text-right'>{fmt(v.current_value)}</td>
                        <td className={'px-4 py-2 text-right font-medium '+(v.variance_pct&&v.variance_pct>0?'text-green-600':'text-red-600')}>{pct(v.variance_pct)}</td>
                        <td className='px-4 py-2'><span className={'text-xs px-2 py-0.5 rounded-full '+(FLAG_COLOURS[v.flag]||'bg-gray-100 text-gray-700')}>{v.flag}</span></td>
                        <td className='px-4 py-2 text-gray-600 text-xs'>{v.explanation||'-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {activeTab==='holiday' && (
          <div className='bg-white border rounded-lg overflow-hidden'>
            {holidays.length===0 ? <p className='p-6 text-center text-gray-500'>No holiday data</p> : (
              <div className='overflow-x-auto'>
                <table className='w-full text-sm'>
                  <thead className='bg-gray-50 border-b'><tr>
                    <th className='text-left px-4 py-2 text-gray-600'>Period</th>
                    <th className='text-right px-4 py-2 text-gray-600'>Entitlement</th>
                    <th className='text-right px-4 py-2 text-gray-600'>Accrued</th>
                    <th className='text-right px-4 py-2 text-gray-600'>Used</th>
                    <th className='text-right px-4 py-2 text-gray-600'>Balance</th>
                    <th className='text-right px-4 py-2 text-gray-600'>YTD Used</th>
                    <th className='text-right px-4 py-2 text-gray-600'>Remaining</th>
                  </tr></thead>
                  <tbody className='divide-y'>
                    {holidays.map(h=>(
                      <tr key={h.id}>
                        <td className='px-4 py-2 whitespace-nowrap'>{h.cycle?MONTHS[(h.cycle.month-1)]+' '+h.cycle.year:'N/A'}</td>
                        <td className='px-4 py-2 text-right'>{h.entitlement_hours}h</td>
                        <td className='px-4 py-2 text-right'>{h.accrued}h</td>
                        <td className='px-4 py-2 text-right text-red-600'>{h.used}h</td>
                        <td className='px-4 py-2 text-right font-semibold text-green-700'>{h.balance}h</td>
                        <td className='px-4 py-2 text-right'>{h.ytd_used}h</td>
                        <td className='px-4 py-2 text-right'>{h.remaining}h</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
