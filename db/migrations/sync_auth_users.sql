-- Function to handle syncing auth.users to public.users
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, name, username, role, password_hash)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.email,
    'cashier', -- Default role for new signups
    'supabase_auth_managed' -- Placeholder for password_hash
  )
  on conflict (id) do update
  set name = coalesce(excluded.name, public.users.name),
      username = excluded.username;
  return new;
end;
$$ language plpgsql security definer;

-- Trigger to sync users on insert or update
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Manually sync existing auth users to public.users
insert into public.users (id, name, username, role, password_hash)
select
  id,
  coalesce(raw_user_meta_data->>'full_name', email),
  email,
  'cashier',
  'supabase_auth_managed'
from auth.users
on conflict (id) do nothing;
