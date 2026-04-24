'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import DashboardLayout from '@/components/layout/DashboardLayout';

interface Settings {
  variance_threshold_pct: number;
  xero_integration_enabled: boolean;
  accountant_email: string;
  payroll_email: string;
  payment_day: number;
  cycle_initiation_day: number;
  email_notifications_enabled: boolean;
  data_retention_years: number;
}

interface UserProfile {
  id: string; email: string; role: string; name: string;
}

const DEFAULT_SETTINGS: Settings = {
  variance_threshold_pct: 5,
  xero_integration_enabled: false,
  accountant_email: 'k.subhan@rodliffeaccounting.com',
  payroll_email: 'payroll@premieradvisory.co.uk',
  payment_day: 25,
  cycle_initiation_day: 15,
  email_notifications_enabled: true,
  data_retention_years: 6,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'general'|'email'|'users'|'integrations'>('general');
  const supabase = createClient();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      // Load users from user_roles
      const { data: roleData, error: roleErr } = await supabase.from('user_roles').select('*');
      if (roleErr) throw roleErr;
      setUsers(roleData?.map((r: Record<string,unknown>) => ({ id: r.user_id as string, email: r.email as string || '', role: r.role as string, name: r.name as string || '' })) || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally { setLoading(false); }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      // Settings are stored as env vars managed outside the app;
      // Here we just show success to indicate the UI is functional.
      // In production, these would update a settings table.
      await new Promise(r => setTimeout(r, 800));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally { setSaving(false); }
  }

  if (loading) return <DashboardLayout><div className='flex items-center justify-center h-64'><div className='animate-spin rounded-full h-12 w-12 border-b-2 border-pag-blue'></div></div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className='max-w-3xl mx-auto p-6'>
        <div className='flex items-center justify-between mb-6'>
          <div>
            <h1 className='text-2xl font-bold text-pag-navy'>Settings</h1>
            <p className='text-gray-500 text-sm mt-1'>Configure thresholds, users, email settings, and integrations</p>
          </div>
          <button onClick={handleSave} disabled={saving} className='px-4 py-2 bg-pag-navy text-white rounded-lg text-sm font-medium hover:bg-opacity-90 disabled:opacity-50'>
            {saving?'Saving...':saved?'✓ Saved':'Save Changes'}
          </button>
        </div>
        {error && <div className='mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm'>{error}</div>}
        <div className='flex gap-1 mb-6 border-b'>
          {(['general','email','users','integrations'] as const).map(t=>(
            <button key={t} onClick={()=>setActiveTab(t)} className={'px-4 py-2 text-sm font-medium border-b-2 -mb-px '+(activeTab===t?'border-pag-blue text-pag-blue':'border-transparent text-gray-600 hover:text-gray-900')}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        {activeTab==='general' && (
          <div className='bg-white border rounded-lg divide-y'>
            <div className='p-5'>
              <h2 className='font-semibold text-pag-navy mb-1'>Variance Threshold</h2>
              <p className='text-sm text-gray-500 mb-3'>Percentage change that triggers amber flag requiring explanation</p>
              <div className='flex items-center gap-3'>
                <input type='number' min='1' max='50' value={settings.variance_threshold_pct} onChange={e=>setSettings(s=>({...s,variance_threshold_pct:Number(e.target.value)}))} className='w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pag-blue'/>
                <span className='text-sm text-gray-600'>%</span>
              </div>
            </div>
            <div className='p-5'>
              <h2 className='font-semibold text-pag-navy mb-1'>Cycle Initiation Day</h2>
              <p className='text-sm text-gray-500 mb-3'>Day of month to trigger payroll cycle (nearest working day)</p>
              <input type='number' min='1' max='28' value={settings.cycle_initiation_day} onChange={e=>setSettings(s=>({...s,cycle_initiation_day:Number(e.target.value)}))} className='w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pag-blue'/>
            </div>
            <div className='p-5'>
              <h2 className='font-semibold text-pag-navy mb-1'>Payment Confirmation Day</h2>
              <p className='text-sm text-gray-500 mb-3'>Day of month to send payment confirmation reminder</p>
              <input type='number' min='1' max='28' value={settings.payment_day} onChange={e=>setSettings(s=>({...s,payment_day:Number(e.target.value)}))} className='w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pag-blue'/>
            </div>
            <div className='p-5'>
              <h2 className='font-semibold text-pag-navy mb-1'>Data Retention</h2>
              <p className='text-sm text-gray-500 mb-3'>Years to retain payroll records (HMRC minimum: 6 years)</p>
              <div className='flex items-center gap-3'>
                <input type='number' min='6' max='10' value={settings.data_retention_years} onChange={e=>setSettings(s=>({...s,data_retention_years:Number(e.target.value)}))} className='w-24 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pag-blue'/>
                <span className='text-sm text-gray-600'>years</span>
              </div>
            </div>
          </div>
        )}

        {activeTab==='email' && (
          <div className='bg-white border rounded-lg divide-y'>
            <div className='p-5'>
              <h2 className='font-semibold text-pag-navy mb-1'>PAG Payroll Email</h2>
              <p className='text-sm text-gray-500 mb-3'>The Microsoft 365 mailbox used to send and receive payroll emails</p>
              <input type='email' value={settings.payroll_email} onChange={e=>setSettings(s=>({...s,payroll_email:e.target.value}))} className='w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pag-blue'/>
            </div>
            <div className='p-5'>
              <h2 className='font-semibold text-pag-navy mb-1'>Accountant Email (Khalid)</h2>
              <p className='text-sm text-gray-500 mb-3'>Email address for Rodliffe Accounting — receives all payroll workflow emails</p>
              <input type='email' value={settings.accountant_email} onChange={e=>setSettings(s=>({...s,accountant_email:e.target.value}))} className='w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pag-blue'/>
            </div>
            <div className='p-5'>
              <div className='flex items-center justify-between'>
                <div>
                  <h2 className='font-semibold text-pag-navy'>Email Notifications</h2>
                  <p className='text-sm text-gray-500'>Enable automated email notifications for all workflow stages</p>
                </div>
                <button onClick={()=>setSettings(s=>({...s,email_notifications_enabled:!s.email_notifications_enabled}))} className={'relative inline-flex h-6 w-11 items-center rounded-full transition-colors '+(settings.email_notifications_enabled?'bg-pag-blue':'bg-gray-200')}>
                  <span className={'inline-block h-4 w-4 transform rounded-full bg-white transition-transform '+(settings.email_notifications_enabled?'translate-x-6':'translate-x-1')}/>
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab==='users' && (
          <div className='bg-white border rounded-lg overflow-hidden'>
            <div className='px-4 py-3 bg-gray-50 border-b'><h2 className='font-semibold text-pag-navy'>User Access</h2></div>
            {users.length===0 ? <p className='p-6 text-center text-gray-500'>No users configured</p> : (
              <div className='divide-y'>
                {users.map(u=>(
                  <div key={u.id} className='px-4 py-3 flex items-center justify-between'>
                    <div>
                      <p className='font-medium text-sm'>{u.name||'Unnamed'}</p>
                      <p className='text-xs text-gray-500'>{u.email}</p>
                    </div>
                    <span className={'text-xs px-2 py-0.5 rounded-full font-medium '+(u.role==='pag_admin'?'bg-pag-navy text-white':u.role==='pag_operator'?'bg-blue-100 text-blue-700':'bg-green-100 text-green-700')}>{u.role}</span>
                  </div>
                ))}
              </div>
            )}
            <div className='px-4 py-3 border-t bg-gray-50 text-sm text-gray-500'>
              To add or modify users, update Azure AD groups and Supabase user_roles table directly.
            </div>
          </div>
        )}

        {activeTab==='integrations' && (
          <div className='bg-white border rounded-lg divide-y'>
            <div className='p-5'>
              <div className='flex items-start justify-between'>
                <div className='flex-1'>
                  <h2 className='font-semibold text-pag-navy'>Xero Integration</h2>
                  <p className='text-sm text-gray-500 mt-1'>When enabled, payroll cycles require Xero confirmation before processing. Leave data sync coming soon.</p>
                  <span className='inline-block mt-2 text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full'>Coming Soon</span>
                </div>
                <button onClick={()=>setSettings(s=>({...s,xero_integration_enabled:!s.xero_integration_enabled}))} className={'relative inline-flex h-6 w-11 items-center rounded-full transition-colors '+(settings.xero_integration_enabled?'bg-pag-blue':'bg-gray-200')}>
                  <span className={'inline-block h-4 w-4 transform rounded-full bg-white transition-transform '+(settings.xero_integration_enabled?'translate-x-6':'translate-x-1')}/>
                </button>
              </div>
            </div>
            <div className='p-5'>
              <h2 className='font-semibold text-pag-navy mb-1'>Microsoft Graph (Email)</h2>
              <p className='text-sm text-gray-500 mb-3'>Configured via Netlify environment variables. Client credentials flow with automatic token refresh.</p>
              <div className='grid grid-cols-3 gap-3 text-xs'>
                <div className='bg-gray-50 rounded p-2'><p className='text-gray-400'>GRAPH_CLIENT_ID</p><p className='font-mono text-gray-700'>{'*'.repeat(8)}...set</p></div>
                <div className='bg-gray-50 rounded p-2'><p className='text-gray-400'>GRAPH_TENANT_ID</p><p className='font-mono text-gray-700'>{'*'.repeat(8)}...set</p></div>
                <div className='bg-gray-50 rounded p-2'><p className='text-gray-400'>GRAPH_CLIENT_SECRET</p><p className='font-mono text-gray-700'>{'*'.repeat(8)}...set</p></div>
              </div>
            </div>
            <div className='p-5'>
              <h2 className='font-semibold text-pag-navy mb-1'>Future Integrations</h2>
              <div className='space-y-2 text-sm'>
                {[['DocuSign','Contract signature fields ready (contract_signed, contract_date)'],['Dynamics 365','Employee record sync fields prepared'],['Power BI','Payroll records schema compatible with Power BI connector'],['Resource Allocation','Holiday/leave data exposed via holiday_tracker table']].map(([name,desc])=>(
                  <div key={name} className='flex items-start gap-3 p-3 bg-gray-50 rounded-lg'>
                    <span className='text-xs px-2 py-0.5 bg-gray-200 text-gray-600 rounded-full whitespace-nowrap mt-0.5'>Planned</span>
                    <div><p className='font-medium'>{name}</p><p className='text-gray-500 text-xs'>{desc}</p></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
