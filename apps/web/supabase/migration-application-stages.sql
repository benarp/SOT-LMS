-- Migration: application pipeline stages
-- draft → reference_requested → interview → approved / denied
-- (replaces the old 'submitted' status; admin can waive the reference)

alter type application_status add value if not exists 'reference_requested';
alter type application_status add value if not exists 'interview';

alter table applications add column if not exists reference_waiver_note text;

-- No rows exist with 'submitted' yet, but remap for safety
update applications set status = 'reference_requested' where status = 'submitted';
