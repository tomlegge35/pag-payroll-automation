# PAG Payroll Automation

Production-ready payroll workflow system for **Premier Advisory Group Ltd** (PAG, 6 staff). Automates the monthly payroll cycle between PAG and external accountant Khalid Subhan at Rodliffe Accounting.

## Overview

This system replaces manual spreadsheets and ad-hoc emails with a structured, auditable 8-stage workflow. Built with Next.js 14, Supabase, and Microsoft Graph API.

## Architecture

- **Frontend/Backend**: Next.js 14 (App Router, TypeScript)
- **Database/Auth/Storage**: Supabase (PostgreSQL + Auth + Storage)
- **Email**: Microsoft Graph API via REST (no SDK)
- **Hosting**: Netlify (with Scheduled Functions)
- **Styling**: Tailwind CSS (navy #1F3864, blue #2E75B6)
- **PDF Parsing**: pdf-parse (Node-compatible)

## Prerequisites (macOS)

- Node.js v18+ (`brew install node`)
- npm or pnpm
- Supabase CLI (`brew install supabase/tap/supabase`)
- Git + GitHub account
- Netlify CLI (`npm install -g netlify-cli`)

## Quick Start (Mac)

```bash
# 1. Clone the repository
git clone https://github.com/tomlegge35/pag-payroll-automation.git
cd pag-payroll-automation

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your credentials

# 4. Start Supabase locally
supabase start

# 5. Run database migrations
supabase db push

# 6. Seed the database
supabase db seed

# 7. Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `GRAPH_CLIENT_ID` | Azure App Registration Client ID |
| `GRAPH_CLIENT_SECRET` | Azure App Registration Client Secret |
| `GRAPH_TENANT_ID` | Azure AD Tenant ID |
| `PAYROLL_EMAIL` | PAG payroll inbox (payroll@premieradvisory.co.uk) |
| `NEXT_PUBLIC_APP_URL` | Public app URL (https://pag-payroll.netlify.app) |

## Azure AD Setup

1. Go to Azure Portal → Azure Active Directory → App Registrations
2. Create new registration: "PAG Payroll System"
3. Add redirect URI: `https://pag-payroll.netlify.app/auth/callback`
4. Under "API permissions", add:
   - `Mail.Send` (Application)
   - `Mail.ReadWrite` (Application)
5. Create a client secret under "Certificates & secrets"
6. Copy Client ID, Client Secret, and Tenant ID to `.env.local`

## Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Enable Azure AD as an auth provider in Authentication → Providers
3. Set redirect URL: `https://pag-payroll.netlify.app/auth/callback`
4. Run migrations: `supabase db push`
5. Load seed data: `supabase db seed`

## Netlify Deployment

1. Connect GitHub repo to Netlify
2. Build command: `npm run build`
3. Publish directory: `.next`
4. Add environment variables in Netlify dashboard
5. Install Netlify Next.js plugin: `@netlify/plugin-nextjs`

```bash
# Deploy via CLI
netlify deploy --prod
```

## The 8-Stage Payroll Workflow

| Stage | Action | Trigger | Status |
|-------|--------|---------|--------|
| 1 | Cycle Initiation | Scheduled (15th) | initiated |
| 2 | PAG Input Submission | PAG portal | inputs_submitted |
| 3 | Transmission to Khalid | PAG submits | inputs_submitted |
| 4 | Query Resolution | Email/portal | inputs_submitted |
| 5 | Khalid Uploads Payroll | Portal | processing |
| 6 | Variance Analysis | Auto after upload | approval_pending |
| 7 | PAG Approval Gate | PAG portal | approved |
| 8 | Payment Confirmation | Scheduled (25th) | paid → closed |

## Portal Pages

| URL | Description |
|-----|-------------|
| `/dashboard` | Current cycle status, progress bar, action items |
| `/cycle/[id]/inputs` | PAG input form (Stage 2) |
| `/cycle/[id]/review` | Read-only submitted inputs |
| `/cycle/[id]/queries` | Query thread view |
| `/cycle/[id]/upload` | Khalid's upload + checklist (Stage 5) |
| `/cycle/[id]/approve` | Variance report + approval (Stage 7) |
| `/cycle/[id]/summary` | Post-approval summary |
| `/employees` | Master employee list |
| `/reports` | Quarterly quality reports |
| `/settings` | System configuration |

## Email Types

All emails sent from `payroll@premieradvisory.co.uk` via Microsoft Graph API.

| # | Name | Trigger |
|---|------|---------|
| E1 | Cycle Initiation | 15th scheduled |
| E2 | Inputs to Rodliffe | PAG submits |
| E3 | Query Alert to PAG | Khalid queries |
| E4 | Query Response to Khalid | PAG responds |
| E5 | Upload Received | Khalid uploads |
| E6 | Variance Report | Auto after parse |
| E7 | Payroll Approved | PAG approves |
| E8 | Payroll Rejected | PAG rejects |
| E9 | Staff Variance | Per accepted variance |
| E10 | Payment Confirmation | 25th scheduled |
| E11 | Quarterly Report | Every 3 cycles |

## Security

- All data encrypted at rest (Supabase default)
- Row-Level Security (RLS) on all tables
- JWT-based session handling
- No NI numbers or bank details in emails
- Signed URLs for document access (time-limited)
- No secrets in frontend code

## Staff Roles

- **pag_admin**: Full access, can approve payroll
- **pag_operator**: Can submit inputs, view reports
- **accountant**: Khalid's access - upload, query, accept inputs

## Seed Data

6 active employees pre-loaded:
- Charlotte Reece (CHA01) - 0.8 FTE, £37,380
- Charlotte Pearce Cornish (CHA03) - Director, K4884 tax code
- Danielle Corley (DAN01) - £65,000 (pay rise Apr 2026)
- Imogen Phillips (IMO01) - £35,962
- Muntaka Kamal (MUN01) - £45,000 (pay rise Apr 2026)
- Tom Legge (TOM03) - Director, £98,000

1 leaver: Sandro Sereno (SAN01, left Mar 2026)

## Testing Graph API

```bash
# Get access token
curl -X POST \
  https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token \
  -d "client_id=${GRAPH_CLIENT_ID}&client_secret=${GRAPH_CLIENT_SECRET}&scope=https://graph.microsoft.com/.default&grant_type=client_credentials"

# Test send email
curl -X POST \
  https://graph.microsoft.com/v1.0/users/payroll@premieradvisory.co.uk/sendMail \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"message":{"subject":"Test","body":{"contentType":"Text","content":"Test"},"toRecipients":[{"emailAddress":{"address":"test@example.com"}}]}}'
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/cycles/initiate` | Stage 1: Initiate cycle |
| POST | `/api/cycles/[id]/inputs` | Stage 2/3: Submit inputs |
| POST | `/api/cycles/[id]/upload` | Stage 5: Upload payroll |
| PATCH | `/api/cycles/[id]/variances/[vId]` | Update variance explanation |
| POST | `/api/cycles/[id]/approve` | Stage 7: Approve/reject |
| POST | `/api/cycles/[id]/confirm-payment` | Stage 8: Confirm payment |

## Future Integration Points

- **Xero API**: Replace manual checkbox with automated leave data pull
- **DocuSign**: Contract status for new starters
- **Dynamics 365**: Employee record sync
- **Power BI**: Payroll dashboard integration

## Support

For technical issues, contact the development team.  
For payroll queries, contact finance@premieradvisory.co.uk

---

*PAG Payroll Automation v1.0 — Confidential — Premier Advisory Group Ltd*
