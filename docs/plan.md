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
- **History** — past weeks with completion badges, read-only item view
- **Book Reflections** — write and save reflections per book; saving auto-marks matching homework item complete
- **Announcements** — active announcements appear at top of dashboard

### Homework Item Types
- `Scripture Reading` — day-by-day reading list
- `Book Reading` — day-by-day reading plan
- `Video` — embedded YouTube/Vimeo player; optional BibleProject attribution; falls back to external link for non-embeddable URLs
- `Book Reflection` — links to the matching book in the Reflections tab
- `Reflection` — typed response prompt; saving the response completes the item

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
- Audit log records: impersonation, role changes, deactivations, invites, profile edits
- Payment status column wired (currently shows `—`; will populate when Stripe is built)

### Admin — Reports
- Completion rates by week, student, and group
- Late submission tracking

### Group Leader View
- Scoped to their assigned group only
- Per-student completion rates
- No write access

### Mobile App (Expo)
- Login screen
- This Week — homework checklist with announcements
- Item detail — embedded YouTube/Vimeo player, day-by-day reading, book reflection link
- History — past weeks with completion state
- Book Reflections — write and save; auto-marks matching homework item complete
- Account settings
- EAS build profiles configured for cloud dev builds
- Fixed: YouTube embed errors 153/154 in WebView; non-embeddable URLs open externally

---

## What's Next

### 1. Stripe Billing (highest priority)
Required before the first paid cohort. Full spec: [`docs/billing-spec.md`](./billing-spec.md)

**Pricing model**
- $400 deposit charged immediately on acceptance
- $200/month × 10 months ($2,000 remaining tuition)
- $2,400 total per student per school year

**Student experience**
- Acceptance email includes a link to a payment setup page
- Student enters card → $400 charged immediately → subscription begins
- Payment status visible on student dashboard

**Admin operations** (from student detail page)
- View status: active, paused, overdue, cancelled
- View next charge date, full payment history, outstanding balance
- **Pause** — suspends subscription; tracks outstanding balance
- **Resume** — reactivates subscription; admin chooses whether to adjust for missed payments
- **Apply credit/scholarship** — applies dollar amount as Stripe customer balance credit; includes notes field
- **Cancel** — ends future billing; does not auto-refund
- **Refund** — refund a specific charge (partial or full)

**Financial reporting** (new `/admin/finances` section)
- Summary cards: total collected, active/paused/cancelled/overdue subscriptions, outstanding balance, credits applied
- Student-level billing table with CSV export

**Database additions needed**
- `billing_accounts` — one per student per school year; Stripe customer ID, subscription ID, status, outstanding balance
- `billing_events` — log of all charges, refunds, credits

**Stripe objects**
- Customer, Payment Method, Payment Intent (deposit), Subscription, Invoice, Customer Balance, Refund

**Webhook events to handle**
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.deleted`
- `customer.subscription.updated`

**Environment variables needed**
```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

**Open questions before building**
- Stripe-hosted payment page (Payment Links) vs. embedded in the platform?
- What happens to billing if a student defers to the next school year?
- Is the $400 deposit refundable if an accepted student declines? Under what conditions?
- Who else besides Ben should receive payment failure notifications?

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

### 6. File Uploads for Book Reflections
Schema supports `file_url` on `book_reflections`. Upload UI not built.

**Scope:**
- Students can attach a file (PDF, image) alongside or instead of a typed reflection
- Upload to Supabase Storage
- Admin can view uploaded files from the student detail page

---

## Database Schema Summary

| Table | Purpose |
|---|---|
| `profiles` | Extends Supabase auth; role, name, group assignment, unsubscribe token |
| `school_years` | One active at a time; has application window dates and completion state |
| `groups` | Small groups, each with a leader |
| `books` | Books assigned for the year |
| `weeks` | Numbered weeks per school year, each with a `due_date` |
| `homework_items` | Assignments per week (type, title, content, URL, sort order) |
| `submissions` | Completion records (student × homework item); has `is_late` flag and `response_text` for Reflection type |
| `book_reflections` | Written reflections per student per book; supports `file_url` |
| `announcements` | Admin-published; `publish_at` supports scheduling; `target_group_id` null = all students |
| `applications` | One per applicant per school year; stores all essay answers |
| `pastoral_references` | One per application; token, pastor answers, completion status |
| `application_settings` | Per-school-year question prompts and agreement text |
| `email_log` | Records each weekly email send to prevent accidental duplicates |
| `audit_log` | Records admin actions: impersonation, role changes, deactivation, invites, profile edits |
| `billing_accounts` | *(pending)* One per student per school year; Stripe IDs and billing status |
| `billing_events` | *(pending)* Log of all charges, refunds, and credits |
