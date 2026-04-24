'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface PayrollInput {
  id: string;
  employee_id: string;
  input_type: string;
  field_changed: string | null;
  old_value: string | null;
  new_value: string | null;
  supporting_doc_url: string | null;
  submitted_by: string;
  submitted_at: string;
  employee?: { name: string; payroll_id: string };
}

interface PayrollCycle {
  id: string;
  month: number;
  year: number;
  status: string;
  xero_confirmed: boolean;
  leave_data: Record<string, unknown> | null;
  initiated_at: string;
}

const INPUT_TYPE_LABELS: Record<string, string> = {
  salary_change: 'Salary Change',
  new_starter: 'New Starter',
  leaver: 'Leaver',
  bonus: 'Bonus',
  sick: 'Sick Leave',
  holiday_adj: 'Holiday Adjustment',
  pension_change: 'Pension Change',
  tax_code: 'Tax Code Change',
  student_loan: 'Student Loan',
  attachment_of_earnings: 'Attachment of Earnings',
  expense: 'Expense',
  other: 'Other',
};

const INPUT_TYPE_COLOURS: Record<string, string> = {
  new_starter: 'bg-green-100 text-green-800',
  leaver: 'bg-red-100 text-red-800',
  salary_change: 'bg-blue-100 text-blue-800',
  tax_code: 'bg-purple-100 text-purple-800',
  bonus: 'bg-yellow-100 text-yellow-800',
  sick: 'bg-orange-100 text-orange-800',
  pension_change: 'bg-indigo-100 text-indigo-800',
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CycleReviewPage() {
  const params = useParams();
  const router = useRouter();
  const cycleId = params.id as string;

  const [cycle, setCycle] = useState<PayrollCycle | null>(null);
  const [inputs, setInputs] = useState<PayrollInput[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const supabase = createClient();

  useEffect(() => {
    if (cycleId) loadData();
  }, [cycleId]);

  async function loadData() {
    setLoading(true);
    try {
      const { data: cycleData, error: cycleErr } = await supabase
        .from('payroll_cycles')
        .select('*')
        .eq('id', cycleId)
        .single();
      if (cycleErr) throw cycleErr;
      setCycle(cycleData);

      const { data: inputsData, error: inputsErr } = await supabase
        .from('payroll_inputs')
        .select('*, employee:employees(name, payroll_id)')
        .eq('cycle_id', cycleId)
        .order('submitted_at', { ascending: true });
      if (inputsErr) throw inputsErr;
      setInputs(inputsData || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }

  const groupedInputs = inputs.reduce((acc, input) => {
    const key = input.input_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(input);
    return acc;
  }, {} as Record<string, PayrollInput[]>);

  if (loading) return (
    <DashboardLayout>
      <div className='flex items-center justify-center h-64'>
        <div className='animate-spin rounded-full h-12 w-12 border-b-2 border-pag-blue'></div>
      </div>
    </DashboardLayout>
  );

  if (error || !cycle) return (
    <DashboardLayout>
      <div className='p-6 text-red-600'>Error: {error || 'Cycle not found'}</div>
    </DashboardLayout>
  );

  const monthName = MONTH_NAMES[cycle.month - 1];

  return (
    <DashboardLayout>
      <div className='max-w-5xl mx-auto p-6'>
        {/* Header */}
        <div className='flex items-center justify-between mb-6'>
          <div>
            <button onClick={() => router.back()} className='text-sm text-pag-blue hover:underline mb-2 flex items-center gap-1'>
              ← Back
            </button>
            <h1 className='text-2xl font-bold text-pag-navy'>
              {monthName} {cycle.year} — Submitted Inputs
            </h1>
            <p className='text-gray-500 text-sm mt-1'>Read-only view of PAG inputs submitted for this cycle</p>
          </div>
          <div className='text-right'>
            <span className={'inline-flex px-3 py-1 rounded-full text-sm font-medium ' + (cycle.status === 'inputs_submitted' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700')}>
              {cycle.status.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
            </span>
          </div>
        </div>

        {/* Cycle Meta */}
        <div className='grid grid-cols-3 gap-4 mb-6'>
          <div className='bg-white border rounded-lg p-4'>
            <p className='text-xs text-gray-500 mb-1'>Cycle Reference</p>
            <p className='font-semibold text-pag-navy'>[PAG-Payroll-{cycle.year}-{String(cycle.month).padStart(2,'0')}]</p>
          </div>
          <div className='bg-white border rounded-lg p-4'>
            <p className='text-xs text-gray-500 mb-1'>Xero Confirmed</p>
            <p className={'font-semibold ' + (cycle.xero_confirmed ? 'text-green-600' : 'text-orange-600')}>
              {cycle.xero_confirmed ? '✓ Confirmed' : '○ Pending'}
            </p>
          </div>
          <div className='bg-white border rounded-lg p-4'>
            <p className='text-xs text-gray-500 mb-1'>Total Changes</p>
            <p className='font-semibold text-pag-navy'>{inputs.length} input{inputs.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {inputs.length === 0 ? (
          <div className='bg-white border rounded-lg p-8 text-center text-gray-500'>
            <p className='text-lg font-medium mb-2'>No Changes Submitted</p>
            <p className='text-sm'>PAG confirmed no changes for this cycle — standing data only.</p>
          </div>
        ) : (
          <div className='space-y-6'>
            {Object.entries(groupedInputs).map(([type, typeInputs]) => (
              <div key={type} className='bg-white border rounded-lg overflow-hidden'>
                <div className='px-4 py-3 bg-gray-50 border-b flex items-center justify-between'>
                  <h2 className='font-semibold text-pag-navy'>{INPUT_TYPE_LABELS[type] || type}</h2>
                  <span className={'text-xs font-medium px-2 py-1 rounded-full ' + (INPUT_TYPE_COLOURS[type] || 'bg-gray-100 text-gray-700')}>
                    {typeInputs.length} record{typeInputs.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className='divide-y'>
                  {typeInputs.map((input) => (
                    <div key={input.id} className='px-4 py-3'>
                      <div className='flex items-start justify-between'>
                        <div className='flex-1'>
                          <p className='font-medium text-gray-900'>
                            {input.employee?.name || 'Unknown'} <span className='text-gray-400 text-sm'>({input.employee?.payroll_id})</span>
                          </p>
                          {input.field_changed && (
                            <p className='text-sm text-gray-600 mt-1'>
                              <span className='font-medium'>Field:</span> {input.field_changed}
                              {input.old_value && <span> — <span className='line-through text-red-500'>{input.old_value}</span></span>}
                              {input.new_value && <span> → <span className='text-green-600 font-medium'>{input.new_value}</span></span>}
                            </p>
                          )}
                          <p className='text-xs text-gray-400 mt-1'>
                            Submitted {new Date(input.submitted_at).toLocaleString('en-GB', { timeZone: 'Europe/London' })}
                          </p>
                        </div>
                        {input.supporting_doc_url && (
                          <a
                            href={input.supporting_doc_url}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='ml-4 text-sm text-pag-blue hover:underline whitespace-nowrap'
                          >
                            📄 View Doc
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className='mt-6 flex gap-3'>
          <button
            onClick={() => router.push('/cycle/' + cycleId + '/queries')}
            className='px-4 py-2 border border-pag-blue text-pag-blue rounded-lg hover:bg-blue-50 text-sm font-medium'
          >
            View Query Thread
          </button>
          {cycle.status === 'approval_pending' && (
            <button
              onClick={() => router.push('/cycle/' + cycleId + '/approve')}
              className='px-4 py-2 bg-pag-navy text-white rounded-lg hover:bg-opacity-90 text-sm font-medium'
            >
              Go to Approval
            </button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
                              }
