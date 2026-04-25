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
}

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

const INPUT_TYPE_LABELS: Record<string, string> = {
  salary_change: 'Salary Change',
  new_starter: 'New Starter',
  leaver: 'Leaver',
  bonus: 'Bonus',
  sick: 'Sick Leave',
  holiday_adj: 'Holiday Adjustment',
  pension_change: 'Pension Change',
  tax_code: 'Tax Code Change',
  other: 'Other',
};

const INPUT_TYPE_COLOURS: Record<string, string> = {
  new_starter: 'bg-green-100 text-green-800',
  leaver: 'bg-red-100 text-red-800',
  salary_change: 'bg-blue-100 text-blue-800',
  tax_code: 'bg-purple-100 text-purple-800',
  bonus: 'bg-yellow-100 text-yellow-800',
  sick: 'bg-orange-100 text-orange-800',
  holiday_adj: 'bg-teal-100 text-teal-800',
  pension_change: 'bg-indigo-100 text-indigo-800',
  other: 'bg-gray-100 text-gray-800',
};

export default function CycleReviewPage() {
  const params = useParams();
  const router = useRouter();
  const cycleId = params.id as string;
  const supabase = createClient();

  const [cycle, setCycle] = useState<PayrollCycle | null>(null);
  const [inputs, setInputs] = useState<PayrollInput[]>([]);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [role, setRole] = useState<string>('pag_operator');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      const { data: c, error: ce } = await supabase
        .from('payroll_cycles').select('*').eq('id', cycleId).maybeSingle();
      if (ce) throw ce;
      if (!c) { router.push('/dashboard'); return; }
      setCycle(c);

      const { data: inp, error: ie } = await supabase
        .from('payroll_inputs').select('*, employee:employees(name, payroll_id)')
        .eq('cycle_id', cycleId).order('submitted_at', { ascending: true });
      if (ie) throw ie;
      setInputs(inp || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoading(false); }
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

  if (!cycle) return null;

  const grouped = inputs.reduce<Record<string, PayrollInput[]>>((acc, inp) => {
    const key = inp.input_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(inp);
    return acc;
  }, {});

  return (
    <DashboardLayout user={user} role={role}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <button onClick={() => router.back()} className="text-sm text-pag-blue cursor-pointer hover:underline mb-2">← Back</button>
            <h1 className="text-2xl font-bold text-pag-navy">{MONTHS[cycle.month - 1]} {cycle.year} — Submitted Inputs</h1>
            <p className="text-gray-500 text-sm mt-1">Read-only view of PAG inputs for this cycle</p>
          </div>
          <span className={"px-3 py-1 rounded-full text-sm font-medium " + (cycle.status === 'inputs_submitted' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-700')}>
            {cycle.status.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Cycle Reference</p>
            <p className="font-semibold text-pag-navy">[PAG-Payroll-{cycle.year}-{String(cycle.month).padStart(2,'0')}]</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Xero Confirmed</p>
            <p className={"font-semibold " + (cycle.xero_confirmed ? 'text-green-600' : 'text-orange-600')}>{cycle.xero_confirmed ? 'Yes' : 'No'}</p>
          </div>
          <div className="bg-white border rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Total Inputs</p>
            <p className="font-semibold text-pag-navy">{inputs.length}</p>
          </div>
        </div>

        {inputs.length === 0 ? (
          <div className="bg-white border rounded-lg p-8 text-center text-gray-500">No changes submitted — standing data confirmed only.</div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([type, items]) => (
              <div key={type} className="bg-white border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
                  <h2 className="font-semibold text-pag-navy">{INPUT_TYPE_LABELS[type] || type}</h2>
                  <span className={"text-xs font-medium px-2 py-1 rounded-full " + (INPUT_TYPE_COLOURS[type] || 'bg-gray-100 text-gray-700')}>{items.length}</span>
                </div>
                <div className="divide-y">
                  {items.map((inp) => (
                    <div key={inp.id} className="px-4 py-3">
                      <p className="font-medium">{inp.employee?.name} <span className="text-gray-400 text-sm">({inp.employee?.payroll_id})</span></p>
                      {inp.field_changed && <p className="text-sm text-gray-600 mt-1">{inp.field_changed}: <span className="line-through text-red-500">{inp.old_value}</span> → <span className="text-green-600">{inp.new_value}</span></p>}
                      <p className="text-xs text-gray-400 mt-1">{new Date(inp.submitted_at).toLocaleString('en-GB')}</p>
                      {inp.supporting_doc_url && <a href={inp.supporting_doc_url} target="_blank" rel="noopener noreferrer" className="text-sm text-pag-blue hover:underline">View Document</a>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 flex gap-3">
          <button onClick={() => router.push('/cycle/' + cycleId + '/queries')} className="px-4 py-2 border border-pag-blue text-pag-blue rounded-lg hover:bg-blue-50 text-sm font-medium">View Queries</button>
          {cycle.status === 'approval_ready' && (
            <button onClick={() => router.push('/cycle/' + cycleId + '/approve')} className="px-4 py-2 bg-pag-navy text-white rounded-lg hover:bg-opacity-90 text-sm font-medium">Go to Approval</button>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
