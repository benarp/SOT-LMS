-- SOT-LMS Database Schema
-- Run this in the Supabase SQL editor (supabase.com/dashboard/project/ooehfpmrhuuufjaglzab/sql)

-- ─────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────

create type user_role as enum ('admin', 'group_leader', 'student');
create type homework_type as enum ('bible_reading', 'video', 'book_reflection', 'written');

-- ─────────────────────────────────────────
-- PROFILES (extends Supabase auth)
-- ─────────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  email text not null,
  role user_role not null default 'student',
  group_id uuid, -- assigned after groups are created
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- SCHOOL YEARS
-- ─────────────────────────────────────────

create table school_years (
  id uuid primary key default gen_random_uuid(),
  name text not null, -- e.g. "2025–2026"
  start_date date not null,
  end_date date not null,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- GROUPS (discipleship groups)
-- ─────────────────────────────────────────

create table groups (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references school_years on delete cascade,
  name text not null,
  leader_id uuid references profiles on delete set null, -- the group leader
  created_at timestamptz not null default now()
);

-- now we can add the FK from profiles to groups
alter table profiles add constraint profiles_group_id_fkey
  foreign key (group_id) references groups on delete set null;

-- ─────────────────────────────────────────
-- BOOKS
-- ─────────────────────────────────────────

create table books (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references school_years on delete cascade,
  title text not null,
  author text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- WEEKS
-- ─────────────────────────────────────────

create table weeks (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references school_years on delete cascade,
  week_number int not null,
  title text not null, -- e.g. "Week 1 — The Kingdom of God"
  due_date timestamptz not null,
  created_at timestamptz not null default now(),
  unique (school_year_id, week_number)
);

-- ─────────────────────────────────────────
-- HOMEWORK ITEMS (assigned to a week)
-- ─────────────────────────────────────────

create table homework_items (
  id uuid primary key default gen_random_uuid(),
  week_id uuid not null references weeks on delete cascade,
  type homework_type not null,
  title text not null,
  description text,
  external_url text,       -- for video links
  book_id uuid references books on delete set null, -- for book_reflection type
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- SUBMISSIONS (completion tracking)
-- ─────────────────────────────────────────

create table submissions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles on delete cascade,
  homework_item_id uuid not null references homework_items on delete cascade,
  completed_at timestamptz not null default now(),
  is_late boolean not null default false,
  unique (student_id, homework_item_id)
);

-- ─────────────────────────────────────────
-- BOOK REFLECTION SUBMISSIONS
-- ─────────────────────────────────────────

create table book_reflections (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles on delete cascade,
  book_id uuid not null references books on delete cascade,
  content text,            -- typed directly
  file_url text,           -- uploaded file path in Supabase Storage
  submitted_at timestamptz not null default now(),
  unique (student_id, book_id)
);

-- ─────────────────────────────────────────
-- ANNOUNCEMENTS
-- ─────────────────────────────────────────

create table announcements (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references profiles on delete cascade,
  title text not null,
  body text not null,
  target_group_id uuid references groups on delete set null, -- null = all students
  publish_at timestamptz not null default now(),             -- supports scheduling
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────

alter table profiles enable row level security;
alter table school_years enable row level security;
alter table groups enable row level security;
alter table books enable row level security;
alter table weeks enable row level security;
alter table homework_items enable row level security;
alter table submissions enable row level security;
alter table book_reflections enable row level security;
alter table announcements enable row level security;

-- Helper: get current user's role
create or replace function current_user_role()
returns user_role as $$
  select role from profiles where id = auth.uid()
$$ language sql security definer;

-- Helper: get current user's group_id
create or replace function current_user_group_id()
returns uuid as $$
  select group_id from profiles where id = auth.uid()
$$ language sql security definer;

-- Profiles: users see their own, admins see all, group leaders see their group
create policy "profiles: own row" on profiles for select using (id = auth.uid());
create policy "profiles: admin all" on profiles for all using (current_user_role() = 'admin');
create policy "profiles: group leader sees group" on profiles for select using (
  current_user_role() = 'group_leader' and group_id = current_user_group_id()
);

-- School years: everyone can read, only admin can write
create policy "school_years: read all" on school_years for select using (auth.role() = 'authenticated');
create policy "school_years: admin write" on school_years for all using (current_user_role() = 'admin');

-- Groups: same
create policy "groups: read all" on groups for select using (auth.role() = 'authenticated');
create policy "groups: admin write" on groups for all using (current_user_role() = 'admin');

-- Books, weeks, homework items: same
create policy "books: read all" on books for select using (auth.role() = 'authenticated');
create policy "books: admin write" on books for all using (current_user_role() = 'admin');

create policy "weeks: read all" on weeks for select using (auth.role() = 'authenticated');
create policy "weeks: admin write" on weeks for all using (current_user_role() = 'admin');

create policy "homework_items: read all" on homework_items for select using (auth.role() = 'authenticated');
create policy "homework_items: admin write" on homework_items for all using (current_user_role() = 'admin');

-- Submissions: students manage their own, admins and group leaders can read
create policy "submissions: own" on submissions for all using (student_id = auth.uid());
create policy "submissions: admin read" on submissions for select using (current_user_role() = 'admin');
create policy "submissions: group leader read" on submissions for select using (
  current_user_role() = 'group_leader' and
  student_id in (select id from profiles where group_id = current_user_group_id())
);

-- Book reflections: same pattern
create policy "book_reflections: own" on book_reflections for all using (student_id = auth.uid());
create policy "book_reflections: admin read" on book_reflections for select using (current_user_role() = 'admin');
create policy "book_reflections: group leader read" on book_reflections for select using (
  current_user_role() = 'group_leader' and
  student_id in (select id from profiles where group_id = current_user_group_id())
);

-- Announcements: all authenticated users can read published ones, only admin can write
create policy "announcements: read published" on announcements for select using (
  auth.role() = 'authenticated' and publish_at <= now()
);
create policy "announcements: admin write" on announcements for all using (current_user_role() = 'admin');

-- ─────────────────────────────────────────
-- AUTO-CREATE PROFILE ON SIGNUP
-- ─────────────────────────────────────────

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
