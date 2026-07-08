-- SOT-LMS Database Schema
-- Run this in the Supabase SQL editor (supabase.com/dashboard/project/ooehfpmrhuuufjaglzab/sql)

-- ─────────────────────────────────────────
-- ENUMS
-- ─────────────────────────────────────────

create type user_role as enum ('admin', 'group_leader', 'student');

-- ─────────────────────────────────────────
-- PROFILES (extends Supabase auth)
-- ─────────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  email text not null,
  role user_role not null default 'student',
  group_id uuid, -- assigned after groups are created
  birthday date,
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
  type text not null check (type in ('bible_reading', 'book_reading', 'video', 'reflection')),
  title text not null,
  description text,
  external_url text,       -- for video links
  content text,            -- day-by-day reading list or reflection prompt
  sort_order int not null default 0,
  show_attribution boolean not null default true,
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
  response_file_path text,  -- journal photo/PDF in the homework-uploads bucket
  response_file_name text,
  unique (student_id, homework_item_id)
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
alter table weeks enable row level security;
alter table homework_items enable row level security;
alter table submissions enable row level security;
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

-- Weeks, homework items: same
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

-- ─────────────────────────────────────────
-- BILLING (Stripe) — see migration-billing.sql
-- ─────────────────────────────────────────

create table billing_accounts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles on delete cascade,
  school_year_id uuid not null references school_years on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  status text not null default 'pending'
    check (status in ('pending', 'active', 'paused', 'overdue', 'cancelled', 'completed')),
  deposit_paid boolean not null default false,
  cycles_paid int not null default 0,
  total_collected_cents int not null default 0,
  credits_applied_cents int not null default 0,
  monthly_starts_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, school_year_id)
);

create table billing_events (
  id uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references billing_accounts on delete cascade,
  type text not null,
  amount_cents int,
  stripe_object_id text,
  notes text,
  payment_method text,  -- 'cash' | 'check', for offline_payment events
  received_by text,     -- who was handed the payment
  paid_at date,          -- when it was actually paid (may predate data entry)
  created_by uuid references profiles,
  created_at timestamptz not null default now()
);

create index billing_events_account_idx on billing_events (billing_account_id, created_at desc);

alter table billing_accounts enable row level security;
alter table billing_events enable row level security;

create policy "billing_accounts: own" on billing_accounts
  for select using (student_id = auth.uid());
create policy "billing_accounts: admin all" on billing_accounts
  for all using (current_user_role() = 'admin');
create policy "billing_events: own" on billing_events
  for select using (
    billing_account_id in (select id from billing_accounts where student_id = auth.uid())
  );
create policy "billing_events: admin all" on billing_events
  for all using (current_user_role() = 'admin');
