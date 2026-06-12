@AGENTS.md

# SOT-LMS — School of Transformation Discipleship Training School

## What this is
A learning management system for an in-person discipleship training school. 30–50 students attend weekly (September–May). The whole cohort moves through the same curriculum at the same pace. The platform tracks homework completion — it does not grade, give feedback, or replace the in-person experience.

## Repo & services
- **GitHub**: https://github.com/benarp/SOT-LMS
- **Supabase project**: https://supabase.com/dashboard/project/ooehfpmrhuuufjaglzab
- **Supabase URL**: https://ooehfpmrhuuufjaglzab.supabase.co
- **Hosting**: Vercel (not yet connected — see task list)

## Tech stack
- **Framework**: Next.js 16 (App Router) — note: uses `proxy.ts` not `middleware.ts` (renamed in Next 16)
- **Database + Auth**: Supabase (PostgreSQL + row-level security)
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Project structure
```
src/
  app/
    login/          # Login page (public)
    dashboard/      # Student-facing app (protected)
      layout.tsx    # Sidebar nav, role-aware
      page.tsx      # This week's homework
      history/      # Previous weeks (TODO)
      reflections/  # Book reflections (TODO)
    admin/          # Admin panel (TODO)
    auth/callback/  # Supabase auth redirect handler
    actions/
      submissions.ts  # Server actions: markComplete, markIncomplete
  components/
    HomeworkFeed.tsx   # Interactive homework checklist
    SignOutButton.tsx  # Client component for sign out
  lib/
    supabase/
      client.ts   # Browser client
      server.ts   # Server client (uses cookies)
  proxy.ts        # Route protection + role-based redirects
supabase/
  schema.sql          # Full DB schema — run in Supabase SQL editor
  fix-trigger-v2.sql  # Fixes auto-profile trigger (already applied)
```

## Database schema (9 tables)
- `profiles` — extends auth.users; has `role` (admin/group_leader/student) and `group_id`
- `school_years` — one active at a time (`is_active = true`)
- `groups` — discipleship groups, each with a `leader_id`
- `books` — 4 books per school year, have associated reflections
- `weeks` — numbered weeks per school year, each has a `due_date`
- `homework_items` — belong to a week; types: `bible_reading` (Scripture Reading), `book_reading`, `video`, `book_reflection`, `reflection` (typed response stored in `submissions.response_text`)
- `submissions` — completion records (student_id + homework_item_id, unique); has `is_late` flag
- `book_reflections` — separate from submissions; stores typed content or `file_url`
- `announcements` — admin-published; `publish_at` supports scheduling; `target_group_id` null = all students

## User roles
- `admin` — full access, manages everything
- `group_leader` — read-only reporting scoped to their group only
- `student` — sees own homework and submits completions

Row-level security enforces this at the database level. Helper functions `current_user_role()` and `current_user_group_id()` are used in policies.

## Key decisions made
- **No grading or feedback** — submissions are completion-only (simplicity + trust-based)
- **Self-reported reading/video** — students check their own completion; no external API verification
- **Step-through vs list view** — went with a list view (all items visible, each with a complete button) rather than one-at-a-time screens; cleaner UX
- **Optimistic UI** — HomeworkFeed updates instantly on click, then syncs to DB in the background
- **mobile-responsive web first** — native app (Expo) is Phase 3

## Environment variables
Stored in `.env.local` (gitignored). Never commit this file.
```
NEXT_PUBLIC_SUPABASE_URL=https://ooehfpmrhuuufjaglzab.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<see .env.local>
```

## Running locally
```bash
cd ~/Desktop/sot-lms
npm run dev
# → http://localhost:3000
```

## What's built vs what's left
### Done
- Login page + auth (email/password via Supabase)
- Route protection (proxy.ts redirects unauthenticated users)
- Student dashboard: current week's homework, progress bar, mark complete/incomplete
- Sidebar navigation (role-aware — admin sees admin panel link)

### Still to build (in order)
1. Previous weeks view (`/dashboard/history`)
2. Book reflections (`/dashboard/reflections`)
3. Announcements (admin create + student view — student view partially wired)
4. Admin — curriculum management (school years, weeks, homework items)
5. Admin — student management (invite, CSV import, group assignment)
6. Admin — reporting dashboard (completion rates, late submissions, per-student/group)
7. Group leader scoped reporting view
8. Deploy to Vercel
9. Mobile app (Expo, Phase 3)

## Supabase notes
- The `handle_new_user` trigger auto-creates a profile row when a new auth user is created
- New users default to `student` role — admin must manually update role in SQL or future admin UI
- Email invite rate limit can be hit during testing; manually set passwords via Supabase dashboard → Authentication → Users → Edit user
- Always use `public.` prefix in trigger/function bodies to avoid schema resolution issues
