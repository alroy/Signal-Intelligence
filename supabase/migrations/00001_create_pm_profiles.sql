-- Create pm_profiles table
create table pm_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table pm_profiles enable row level security;

-- All authenticated users can read profiles (needed for shared patterns, cross-PM features)
create policy "Users can read all profiles"
  on pm_profiles for select
  using (true);

-- Users can only update their own profile
create policy "Users can update own profile"
  on pm_profiles for update
  using (auth.uid() = id);

-- Auto-create pm_profiles row when a new user signs up via auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.pm_profiles (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer set search_path = '';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Indexes
create index idx_pm_profiles_email on pm_profiles(email);
