-- ============================================================
-- Clusters
-- ============================================================
create table clusters (
  id uuid primary key default gen_random_uuid(),
  pm_id uuid references pm_profiles(id) not null,
  account text,
  situation_summary text not null,
  combined_urgency text not null,
  created_at timestamptz default now()
);

alter table clusters enable row level security;

create policy "PMs read own clusters"
  on clusters for select using (auth.uid() = pm_id);
create policy "PMs insert own clusters"
  on clusters for insert with check (auth.uid() = pm_id);

-- Foreign key from matches.cluster_id → clusters.id
alter table matches
  add constraint fk_matches_cluster
  foreign key (cluster_id) references clusters(id);

-- ============================================================
-- Indexes
-- ============================================================
create index idx_clusters_pm on clusters(pm_id, created_at desc);
