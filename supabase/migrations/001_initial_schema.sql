-- PAG Payroll Automation - Initial Database Schema
-- Migration: 001_initial_schema
-- Run via: supabase db push

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- EMPLOYEES TABLE (shared, future HR module compatible)
-- ============================================================
CREATE TABLE employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  payroll_id TEXT UNIQUE NOT NULL,
  email TEXT,
  role TEXT DEFAULT 'employee',
  fte_salary NUMERIC(10,2),
  weekly_hours NUMERIC(5,2) DEFAULT 37.5,
  fte NUMERIC(3,2) DEFAULT 1.0,
  tax_code TEXT,
  ni_number TEXT,
  ni_category TEXT DEFAULT 'A',
  pension_scheme TEXT,
  student_loan_type TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'leaver')),
  contract_signed BOOLEAN DEFAULT FALSE,
  contract_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PAYROLL CYCLES TABLE
-- ============================================================
CREATE TABLE payroll_cycles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'initiated' CHECK (status IN (
    'initiated', 'inputs_submitted', 'processing',
    'approval_pending', 'approved', 'paid', 'closed'
  )),
  xero_confirmed BOOLEAN DEFAULT FALSE,
  leave_data JSONB,
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id),
  paid_confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(month, year)
);

-- ============================================================
-- PAYROLL INPUTS TABLE
-- ============================================================
CREATE TABLE payroll_inputs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES employees(id),
  input_type TEXT NOT NULL CHECK (input_type IN (
    'salary_change', 'new_starter', 'leaver', 'bonus',
    'sick', 'holiday_adj', 'pension_change', 'tax_code',
    'student_loan', 'attachment_of_earnings', 'expense', 'other'
  )),
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  supporting_doc_url TEXT,
  submitted_by UUID REFERENCES auth.users(id),
  submitted_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- ============================================================
-- PAYROLL RECORDS TABLE
-- ============================================================
CREATE TABLE payroll_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  gross_pay NUMERIC(10,2),
  regular_pay NUMERIC(10,2),
  holiday_pay NUMERIC(10,2),
  holiday_hours NUMERIC(6,2),
  public_holiday_pay NUMERIC(10,2),
  public_holiday_hours NUMERIC(6,2),
  paye NUMERIC(10,2),
  ee_nic NUMERIC(10,2),
  pension_ee NUMERIC(10,2),
  student_loan NUMERIC(10,2),
  postgrad_loan NUMERIC(10,2),
  total_deductions NUMERIC(10,2),
  net_pay NUMERIC(10,2),
  er_nic NUMERIC(10,2),
  er_pension NUMERIC(10,2),
  total_employer_cost NUMERIC(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cycle_id, employee_id)
);

-- ============================================================
-- VARIANCE ANALYSIS TABLE
-- ============================================================
CREATE TABLE variance_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  metric TEXT NOT NULL,
  prior_value NUMERIC(10,2),
  current_value NUMERIC(10,2),
  variance_abs NUMERIC(10,2),
  variance_pct NUMERIC(8,4),
  explanation TEXT,
  status TEXT DEFAULT 'unexplained' CHECK (status IN ('unexplained', 'explained', 'accepted')),
  flag TEXT DEFAULT 'ok' CHECK (flag IN ('ok', 'threshold', 'leaver', 'new_starter', 'tax_code_change')),
  actioned_by UUID REFERENCES auth.users(id),
  actioned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- APPROVAL ACTIONS TABLE
-- ============================================================
CREATE TABLE approval_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('approve', 'reject')),
  reason_code TEXT,
  reason_text TEXT,
  actioned_by UUID REFERENCES auth.users(id),
  actioned_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QUERIES TABLE
-- ============================================================
CREATE TABLE queries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  raised_by TEXT NOT NULL CHECK (raised_by IN ('pag', 'rodliffe')),
  query_text TEXT NOT NULL,
  response_text TEXT,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  link_to_form TEXT,
  email_message_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

-- ============================================================
-- HOLIDAY TRACKER TABLE
-- ============================================================
CREATE TABLE holiday_tracker (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  entitlement_hours NUMERIC(6,2),
  accrued NUMERIC(6,2),
  used NUMERIC(6,2),
  balance NUMERIC(6,2),
  ytd_used NUMERIC(6,2),
  remaining NUMERIC(6,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cycle_id, employee_id)
);

-- ============================================================
-- QUALITY LOG TABLE
-- ============================================================
CREATE TABLE quality_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID REFERENCES payroll_cycles(id),
  raised_by TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'late_input', 'data_error', 'process_deviation', 'query'
  )),
  description TEXT NOT NULL,
  root_cause TEXT,
  resolution TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STAFF NOTIFICATIONS TABLE
-- ============================================================
CREATE TABLE staff_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id UUID NOT NULL REFERENCES payroll_cycles(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  variance_summary TEXT,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOG TABLE
-- ============================================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  table_name TEXT NOT NULL,
  record_id UUID,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- USER ROLES TABLE (for RLS)
-- ============================================================
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('pag_admin', 'pag_operator', 'accountant')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
