ALTER TABLE matches ADD COLUMN monday_item_id text;

CREATE UNIQUE INDEX idx_matches_monday_item_id ON matches(monday_item_id)
  WHERE monday_item_id IS NOT NULL;
