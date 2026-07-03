# SOT-LMS — Project Plan
**Last updated:** July 2026  
**Owner:** Ben Arp, All Peoples Church

---

## What This Is

The School of Transformation (SOT) is a 9-month in-person discipleship training school (September–May), 30–50 students, single cohort moving through curriculum together. This platform supports that school — it does not replace it.

Three things it does:
1. **Homework tracking** — students see weekly assignments and mark them complete
2. **Administration** — curriculum, student management, reporting, applications
3. **Applications** — public apply flow with essay questions and pastoral reference step

Full product spec: [`docs/PRD.md`](./PRD.md)

---

## Principles

- **Trust-based** — completion is self-reported, no verification, no grades
- **Cohort model** — everyone is on the same week, no individual pacing
- **In-person first** — the platform is a coordination tool, not the school itself
- **Admin-only writes** — students and group leaders have read-only or self-service access
- **Portable** — schema is plain PostgreSQL; `supabase/export-auth-users.sql` covers auth export; migration notes in `apps/web/CLAUDE.md`

---

## Stack

| Layer | Technology |
|---|---|
| Web | Next.js (App Router), Tailwind CSS, TypeScript |
| Mobile | Expo SDK 54 (React Native) |
| Database + Auth | Supabase (PostgreSQL + RLS) |
| Email | Resend |
| Hosting | Vercel |

---

## What's Built

### Auth & Accounts
- Email/password login via Supabase
- Forgot-password flow (self-service email reset)
- Role-based routing: `admin`, `group_leader`, `student`, `applicant`
- Route protection via `proxy.ts`

### Student Dashboard
- **This Week** — current homework with progress bar, mark complete/incomplete
- **History** — past weeks are fully interactive: students can complete missed items and submit/edit reflections late (marked "Submitted late")
- **Tuition** — payment status, Stripe Checkout setup, update card on file
- **Announcements** — active announcements appear at top of dashboard

### Homework Item Types
- `Scripture Reading` — day-by-day reading list
- `Book Reading` — day-by-day reading plan
- `Video` — embedded YouTube/Vimeo player; optional BibleProject attribution; falls back to external link for non-embeddable URLs
- `Reflection` — typed response prompt; saving the response completes the item. Book reflections are just reflection items in the curriculum (the standalone Book Reflections feature was removed July 2026)

### Announcements & Weekly Email
- Admin creates announcements with title, body, and scheduled publish date
- **Weekly email** sends to all enrolled students via Resend
  - Includes upcoming week title, due date, homework items, and active announcements
  - Send log with "last sent" date and warning before re-sending within 5 days
  - Per-student unsubscribe token; opted-out students are skipped
  - Test send (to `barp@allpeopleschurch.org`) before sending to all

### Application Process
- Public apply flow at `/apply`, gated by application open/close dates per school year
- Step 1: Questionnaire (name, phone, city, 5 essay questions, agreement checkbox)
- Step 2: Pastoral reference (pastor's name, email, church → system emails unique link)
- Pastor fills 4 reference questions on a public page (no login required)
- Admin reviews at `/admin/applications` — accept or decline with optional notes
- Accept → role upgrades to `student`, acceptance email sent
- Decline → decline email sent
- Application question prompts and agreement text are editable per school year at `/admin/applications/settings`
- Accepted applicants are enrolled in the school year their application was for, not necessarily the currently active year

### Admin — Curriculum
- Create and manage school years at `/admin/settings`
- Set one school year as active (drives all student-facing views)
- Set application open/close dates per school year
- Add weeks (numbered, titled, due date)
- Per-week: add/edit/delete homework items of any type

### Admin — School Year Lifecycle
- **Complete a year** — all current students become alumni; they keep login and can view past reflections but stop receiving emails and don't appear in next year's cohort
- **Reopen year** — undo completion if triggered by mistake
- Application cycle is decoupled from the active year (can accept applications for next year while current year is still running)

### Admin — Students
- Full user management table: sortable/filterable, CSV export
- Per-student detail page: edit name/email, change role, assign group, deactivate/reactivate, send password setup/reset email
- **Impersonation** — view the app as any student for support; persistent banner while active; start/end recorded in `audit_log`
- Audit log records: impersonation, role changes, deactivations, invites, profile edits, billing actions
- Payment status column shows live billing status per student

### Admin — Billing & Finances (Stripe)
- Stripe Checkout: $400 deposit at signup + $200/month × 10 subscription (30-day trial gap); webhook auto-cancels after cycle 10
- Per-student billing panel: pause, resume, apply credit/scholarship (with required note), cancel, refund (full or partial, per charge), payment history
- Students can only update their card (restricted Stripe billing portal) — no self-service cancel
- `/admin/finances`: summary cards (collected, outstanding, active, needs-attention), student-level table, CSV export
- Outstanding balance is derived (expected cycles vs. paid), so paused/failed months are always accurate
- Payment-failure emails to `BILLING_ALERT_EMAILS`
- Acceptance email links straight to the tuition setup page

### Admin — Reports
- Completion rates by week, student, and group
- Late submission tracking
- Per-week detail table (`/admin/reports/[weekId]`): student × item grid with reflection answers inline, Cmd+F-friendly

### Group Leader View
- Scoped to their assigned group only
- Per-student completion rates
- No write access

### Mobile App (Expo)
- Login screen
- This Week — homework checklist with announcements
- Item detail — embedded YouTube/Vimeo player, day-by-day reading, reflection response box
- History — past weeks with completion state
- Account settings
- EAS build profiles configured for cloud dev builds
- Fixed: YouTube embed errors 153/154 in WebView; non-embeddable URLs open externally

---

## What's Next

### 1. Stripe Go-Live (manual setup)
The Stripe billing code is fully built (July 2026). Before the first real charge, one-time setup:

1. Create the Stripe account for All Peoples Church / SOT and grab API keys
2. Set env vars in Vercel **and** `.env.local`:
   ```
   STRIPE_SECRET_KEY=sk_live_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   BILLING_ALERT_EMAILS=barp@allpeopleschurch.org,<finance person>
   ```
3. In the Stripe dashboard, add a webhook endpoint pointing to
   `https://<production-domain>/api/stripe/webhook` with events:
   `checkout.session.completed`, `invoice.payment_succeeded`,
   `invoice.payment_failed`, `customer.subscription.deleted`,
   `customer.subscription.updated` — copy its signing secret into `STRIPE_WEBHOOK_SECRET`
4. Configure Stripe dunning/retry settings (Settings → Billing → Revenue recovery)
5. Test end-to-end with test keys + Stripe test cards before switching to live keys

Deposit refund policy: admin's discretion, via the Refund button on the student's billing panel.

---

### 2. Resend Domain Verification
Code is complete. Email sends work but use `onboarding@resend.dev` as the sender.

**Steps:**
1. Add `allpeopleschurch.org` DNS records in Resend dashboard
2. Update `FROM_EMAIL` in:
   - `apps/web/src/app/actions/apply.ts`
   - `apps/web/src/app/actions/email.ts`
3. Add `RESEND_API_KEY` to Vercel environment variables

---

### 3. CSV Student Import
Admin students page has a UI placeholder. Bulk import not yet implemented.

**Spec:**
- Upload CSV with columns: `name`, `email`, (optionally `group`)
- Preview imported rows before confirming
- Creates accounts and sends password setup emails in bulk
- Skips rows where email already exists; reports errors

---

### 4. Mobile App Store Submission
EAS build profiles are configured. Blocked on Apple Developer account.

**Steps:**
1. Enroll in Apple Developer Program ($99/year)
2. Configure signing in EAS with Apple credentials
3. Submit to App Store via `eas submit`
4. Google Play submission can follow same EAS workflow

---

### 5. Push Notifications
Not started. Would notify students when new homework is posted or an announcement is published.

**Scope:**
- Expo Push Notifications API
- Admin triggers notification when publishing a new week or announcement
- Opt-out stored on profile

---

## Database Schema Summary

| Table | Purpose |
|---|---|
| `profiles` | Extends Supabase auth; role, name, group assignment, unsubscribe token |
| `school_years` | One active at a time; has application window dates and completion state |
| `groups` | Small groups, each with a leader |
| `weeks` | Numbered weeks per school year, each with a `due_date` |
| `homework_items` | Assignments per week (type, title, content, URL, sort order) |
| `submissions` | Completion records (student × homework item); has `is_late` flag and `response_text` for Reflection type |
| `announcements` | Admin-published; `publish_at` supports scheduling; `target_group_id` null = all students |
| `applications` | One per applicant per school year; stores all essay answers |
| `pastoral_references` | One per application; token, pastor answers, completion status |
| `application_settings` | Per-school-year question prompts and agreement text |
| `email_log` | Records each weekly email send to prevent accidental duplicates |
| `audit_log` | Records admin actions: impersonation, role changes, deactivation, invites, profile edits |
| `billing_accounts` | One per student per school year; Stripe customer/subscription IDs, status, cycles paid, totals |
| `billing_events` | Audit trail of every charge, failure, pause/resume, credit, and refund |
