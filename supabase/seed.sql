-- PAG Payroll Automation - Seed Data
-- 6 active employees + 1 leaver for Premier Advisory Group Ltd

-- ============================================================
-- EMPLOYEES SEED DATA
-- ============================================================
INSERT INTO employees (name, payroll_id, email, role, fte_salary, weekly_hours, fte, tax_code, ni_category, status, start_date)
VALUES
  -- Charlotte Reece (0.8 FTE)
  ('Charlotte Reece', 'CHA01', 'charlotte.reece@premieradvisory.co.uk', 
   'employee', 37380.00, 30.0, 0.8, '1257L', 'A', 'active', '2022-01-01'),
  
  -- Charlotte Pearce Cornish (Director, no salary - K4884 tax code)
  ('Charlotte Pearce Cornish', 'CHA03', 'charlotte.pearce@premieradvisory.co.uk',
   'director', NULL, 37.5, 1.0, 'K4884', 'A', 'active', '2019-06-01'),
  
  -- Danielle Corley (Pay rise from 56k to 65k, Apr 2026)
  ('Danielle Corley', 'DAN01', 'danielle.corley@premieradvisory.co.uk',
   'employee', 65000.00, 37.5, 1.0, '1257L', 'A', 'active', '2021-03-01'),
  
  -- Imogen Phillips (~143/mo residual overpay)
  ('Imogen Phillips', 'IMO01', 'imogen.phillips@premieradvisory.co.uk',
   'employee', 35962.00, 37.5, 1.0, '1257L', 'A', 'active', '2023-01-01'),
  
  -- Muntaka Kamal (Pay rise effective Apr 2026)
  ('Muntaka Kamal', 'MUN01', 'muntaka.kamal@premieradvisory.co.uk',
   'employee', 45000.00, 37.5, 1.0, '1257L', 'A', 'active', '2022-06-01'),
  
  -- Tom Legge (Director)
  ('Tom Legge', 'TOM03', 'tom.legge@premieradvisory.co.uk',
   'director', 98000.00, 37.5, 1.0, '1257L', 'A', 'active', '2018-01-01');

-- Leaver: Sandro Sereno (left Mar 2026)
INSERT INTO employees (name, payroll_id, email, role, status, start_date, end_date)
VALUES
  ('Sandro Sereno', 'SAN01', 'sandro.sereno@premieradvisory.co.uk',
   'employee', 'leaver', '2023-09-01', '2026-03-31');

-- ============================================================
-- PAYROLL CYCLES SEED DATA
-- March 2026 (completed, approved)
-- April 2026 (approved - first Stage 1 attachment)
-- ============================================================
INSERT INTO payroll_cycles (month, year, status, xero_confirmed, initiated_at, approved_at, paid_confirmed_at)
VALUES
  (3, 2026, 'closed', true, '2026-02-15 09:00:00+00', '2026-03-20 14:00:00+00', '2026-03-25 11:00:00+00'),
  (4, 2026, 'closed', true, '2026-03-15 09:00:00+01', '2026-04-21 15:30:00+01', '2026-04-25 10:00:00+01');
