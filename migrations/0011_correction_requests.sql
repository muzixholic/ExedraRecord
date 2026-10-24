CREATE TABLE IF NOT EXISTS correction_requests (
 id TEXT PRIMARY KEY,
 created_at TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('memories','portraits')),
 record_id TEXT NOT NULL,
 page_title TEXT NOT NULL,
 content TEXT NOT NULL,
 completed_at TEXT,
 client_hash TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS correction_requests_created ON correction_requests(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS correction_requests_client ON correction_requests(client_hash, created_at);
