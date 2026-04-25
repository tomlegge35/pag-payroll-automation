export const dynamic = 'force-dynamic'

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
