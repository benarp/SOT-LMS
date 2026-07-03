-- Migration: Stripe billing
-- Run in Supabase SQL editor or via `supabase db query --linked -f`
--
-- One billing account per student per school year. Money is stored in cents.
-- Stripe is the source of truth for charges; these tables mirror state for
-- fast dashboard reads and keep an audit trail of every billing event.

create table billing_accounts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references profiles on delete cascade,
  school_year_id uuid not null references school_years on delete cascade,
  stripe_customer_id text not null,
  stripe_subscription_id text,
  -- pending: checkout not completed · active: paying · paused: admin-paused
  -- overdue: a charge failed · cancelled: admin-cancelled · completed: all 10 cycles paid
  status text not null default 'pending'
    check (status in ('pending', 'active', 'paused', 'overdue', 'cancelled', 'completed')),
  deposit_paid boolean not null default false,
  cycles_paid int not null default 0,
  total_collected_cents int not null default 0,
  credits_applied_cents int not null default 0,
  -- when the monthly cycle actually starts (trial end); used to compute
  -- expected cycles → outstanding balance without manual bookkeeping
  monthly_starts_at timestamptz,
  paused_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, school_year_id)
);

create table billing_events (
  id uuid primary key default gen_random_uuid(),
  billing_account_id uuid not null references billing_accounts on delete cascade,
  -- deposit_paid, payment_succeeded, payment_failed, paused, resumed,
  -- credit_applied, cancelled, completed, refund_issued, card_updated
  type text not null,
  amount_cents int,
  stripe_object_id text,   -- payment_intent / invoice / refund id for cross-reference
  notes text,              -- e.g. "Merit scholarship — approved by Ben"
  created_by uuid references profiles, -- null = webhook/system
  created_at timestamptz not null default now()
);

create index billing_events_account_idx on billing_events (billing_account_id, created_at desc);

alter table billing_accounts enable row level security;
alter table billing_events enable row level security;

-- Students see their own billing account; admins see and manage everything.
-- All writes go through the service-role client (server actions + webhook),
-- so no student write policies exist.
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
