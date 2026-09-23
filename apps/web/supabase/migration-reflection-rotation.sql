-- Migration: remember which way up a journal photo should be shown
-- Students photograph their handwritten journals, and a phone that strips or
-- misreports EXIF orientation lands the page sideways. An admin straightens it
-- once in the reflection drawer and everyone — the admin, the group leader, and
-- the student on their own dashboard — sees it upright from then on.

alter table submissions
  add column if not exists response_file_rotation smallint not null default 0;

-- Clockwise degrees; anything else would break the viewer's geometry.
alter table submissions
  drop constraint if exists submissions_response_file_rotation_check;
alter table submissions
  add constraint submissions_response_file_rotation_check
  check (response_file_rotation in (0, 90, 180, 270));

-- No new RLS policy on purpose. Admins hold select-only on other students'
-- submissions, and Postgres RLS grants update per row rather than per column —
-- an "admins may update" policy would also let them rewrite a student's
-- reflection text. The rotate action uses the service-role client instead, so
-- this one field is the only thing an admin can write on someone else's row.
