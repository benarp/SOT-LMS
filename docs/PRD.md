# Product Requirements Document
# School of Transformation — Learning Management System

**Version:** 1.0  
**Last updated:** June 2026  
**Owner:** Ben Arp, All Peoples Church

---

## 1. Overview

### What is this?

The School of Transformation (SOT) is a 9-month in-person discipleship training school running September through May. 30–50 students attend weekly sessions together. The whole cohort moves through the same curriculum at the same pace.

This platform — the SOT-LMS — exists to support that experience, not replace it. It handles three things:

1. **Homework tracking** — students see their weekly assignments and mark them complete
2. **Administration** — the admin manages curriculum, students, and reporting
3. **Applications** — prospective students apply online, including a pastoral reference step

The platform intentionally does not grade, give feedback, or create an online learning experience. It is a coordination and accountability tool for an in-person school.

---

## 2. Users & Roles

| Role | Who | What they can do |
|---|---|---|
| **Admin** | Ben Arp (school director) | Full access — curriculum, students, reports, applications, settings |
| **Group Leader** | Small group leaders (1 per group) | Read-only view of their group's completion rates |
| **Student** | Enrolled students | See current week's homework, mark items complete, write book reflections |
| **Applicant** | Prospective students | Fill out application, provide pastoral reference, check status |

Role assignment is managed by the admin. New accounts default to `student`. Approved applicants are automatically upgraded from `applicant` to `student`.

---

## 3. Core Features

### 3.1 Student Dashboard

The primary view for enrolled students.

- **This Week** — shows the current week's homework items with a progress bar. Students mark each item complete with a single tap/click. Completing a book reflection auto-marks the matching homework item.
- **History** — past weeks with completion badges and a read-only item view
- **Book Reflections** — a persistent list of the year's books; students write and save reflections per book

**Homework item types:**
- `Scripture Reading` — day-by-day reading list (e.g., "Day 1: Genesis 1–3")
- `Book Reading` — day-by-day book reading plan
- `Video` — embedded YouTube or Vimeo player
- `Book reflection` — links to the Reflections tab for the matching book
- `Reflection` — a prompt with a typed response box; saving the response completes the item

Completion is self-reported and trust-based. No external verification.

### 3.2 Announcements

Admins create announcements with a title, body, and publish date (supports future scheduling). Active announcements appear at the top of the student dashboard and are included in the weekly email.

### 3.3 Weekly Email

From the Announcements page, the admin can:

- **Send test to me** — sends a formatted preview to `barp@allpeopleschurch.org` with `[TEST]` in the subject
- **Send weekly email** — sends to all enrolled students

The email includes the next upcoming week's title, due date, all homework items, and any active announcements. Sent via Resend. *Requires Resend account setup and domain verification for `allpeopleschurch.org`.*

Safeguards: each send is recorded in `email_log` (a "last sent" date shows next to the button, with a warning before re-sending within 5 days); every email carries a per-student unsubscribe link backed by `profiles.unsubscribe_token`, and opted-out students are skipped.

### 3.4 Application Process

A public, multi-step application flow at `/apply`.

**Applicant flow:**
1. Land on `/apply` — only accessible during the configured application window
2. Create an account (email + password)
3. **Step 1 — Questionnaire:** personal info (name, phone, city), 5 essay questions, agreement checkbox
4. **Step 2 — Pastoral reference:** enter pastor's name, email, and church → system emails the pastor a unique link
5. Application is now "submitted" — applicant sees a status page with both steps

**Pastor flow:**
- Pastor receives an email with a unique token link
- Fills out 4 reference questions on a public page (no login required)
- Submits → reference is marked complete on the applicant's status page

**Admin review:**
- All applications visible at `/admin/applications` with status, reference status, and submission date
- Click into an application to see all essay answers and the pastor's full reference
- **Accept** → applicant's role upgrades to `student`, they receive an acceptance email
- **Decline** → applicant receives a decline email
- Optional notes field included in decision emails

**Question customization:**
- The 5 essay question prompts and the agreement text are editable per school year at `/admin/applications/settings`
- Changes take effect immediately for new submissions

### 3.5 Admin Panel

#### Curriculum
- Create and manage school years at `/admin/settings`
- Set one school year as active (drives all student-facing views)
- Set application open/close dates per school year
- Add weeks (numbered, titled, with a due date)
- Per week: add/edit/delete homework items of any type
- Video and Bible reading items support a `content` field (embed URL or day-by-day reading list)

#### Students
- View all users (sortable/filterable table, CSV export); rows click through to a detail page
- Per-user detail page: edit name/email, change role, assign group, deactivate/reactivate (sign-in blocked, data kept), send password setup/reset email
- Assign students to small groups
- Invite new students by email
- View as any student (impersonation) for support — persistent banner while active, exit returns to the admin session, start/end recorded in the audit log

#### Auth & accountability
- Forgot-password flow (self-service reset via email)
- `audit_log` table records admin actions: impersonation, role changes, deactivation, invites, profile edits

#### Reports
- Completion rates by week, student, and group
- Late submission tracking

#### Group Leader View
- Scoped to their assigned group only
- Completion rates per student in their group
- No write access

---

## 4. Technical Architecture

### Stack

| Layer | Technology |
|---|---|
| Web framework | Next.js (App Router) |
| Mobile framework | Expo SDK 54 (React Native) |
| Database + Auth | Supabase (PostgreSQL + RLS) |
| Styling | Tailwind CSS |
| Email | Resend |
| Hosting (web) | Vercel |
| Language | TypeScript |

### Repo structure

```
school-of-transformation/   ← monorepo root
  apps/
    web/                    ← Next.js web app
    mobile/                 ← Expo React Native app
  docs/                     ← This file and other documentation
  package.json              ← npm workspaces root
```

### Database tables

| Table | Purpose |
|---|---|
| `profiles` | Extends Supabase auth; stores role, name, group assignment |
| `school_years` | One active at a time; has application window dates |
| `groups` | Small groups, each with a leader |
| `books` | Books assigned for the year |
| `weeks` | Numbered weeks per school year |
| `homework_items` | Assignments per week (type, title, content, URL) |
| `submissions` | Completion records (student × homework item) |
| `book_reflections` | Written reflections per student per book |
| `announcements` | Admin-published with optional future publish date |
| `applications` | One per applicant per school year; stores all essay answers |
| `pastoral_references` | One per application; has token, pastor answers, status |
| `application_settings` | Per-school-year question prompts and agreement text |

Row-level security (RLS) enforces role-based access at the database level. No data leaks between roles even if the application layer has a bug.

---

## 5. Mobile App

A React Native app (Expo) providing the student experience natively on iOS and Android.

**Screens:**
- Login
- This Week — homework checklist, announcements, tap to open item detail
- Item detail — embedded video player, day-by-day Bible reading, book reflection link
- History — past weeks with completion state
- Book Reflections — write and save reflections; auto-marks matching homework item complete

**Distribution:** Expo Go (development); App Store / Google Play (production, pending)

---

## 6. What's Pending / Not Yet Built

| Item | Notes |
|---|---|
| **Stripe billing** | Full spec in [`docs/billing-spec.md`](./billing-spec.md). $400 deposit + $200/month × 10 months. Includes pause, resume, credits, cancellation, refunds, and financial reporting. Required before first paid cohort. |
| Email (Resend) | Code is complete. Needs Resend account, domain verification for `allpeopleschurch.org`, and `RESEND_API_KEY` added to Vercel env vars |
| Mobile app store submission | Expo build configured; pending Apple Developer account and Xcode setup |
| CSV student import | Admin students page has UI placeholder; bulk import not yet implemented |
| Push notifications | Not started; would notify students of new homework or announcements |
| File uploads for reflections | Schema supports `file_url` on `book_reflections`; upload UI not built |

---

## 7. Key Decisions & Principles

- **Trust-based completion** — students self-report. No locking, no verification, no grades. The school runs on relational accountability, not software enforcement.
- **Cohort model** — everyone is on the same week. No individual pacing, no branching curriculum.
- **In-person first** — this platform supports the school; it does not deliver it. Keep the UI minimal and friction-low.
- **Admin-only writes** — only admins edit curriculum, manage students, and take application decisions. Group leaders and students have read-only or self-service access only.
- **Single active school year** — one year is active at a time. Switching activates the new year across all views simultaneously.
