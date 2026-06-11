-- Fix the new user trigger to be more defensive
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.email, ''),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Allow the trigger to insert profiles (bypasses RLS for new signups)
create policy "profiles: insert on signup" on profiles for insert with check (true);
