-- Intentionally no FK: recovery evidence must survive physical account deletion.
CREATE TABLE account_deletion_receipts (
    secret_hash TEXT PRIMARY KEY CHECK (secret_hash ~ '^[a-f0-9]{64}$'),
    deleted_user_id TEXT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL CHECK (expires_at > completed_at)
);
CREATE INDEX account_deletion_receipts_expiry_idx ON account_deletion_receipts (expires_at);
