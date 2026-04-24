-- PAG Payroll Automation - Audit Triggers
-- Migration: 003_audit_triggers

-- ============================================================
-- AUDIT TRIGGER FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION audit_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, user_id)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::jsonb, auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_data, new_data, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_data, user_id)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ATTACH AUDIT TRIGGERS TO ALL TABLES
-- ============================================================
CREATE TRIGGER audit_employees
  AFTER INSERT OR UPDATE OR DELETE ON employees
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_payroll_cycles
  AFTER INSERT OR UPDATE OR DELETE ON payroll_cycles
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_payroll_inputs
  AFTER INSERT OR UPDATE OR DELETE ON payroll_inputs
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_payroll_records
  AFTER INSERT OR UPDATE OR DELETE ON payroll_records
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_variance_analysis
  AFTER INSERT OR UPDATE OR DELETE ON variance_analysis
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_approval_actions
  AFTER INSERT OR UPDATE OR DELETE ON approval_actions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

CREATE TRIGGER audit_queries
  AFTER INSERT OR UPDATE OR DELETE ON queries
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_func();

-- ============================================================
-- STATE TRANSITION VALIDATION FUNCTION
-- ============================================================
CREATE OR REPLACE FUNCTION validate_cycle_state_transition()
RETURNS TRIGGER AS $$
BEGIN
  -- Cannot move to approval_pending without payroll_records
  IF NEW.status = 'approval_pending' THEN
    IF NOT EXISTS (SELECT 1 FROM payroll_records WHERE cycle_id = NEW.id) THEN
      RAISE EXCEPTION 'Cannot move to approval_pending: no payroll records exist for this cycle';
    END IF;
  END IF;
  
  -- Cannot approve unless all variance_analysis rows are not unexplained
  IF NEW.status = 'approved' THEN
    IF EXISTS (
      SELECT 1 FROM variance_analysis 
      WHERE cycle_id = NEW.id AND status = 'unexplained'
    ) THEN
      RAISE EXCEPTION 'Cannot approve: unexplained variances exist';
    END IF;
  END IF;
  
  -- Cannot move to processing unless xero_confirmed = true
  IF NEW.status = 'processing' AND NEW.xero_confirmed = FALSE THEN
    RAISE EXCEPTION 'Cannot move to processing: Xero not confirmed';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_cycle_transition
  BEFORE UPDATE ON payroll_cycles
  FOR EACH ROW EXECUTE FUNCTION validate_cycle_state_transition();

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_employees_updated_at
  BEFORE UPDATE ON employees
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
