ALTER TABLE sync_entities
  ADD COLUMN deleted_at TIMESTAMPTZ;

ALTER TABLE sync_changes
  ADD COLUMN operation TEXT NOT NULL DEFAULT 'upsert'
  CHECK (operation IN ('upsert', 'delete'));

CREATE INDEX sync_entities_active_lookup_idx
  ON sync_entities (user_id, entity_type, client_id)
  WHERE deleted_at IS NULL;
