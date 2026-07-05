-- Migration: application form builder (docs/form-builder-spec.md)
-- Run via `supabase db query --linked -f` or the SQL editor.

create table application_fields (
  id uuid primary key default gen_random_uuid(),
  school_year_id uuid not null references school_years on delete cascade,
  type text not null check (type in ('header', 'note', 'short_text', 'paragraph', 'yes_no', 'select', 'checkbox_group')),
  label text not null,
  help_text text,
  options jsonb,            -- string[] for select / checkbox_group
  required boolean not null default false,
  sort_order int not null default 0,
  -- single-condition branching: show when the referenced field's answer
  -- equals (or, for checkbox groups, contains) show_if_value
  show_if_field_id uuid references application_fields on delete set null,
  show_if_value text,
  created_at timestamptz not null default now()
);

create index application_fields_year_idx on application_fields (school_year_id, sort_order);

create table application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references applications on delete cascade,
  field_id uuid not null references application_fields on delete cascade,
  -- snapshot so later form edits don't rewrite submitted applications
  field_label text not null,
  field_type text not null,
  field_sort int not null default 0,
  value jsonb,              -- string | string[]
  updated_at timestamptz not null default now(),
  unique (application_id, field_id)
);

create index application_answers_app_idx on application_answers (application_id, field_sort);

alter table applications add column if not exists questionnaire_submitted_at timestamptz;

alter table application_fields enable row level security;
alter table application_answers enable row level security;

-- Fields: any signed-in user (applicants) can read; only admins write
create policy "application_fields: read" on application_fields
  for select using (auth.role() = 'authenticated');
create policy "application_fields: admin write" on application_fields
  for all using (current_user_role() = 'admin');

-- Answers: applicants manage answers on their own applications; admins read
create policy "application_answers: own" on application_answers
  for all using (
    application_id in (select id from applications where applicant_id = auth.uid())
  );
create policy "application_answers: admin read" on application_answers
  for select using (current_user_role() = 'admin');

-- ── Seed: convert each year's application_settings prompts into fields ──────
-- 5 paragraph questions + the agreement (a required single-option checkbox
-- group), under one header. Skips years that already have fields.

do $$
declare
  s record;
  ord int;
begin
  for s in select * from application_settings loop
    if exists (select 1 from application_fields where school_year_id = s.school_year_id) then
      continue;
    end if;
    ord := 1;
    insert into application_fields (school_year_id, type, label, sort_order)
      values (s.school_year_id, 'header', 'Your story', ord);
    ord := ord + 1;

    if coalesce(s.q_testimony_label, '') <> '' then
      insert into application_fields (school_year_id, type, label, help_text, required, sort_order)
        values (s.school_year_id, 'paragraph', s.q_testimony_label, nullif(s.q_testimony_hint, ''), true, ord);
      ord := ord + 1;
    end if;
    if coalesce(s.q_why_attend_label, '') <> '' then
      insert into application_fields (school_year_id, type, label, help_text, required, sort_order)
        values (s.school_year_id, 'paragraph', s.q_why_attend_label, nullif(s.q_why_attend_hint, ''), true, ord);
      ord := ord + 1;
    end if;
    if coalesce(s.q_goals_label, '') <> '' then
      insert into application_fields (school_year_id, type, label, help_text, required, sort_order)
        values (s.school_year_id, 'paragraph', s.q_goals_label, nullif(s.q_goals_hint, ''), true, ord);
      ord := ord + 1;
    end if;
    if coalesce(s.q_serving_label, '') <> '' then
      insert into application_fields (school_year_id, type, label, help_text, required, sort_order)
        values (s.school_year_id, 'paragraph', s.q_serving_label, nullif(s.q_serving_hint, ''), true, ord);
      ord := ord + 1;
    end if;
    if coalesce(s.q_additional_label, '') <> '' then
      insert into application_fields (school_year_id, type, label, help_text, required, sort_order)
        values (s.school_year_id, 'paragraph', s.q_additional_label, nullif(s.q_additional_hint, ''), false, ord);
      ord := ord + 1;
    end if;

    insert into application_fields (school_year_id, type, label, options, required, sort_order)
      values (
        s.school_year_id, 'checkbox_group', 'Agreement',
        jsonb_build_array(coalesce(nullif(s.agreement_text, ''), 'I agree to the expectations of the School of Transformation.')),
        true, ord
      );
  end loop;
end $$;
