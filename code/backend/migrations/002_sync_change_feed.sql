CREATE TABLE sync_changes (
  sequence BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('vehicle', 'fuel_entry', 'maintenance_entry')),
  entity_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX sync_changes_user_sequence_idx
  ON sync_changes (user_id, sequence);
