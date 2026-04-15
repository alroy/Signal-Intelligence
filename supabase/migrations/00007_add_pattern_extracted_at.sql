-- Track which pm_feedback rows have been processed by the pattern extraction pipeline.
-- The pattern extractor (lib/extract-patterns.ts) aggregates feedback into
-- shared_patterns rows, which the rescore pipeline (lib/rescore.ts) uses to
-- score future signals across the whole team.

alter table pm_feedback
  add column pattern_extracted_at timestamptz;

create index idx_feedback_unprocessed
  on pm_feedback(created_at)
  where pattern_extracted_at is null;
