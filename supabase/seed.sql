-- Seed data for E2E testing
-- Mimics what the Cowork plugin writes to Supabase after signal collection.

-- Well-known test UUIDs
-- PM:         aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
-- Objective1: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01
-- Objective2: bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02
-- Cluster A:  cccccccc-cccc-cccc-cccc-cccccccccc01
-- Cluster B:  cccccccc-cccc-cccc-cccc-cccccccccc02
-- Cluster C:  cccccccc-cccc-cccc-cccc-cccccccccc03

-- 1. Auth user (triggers handle_new_user which auto-creates pm_profiles row)
INSERT INTO auth.users (
  instance_id, id, aud, role, email,
  encrypted_password, email_confirmed_at,
  created_at, updated_at, confirmation_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'authenticated', 'authenticated', 'testpm@example.com',
  crypt('testpassword123', gen_salt('bf')),
  now(), now(), now(), ''
);

-- Update the auto-created profile with a name
UPDATE pm_profiles
SET name = 'Test PM'
WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- 2. Objectives
INSERT INTO objectives (id, pm_id, title, status, decomposition) VALUES
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Reduce enterprise churn in EMEA accounts',
  'active',
  '{"signal_types": ["champion_departure", "stage_regression", "competitor_mention"], "entities_to_watch": ["budget cut", "renewal", "competitor"]}'::jsonb
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Expand self-serve adoption in SMB segment',
  'active',
  '{"signal_types": ["feature_request", "onboarding_friction", "expansion_signal"], "entities_to_watch": ["API", "self-serve", "upgrade"]}'::jsonb
);

-- 3. Clusters
INSERT INTO clusters (id, pm_id, account, situation_summary, combined_urgency) VALUES
(
  'cccccccc-cccc-cccc-cccc-cccccccccc01',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Acme Corp',
  'Multiple stakeholders reporting onboarding friction during Q1 rollout',
  'act_now'
),
(
  'cccccccc-cccc-cccc-cccc-cccccccccc02',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Globex Inc',
  'Budget review conversations surfacing across sales and CS channels',
  'this_week'
),
(
  'cccccccc-cccc-cccc-cccc-cccccccccc03',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'Initech',
  'Feature requests for API access converging from engineering and product leads',
  'background'
);

-- 4. Matches — Cluster A (Acme Corp, objective 1): 3 matches
INSERT INTO matches (objective_id, pm_id, source, source_timestamp, account, content_summary, explanation, relevance_score, category, urgency, cluster_id, feedback) VALUES
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'gong', now() - interval '2 hours',
  'Acme Corp',
  'VP of Operations mentioned they are "reconsidering the rollout timeline" due to onboarding issues.',
  'Direct stakeholder expressing risk to deployment. Matches champion_departure and stage_regression signals.',
  8.5, 'risk', 'act_now',
  'cccccccc-cccc-cccc-cccc-cccccccccc01', 'pending'
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'slack', now() - interval '5 hours',
  'Acme Corp',
  'CS team flagged 3 support tickets from Acme about onboarding workflow confusion.',
  'Internal discussion confirming customer-facing friction. Correlates with Gong call.',
  7.2, 'risk', 'act_now',
  'cccccccc-cccc-cccc-cccc-cccccccccc01', 'confirmed'
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'salesforce', now() - interval '1 day',
  'Acme Corp',
  'Opportunity stage moved from "Deployed" to "At Risk" by AE.',
  'Salesforce stage regression aligns with onboarding complaints from Gong and Slack.',
  9.0, 'risk', 'act_now',
  'cccccccc-cccc-cccc-cccc-cccccccccc01', 'pending'
);

-- Cluster B (Globex Inc, objective 1): 2 matches
INSERT INTO matches (objective_id, pm_id, source, source_timestamp, account, content_summary, explanation, relevance_score, category, urgency, cluster_id, feedback) VALUES
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'gong', now() - interval '3 days',
  'Globex Inc',
  'CFO asked about contract flexibility and mentioned upcoming budget review in April.',
  'Budget uncertainty signal from key decision-maker. Potential renewal risk.',
  7.0, 'risk', 'this_week',
  'cccccccc-cccc-cccc-cccc-cccccccccc02', 'pending'
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'slack', now() - interval '2 days',
  'Globex Inc',
  'AE posted in #accounts: "Globex pushing back on renewal pricing, wants to discuss alternatives."',
  'Internal sales signal confirming budget pressure from Gong call.',
  6.8, 'risk', 'this_week',
  'cccccccc-cccc-cccc-cccc-cccccccccc02', 'pending'
);

-- Cluster C (Initech, objective 2): 2 matches
INSERT INTO matches (objective_id, pm_id, source, source_timestamp, account, content_summary, explanation, relevance_score, category, urgency, cluster_id, feedback) VALUES
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'gong', now() - interval '4 days',
  'Initech',
  'Engineering lead asked about API documentation and programmatic access for their internal tools.',
  'Direct feature request for API — aligns with self-serve expansion objective.',
  6.5, 'opportunity', 'background',
  'cccccccc-cccc-cccc-cccc-cccccccccc03', 'pending'
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'slack', now() - interval '3 days',
  'Initech',
  'Product lead mentioned Initech wants to build dashboards on top of our data via API.',
  'Confirms expansion interest from Gong call. Multi-stakeholder alignment on API need.',
  6.2, 'opportunity', 'background',
  'cccccccc-cccc-cccc-cccc-cccccccccc03', 'confirmed'
);

-- Unclustered matches (no cluster_id)
INSERT INTO matches (objective_id, pm_id, source, source_timestamp, account, content_summary, explanation, relevance_score, category, urgency, cluster_id, feedback) VALUES
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'salesforce', now() - interval '6 hours',
  'Wayne Enterprises',
  'New note: "Customer exploring competitor demo after Q4 pricing discussion."',
  'Isolated competitor mention. No corroborating signals yet.',
  5.5, 'risk', 'this_week',
  NULL, 'pending'
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'slack', now() - interval '1 day',
  'Stark Industries',
  'CSM shared positive NPS feedback: "Love the new reporting module, considering upgrade."',
  'Positive signal for expansion. Single source, not yet clustered.',
  7.8, 'opportunity', 'this_week',
  NULL, 'pending'
),
(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'gong', now() - interval '5 days',
  NULL,
  'Industry webinar attendee asked about self-serve pricing tiers.',
  'General market signal about self-serve interest. No specific account.',
  4.0, 'info', 'background',
  NULL, 'dismissed'
);
