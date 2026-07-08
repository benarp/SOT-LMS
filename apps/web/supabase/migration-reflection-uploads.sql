-- Migration: photo/file uploads on reflection homework
-- Students can answer a reflection by typing OR by uploading a photo of
-- their handwritten journal (or a PDF). Either one completes the item.

alter table submissions add column if not exists response_file_path text;
alter table submissions add column if not exists response_file_name text;

-- Private bucket; files live under <user_id>/<item_id>-<ts>.<ext>
insert into storage.buckets (id, name, public)
values ('homework-uploads', 'homework-uploads', false)
on conflict (id) do nothing;

-- Owners manage files under their own uid prefix; admins can read everything
create policy "homework uploads: own insert" on storage.objects
  for insert with check (
    bucket_id = 'homework-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "homework uploads: read" on storage.objects
  for select using (
    bucket_id = 'homework-uploads'
    and (auth.uid()::text = (storage.foldername(name))[1] or public.current_user_role() = 'admin')
  );
create policy "homework uploads: own update" on storage.objects
  for update using (
    bucket_id = 'homework-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
create policy "homework uploads: own delete" on storage.objects
  for delete using (
    bucket_id = 'homework-uploads'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
