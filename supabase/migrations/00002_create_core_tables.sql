-- Updated at trigger function (reused by multiple tables)
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================
-- Objectives
-- ============================================================
create table objectives (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references pm_profiles(id) not null,
  title text not null,
  status text not null default 'active',
  decomposition jsonb not null default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table objectives enable row level security;

create policy "PMs read own objectives"
  on objectives for select using (auth.uid() = pm_id);
create policy "PMs insert own objectives"
  on objectives for insert with check (auth.uid() = pm_id);
create policy "PMs update own objectives"
  on objectives for update using (auth.uid() = pm_id);

create trigger objectives_updated_at
  before update on objectives
  for each row execute procedure update_updated_at_column();

-- ============================================================
-- Matches
-- ============================================================
create table matches (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid references objectives(id) not null,
  pm_id uuid references pm_profiles(id) not null,
  source text not null,
  source_timestamp timestamptz,
  account text,
  content_summary text not null,
  original_content text,
  source_language text default 'en',
  speaker_role text,
  source_reference jsonb,
  relevance_score numeric not null,
  explanation text not null,
  category text not null,
  urgency text not null,
  cluster_id uuid,
  feedback text default 'pending',
  feedback_at timestamptz,
  created_at timestamptz default now()
);

alter table matches enable row level security;

create policy "PMs read own matches"
  on matches for select using (auth.uid() = pm_id);
create policy "PMs insert own matches"
  on matches for insert with check (auth.uid() = pm_id);
create policy "PMs update own matches"
  on matches for update using (auth.uid() = pm_id);

-- ============================================================
-- PM Feedback
-- ============================================================
create table pm_feedback (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references pm_profiles(id) not null,
  match_id uuid references matches(id) not null,
  objective_id uuid references objectives(id) not null,
  signal_content_summary text,
  match_explanation text,
  feedback_type text not null,
  created_at timestamptz default now()
);

alter table pm_feedback enable row level security;

create policy "PMs read own feedback"
  on pm_feedback for select using (auth.uid() = pm_id);
create policy "PMs insert own feedback"
  on pm_feedback for insert with check (auth.uid() = pm_id);

-- ============================================================
-- Shared Patterns
-- ============================================================
create table shared_patterns (
  id uuid primary key default gen_random_uuid(),
  pattern_description text not null,
  source_type text not null,
  source_subtype text,
  category text,
  confirmations integer default 0,
  dismissals integer default 0,
  confidence numeric generated always as (
    case when confirmations + dismissals > 0
    then confirmations::numeric / (confirmations + dismissals)
    else 0 end
  ) stored,
  contributing_pm_ids uuid[],
  created_by uuid references pm_profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table shared_patterns enable row level security;

create policy "All PMs read patterns"
  on shared_patterns for select using (true);
create policy "Authenticated PMs insert patterns"
  on shared_patterns for insert with check (auth.uid() is not null);
create policy "Authenticated PMs update patterns"
  on shared_patterns for update using (auth.uid() is not null);

create trigger shared_patterns_updated_at
  before update on shared_patterns
  for each row execute procedure update_updated_at_column();

-- ============================================================
-- Indexes
-- ============================================================
create index idx_objectives_pm on objectives(pm_id, status);
create index idx_matches_objective on matches(objective_id, created_at desc);
create index idx_matches_pm_feedback on matches(pm_id, feedback);
create index idx_patterns_confidence on shared_patterns(confidence);
create index idx_feedback_pm on pm_feedback(pm_id, objective_id);
create index idx_feedback_recent on pm_feedback(pm_id, created_at desc);
