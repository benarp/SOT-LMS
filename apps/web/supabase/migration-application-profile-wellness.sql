-- Migration: expanded applicant profile, review-step honesty ack, health &
-- wellness survey, and application_fields engine extensions (min/max select
-- counts, multi-value branching, application vs wellness form_key).

-- ── applications: expanded profile fields (fixed contact step, not authored) ──
alter table applications add column if not exists date_of_birth date;
alter table applications add column if not exists gender text check (gender in ('Male', 'Female'));
alter table applications add column if not exists address_line1 text;
alter table applications add column if not exists address_line2 text;
alter table applications add column if not exists address_region text;
alter table applications add column if not exists address_postal_code text;
alter table applications add column if not exists address_country text;
-- existing `city` column is reused as the address city
alter table applications add column if not exists profile_photo_path text;
alter table applications add column if not exists profile_photo_name text;

-- ── Review step ──
alter table applications add column if not exists honesty_acknowledged_at timestamptz;

-- ── Health & wellness survey (own submission + acknowledgment, separate
--    from the main questionnaire's) ──
alter table applications add column if not exists wellness_submitted_at timestamptz;
alter table applications add column if not exists wellness_honesty_acknowledged_at timestamptz;

-- ── application_fields: form_key discriminator (application vs wellness) ──
alter table application_fields add column if not exists form_key text not null default 'application';
alter table application_fields add constraint application_fields_form_key_check
  check (form_key in ('application', 'wellness'));
create index if not exists application_fields_year_form_idx
  on application_fields (school_year_id, form_key, sort_order);

-- ── application_fields: checkbox-group min/max select count ──
alter table application_fields add column if not exists min_select int;
alter table application_fields add column if not exists max_select int;

-- ── application_fields: multi-value branching (additive, backward
--    compatible — when present, show_if_values takes precedence over the
--    existing single-value show_if_value; OR match) ──
alter table application_fields add column if not exists show_if_values jsonb;

-- ── Storage: applicant profile photos ──
-- Private bucket; files live under <user_id>/profile-<ts>.<ext>
insert into storage.buckets (id, name, public)
values ('applicant-photos', 'applicant-photos', false)
on conflict (id) do nothing;

create policy "applicant photos: own insert" on storage.objects
  for insert with check (
    bucket_id = 'applicant-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "applicant photos: read" on storage.objects
  for select using (
    bucket_id = 'applicant-photos'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.current_user_role() = 'admin')
  );
create policy "applicant photos: own update" on storage.objects
  for update using (
    bucket_id = 'applicant-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "applicant photos: own delete" on storage.objects
  for delete using (
    bucket_id = 'applicant-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
