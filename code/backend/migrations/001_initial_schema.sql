CREATE TABLE users (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK (mode IN ('guest', 'registered')),
  email TEXT UNIQUE,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    (mode = 'guest' AND email IS NULL AND password_hash IS NULL) OR
    (mode = 'registered' AND email IS NOT NULL AND password_hash IS NOT NULL)
  )
);

CREATE TABLE sync_entities (
  sequence BIGSERIAL PRIMARY KEY,
  id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('vehicle', 'fuel_entry', 'maintenance_entry')),
  client_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, entity_type, client_id),
  UNIQUE (id)
);

CREATE INDEX sync_entities_user_sequence_idx
  ON sync_entities (user_id, sequence);

CREATE INDEX sync_entities_vehicle_lookup_idx
  ON sync_entities (user_id, entity_type, client_id);
