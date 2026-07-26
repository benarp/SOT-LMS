@AGENTS.md

# SOT-LMS — School of Transformation Discipleship Training School

## What this is
A learning management system for an in-person discipleship training school. 30–50 students attend weekly (September–May). The whole cohort moves through the same curriculum at the same pace. The platform tracks homework completion, runs the admissions/application pipeline, and handles tuition billing — it does not grade, give feedback, or replace the in-person experience.

Full feature status and roadmap: [`docs/plan.md`](../../docs/plan.md) — keep that in sync when shipping anything user-facing; this file is the technical/structural reference.

## Repo & services
- **GitHub**: https://github.com/benarp/SOT-LMS
- **Supabase project**: https://supabase.com/dashboard/project/ooehfpmrhuuufjaglzab
- **Supabase URL**: https://ooehfpmrhuuufjaglzab.supabase.co
- **Hosting**: Vercel, project `sot-lms` — connected to GitHub (`benarp/SOT-LMS`), auto-deploys on push
  - Production: https://schooloftransformation.app (also aliased at sot-lms.vercel.app)
  - Preview deployments are created per-branch/PR automatically
- **Stripe**: tuition billing (deposit + monthly subscription)
- **Resend**: transactional email (weekly digest, application/reference emails, billing alerts)

## Tech stack
- **Framework**: Next.js 16 (App Router) — note: uses `proxy.ts` not `middleware.ts` (renamed in Next 16)
- **Database + Auth**: Supabase (PostgreSQL + row-level security)
- **Payments**: Stripe (`stripe` npm package)
- **Email**: Resend (`resend` npm package)
- **Styling**: Tailwind CSS v4 — dark mode via CSS-variable inversion in `globals.css` (see Key decisions)
- **Language**: TypeScript

## Project structure
```
src/
  app/
    login/, forgot-password/, reset-password/    # Public auth pages
    apply/                  # Public application flow (account/, questionnaire/, status/)
    reference/[token]/      # Public pastoral-reference form (no login)
    unsubscribe/[token]/    # Weekly-email unsubscribe
    auth/callback/          # Supabase auth redirect handler
    dashboard/              # Student-facing app (protected)
      layout.tsx            # Sidebar nav, role-aware
      page.tsx              # This week's homework
      history/[weekId]/     # Past weeks — fully interactive (late completion/reflections)
      billing/              # Tuition status, Stripe Checkout/portal
      account/              # Self-service profile settings
    leader/                 # Group-leader read-only view (students/[studentId])
    alumni/                 # Read-only alumni view of past reflections
    admin/                  # Admin panel
      students/[id]/        # Profile edit, role/group, billing panel, impersonation
      curriculum/[weekId]/  # School years, weeks, homework items
      applications/[id]/settings/  # Admissions pipeline + form builder
      announcements/, finances/, reports/[weekId]/, settings/
    api/
      stripe/webhook/       # Stripe event handler
      keepalive/            # Vercel cron (bearer-token auth via CRON_SECRET)
    actions/                # Server actions: admin.ts, applicationForm.ts, apply.ts,
                             #   billing.ts, email.ts, impersonate.ts, schoolYears.ts, submissions.ts
  components/
    HomeworkFeed.tsx, SignOutButton.tsx, NavShell.tsx, ImpersonationBanner.tsx,
    ThemeToggle.tsx, BillingActions.tsx
    admin/                  # Admin-only form/action components
  lib/
    auth.ts, billing.ts
    supabase/
      client.ts             # Browser client
      server.ts             # Server client (uses cookies)
      admin.ts              # Service-role client for privileged server actions
  proxy.ts                  # Route protection + role-based redirects
supabase/
  schema.sql                # Base DB schema
  migration-*.sql           # Incremental migrations (billing, form builder, alumni, etc.)
  export-auth-users.sql, fix-trigger*.sql   # One-off utility scripts
```

## Database schema (16 tables)
- `profiles` — extends auth.users; `role` (`user_role` enum), `group_id`, `birthday`, `alumni_year_id`, `email_opt_out`, `unsubscribe_token`
- `school_years` — one active at a time (`is_active`); `completed_at` when a year is finished
- `groups` — discipleship groups, each with a `leader_id`
- `weeks` — numbered weeks per school year, each has a `due_date`
- `homework_items` — belong to a week; types: `bible_reading`, `book_reading`, `video`, `reflection` (typed response and/or file upload, via `submissions`)
- `submissions` — completion records (student_id + homework_item_id, unique); `is_late` flag; `response_text` and `response_file_path`/`response_file_name` for reflection uploads
- `announcements` — admin-published; `publish_at` supports scheduling; `target_group_id` null = all students
- `billing_accounts` — one per student per school year; Stripe customer/subscription IDs, status, cycles paid, totals, credits applied
- `billing_events` — audit trail of every charge, failure, pause/resume, credit, refund, and offline cash/check payment
- `audit_log` — admin actions: impersonation, role changes, deactivation, invites, profile edits, billing actions
- `email_log` — one row per weekly-email send (prevents accidental duplicate sends)
- `application_fields` — admin-authored questionnaire per school year (form builder), with conditional-display rules
- `application_answers` — applicant answers, snapshotting label/type/order so later form edits don't rewrite submitted applications
- `applications` — one per applicant per school year; contact info, pipeline `status`, decision notes
- `pastoral_references` — one per application; pastor contact info, token, submitted answers
- `application_settings` — legacy per-school-year question config, superseded by `application_fields`/`application_answers`; no longer queried by app code, effectively vestigial

**Known drift**: `applications`, `pastoral_references`, `application_settings`, and the `application_status` enum have no `CREATE TABLE`/`CREATE TYPE` in the tracked `.sql` files — only `ALTER TABLE` migrations reference them. The `user_role` enum is also missing a tracked migration for the `'applicant'` value (`schema.sql` only defines `admin`/`group_leader`/`student`; `migration-alumni.sql` adds `alumni`, but nothing adds `applicant` even though `actions/apply.ts` sets `role: 'applicant'` in production). These were all created directly in the Supabase SQL editor at some point and never committed. If you need to reproduce this schema from scratch (new environment, disaster recovery), you'll need to pull the live definitions from Supabase (`supabase db pull` or the dashboard) rather than trusting `schema.sql` alone.

## User roles
- `admin` — full access, manages everything
- `group_leader` — read-only reporting scoped to their group only (redirected to `/leader`)
- `student` — sees own homework and submits completions
- `applicant` — set on signup via the `/apply` flow; restricted to `/apply`, `/reference`, `/reset-password` (else redirected to `/apply/status`)
- `alumni` — set when a school year is completed; restricted to `/alumni`, `/reset-password`, `/auth`, `/unsubscribe` (else redirected to `/alumni`); keeps login, can view past reflections, stops receiving emails

Row-level security enforces this at the database level. Role-based routing/redirects live in `proxy.ts`.

## Key decisions made
- **No grading or feedback** — submissions are completion-only (simplicity + trust-based)
- **Self-reported reading/video** — students check their own completion; no external API verification
- **List view over step-through** — all items visible per week, each with a complete button, rather than one-at-a-time screens
- **Optimistic UI** — HomeworkFeed updates instantly on click, then syncs to DB in the background
- **Dark mode via CSS-variable inversion** (`globals.css`) — themes the whole web app without per-component `dark:` variants; mobile mirrors this with a token system in `lib/theme.ts`
- **Applicants are gated until deposit paid** — accepted applicants only see a tuition-setup card; dashboard access requires both an activated year AND a paid deposit
- **No self-service billing cancel** — students can only update their card via a restricted Stripe billing portal; pause/cancel/refund/credit are admin-only actions
- **Mobile has no billing or application flow** — students pay and apply from the web portal only (also sidesteps Apple's In-App Purchase requirement for tuition payments)

## Environment variables
Stored in `.env.local` (gitignored). Never commit this file.
```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://ooehfpmrhuuufjaglzab.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<see .env.local>
SUPABASE_SERVICE_ROLE_KEY=<see .env.local>       # privileged server actions (admin.ts, supabase/admin.ts)

# Stripe
STRIPE_SECRET_KEY=<see .env.local>
STRIPE_WEBHOOK_SECRET=<see .env.local>

# Resend / email
RESEND_API_KEY=<see .env.local>
BILLING_ALERT_EMAILS=barp@allpeopleschurch.org    # comma-separated; payment-failure alerts

# Other
NEXT_PUBLIC_SITE_URL=https://schooloftransformation.app   # used to build absolute links in emails/redirects
CRON_SECRET=<see .env.local>                      # bearer-token auth for the Vercel cron keepalive route
```

## Running locally
```bash
cd apps/web
npm run dev
# → http://localhost:3000
```

## What's built
Full detail lives in [`docs/plan.md`](../../docs/plan.md); short version — auth/roles, student dashboard (this week, history, billing, announcements), the full admissions pipeline (public apply flow, admin-authored form builder, pastoral reference step, pipeline stages), admin panel (curriculum, students, finances, reports, announcements), Stripe billing (deposit + subscription, pause/resume/credit/refund/cancel, offline cash/check payments), weekly email digest via Resend, dark mode (web + mobile), and a companion Expo mobile app (see `apps/mobile/CLAUDE.md`).

**Recently shipped** (this session): login page background image (web + mobile), and the admin billing panel now shows Pause/Apply credit/Refund/Cancel billing in a disabled state (instead of hidden) before a student has a billing account.

For what's still open (Stripe go-live checklist, Resend domain verification, CSV import, mobile app store submission, push notifications), see the "What's Next" section of `docs/plan.md`.

## Supabase notes
- The `handle_new_user` trigger auto-creates a profile row when a new auth user is created
- New users default to `student` role — admin must manually update role in SQL or the admin UI
- Email invite rate limit can be hit during testing; manually set passwords via Supabase dashboard → Authentication → Users → Edit user
- Always use `public.` prefix in trigger/function bodies to avoid schema resolution issues
- See "Known drift" above — some tables/enums exist in production but aren't captured in the tracked `.sql` files

## Portability / migrating off Supabase
The app is designed to be portable. Lock-in surface is small:

**What's fully portable**
- `supabase/schema.sql` + `migration-*.sql` — plain PostgreSQL DDL; runs on any Postgres host (Neon, self-hosted, etc.) — but see "Known drift" above, this is not the complete live schema
- All app data — standard `pg_dump` captures everything in `public.*`
- RLS policies — standard PostgreSQL syntax

**Supabase-specific things that need replacement**
- `auth.users` table — managed by Supabase, outside the public schema. Export with `supabase/export-auth-users.sql` (bcrypt hashes are portable)
- `auth.uid()` — used throughout RLS policies. On a non-Supabase stack, replace with `current_setting('app.current_user_id', true)::uuid` and set that variable in your auth middleware at session start
- `@supabase/supabase-js` client — used throughout for both DB queries and auth; swap for `postgres.js` + Auth.js (or Lucia) on another stack
- Supabase Storage (`homework-uploads` bucket for reflection photo uploads) — swap for S3/R2 + signed URLs
