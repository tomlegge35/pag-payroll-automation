export const dynamic = 'force-dynamic'

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
