-- PAG Payroll Automation - RLS Policies
-- Migration: 002_rls_policies

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS TEXT AS $$
  SELECT role FROM user_roles WHERE user_id = user_uuid LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_pag_user()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('pag_admin', 'pag_operator')
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_accountant()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'accountant'
  );
$$ LANGUAGE sql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION is_pag_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'pag_admin'
  );
$$ LANGUAGE sql SECURITY DEFINER;

-- ============================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_inputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE variance_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE holiday_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE quality_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- EMPLOYEES POLICIES
-- ============================================================
CREATE POLICY "PAG users can view all employees"
  ON employees FOR SELECT USING (is_pag_user());

CREATE POLICY "PAG admins can manage employees"
  ON employees FOR ALL USING (is_pag_admin());

CREATE POLICY "Accountants can view active employees"
  ON employees FOR SELECT USING (is_accountant());

-- ============================================================
-- PAYROLL CYCLES POLICIES
-- ============================================================
CREATE POLICY "PAG users can view all cycles"
  ON payroll_cycles FOR SELECT USING (is_pag_user());

CREATE POLICY "PAG admins can manage cycles"
  ON payroll_cycles FOR ALL USING (is_pag_admin());

CREATE POLICY "Accountants can view cycles assigned to them"
  ON payroll_cycles FOR SELECT USING (is_accountant());

CREATE POLICY "Accountants can update cycle status"
  ON payroll_cycles FOR UPDATE USING (is_accountant())
  WITH CHECK (is_accountant());

-- ============================================================
-- PAYROLL INPUTS POLICIES
-- ============================================================
CREATE POLICY "PAG users can manage inputs"
  ON payroll_inputs FOR ALL USING (is_pag_user());

CREATE POLICY "Accountants can view inputs"
  ON payroll_inputs FOR SELECT USING (is_accountant());

-- ============================================================
-- PAYROLL RECORDS POLICIES
-- ============================================================
CREATE POLICY "PAG users can view payroll records"
  ON payroll_records FOR SELECT USING (is_pag_user());

CREATE POLICY "PAG admins can manage payroll records"
  ON payroll_records FOR ALL USING (is_pag_admin());

CREATE POLICY "Accountants can manage payroll records"
  ON payroll_records FOR ALL USING (is_accountant());

-- ============================================================
-- VARIANCE ANALYSIS POLICIES
-- ============================================================
CREATE POLICY "PAG users can view variance analysis"
  ON variance_analysis FOR SELECT USING (is_pag_user());

CREATE POLICY "PAG admins can manage variance analysis"
  ON variance_analysis FOR ALL USING (is_pag_admin());

CREATE POLICY "Accountants can view variance analysis"
  ON variance_analysis FOR SELECT USING (is_accountant());

-- ============================================================
-- APPROVAL ACTIONS POLICIES
-- ============================================================
CREATE POLICY "PAG admins can manage approvals"
  ON approval_actions FOR ALL USING (is_pag_admin());

CREATE POLICY "Accountants can view approvals"
  ON approval_actions FOR SELECT USING (is_accountant());

-- ============================================================
-- QUERIES POLICIES
-- ============================================================
CREATE POLICY "PAG users can manage queries"
  ON queries FOR ALL USING (is_pag_user());

CREATE POLICY "Accountants can manage queries"
  ON queries FOR ALL USING (is_accountant());

-- ============================================================
-- HOLIDAY TRACKER POLICIES
-- ============================================================
CREATE POLICY "PAG users can view holiday tracker"
  ON holiday_tracker FOR SELECT USING (is_pag_user());

CREATE POLICY "PAG admins can manage holiday tracker"
  ON holiday_tracker FOR ALL USING (is_pag_admin());

CREATE POLICY "Accountants can view holiday tracker"
  ON holiday_tracker FOR SELECT USING (is_accountant());

-- ============================================================
-- QUALITY LOG POLICIES
-- ============================================================
CREATE POLICY "PAG users can view quality log"
  ON quality_log FOR SELECT USING (is_pag_user());

CREATE POLICY "PAG admins can manage quality log"
  ON quality_log FOR ALL USING (is_pag_admin());

CREATE POLICY "Accountants can view quality log"
  ON quality_log FOR SELECT USING (is_accountant());

-- ============================================================
-- AUDIT LOG POLICIES (read-only for all)
-- ============================================================
CREATE POLICY "PAG admins can view audit log"
  ON audit_log FOR SELECT USING (is_pag_admin());

-- ============================================================
-- USER ROLES POLICIES
-- ============================================================
CREATE POLICY "Users can view own role"
  ON user_roles FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "PAG admins can manage roles"
  ON user_roles FOR ALL USING (is_pag_admin());
