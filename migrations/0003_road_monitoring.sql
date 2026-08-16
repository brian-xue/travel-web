CREATE TABLE IF NOT EXISTS road_monitors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  official_url TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('api', 'json', 'rss', 'html', 'manual', 'unsupported')),
  parser_type TEXT NOT NULL CHECK (parser_type IN ('generic_json', 'generic_rss', 'keyword_html', 'custom_adapter', 'manual_only')),
  parser_config_json TEXT NOT NULL DEFAULT '{}',
  update_mode TEXT NOT NULL CHECK (update_mode IN ('paused', 'daily', 'hourly')),
  minimum_interval_minutes INTEGER NOT NULL DEFAULT 60 CHECK (minimum_interval_minutes >= 1),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  manual_status_override TEXT CHECK (manual_status_override IN ('open', 'open_with_caution', 'delayed', 'restricted', 'partially_closed', 'closed', 'seasonal_closure', 'unknown', 'fetch_failed', 'manual_review_required')),
  manual_note TEXT NOT NULL DEFAULT '',
  last_attempt_at TEXT,
  last_success_at TEXT,
  last_changed_at TEXT,
  last_error_code TEXT,
  last_error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS road_status_snapshots (
  id TEXT PRIMARY KEY,
  road_monitor_id TEXT NOT NULL,
  normalized_status TEXT NOT NULL CHECK (normalized_status IN ('open', 'open_with_caution', 'delayed', 'restricted', 'partially_closed', 'closed', 'seasonal_closure', 'unknown', 'fetch_failed', 'manual_review_required')),
  severity TEXT NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical', 'unknown')),
  summary TEXT NOT NULL DEFAULT '',
  source_updated_at TEXT,
  fetched_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  raw_excerpt TEXT NOT NULL DEFAULT '',
  raw_payload_json TEXT NOT NULL DEFAULT '{}',
  is_manual INTEGER NOT NULL DEFAULT 0 CHECK (is_manual IN (0, 1)),
  created_at TEXT NOT NULL,
  FOREIGN KEY (road_monitor_id) REFERENCES road_monitors(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS road_monitor_day_links (
  id TEXT PRIMARY KEY,
  road_monitor_id TEXT NOT NULL,
  trip_day_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (road_monitor_id) REFERENCES road_monitors(id) ON DELETE CASCADE,
  FOREIGN KEY (trip_day_id) REFERENCES trip_days(id) ON DELETE CASCADE,
  UNIQUE (road_monitor_id, trip_day_id)
);

CREATE TABLE IF NOT EXISTS road_manual_confirmations (
  id TEXT PRIMARY KEY,
  road_monitor_id TEXT NOT NULL,
  confirmed_status TEXT NOT NULL CHECK (confirmed_status IN ('open', 'open_with_caution', 'delayed', 'restricted', 'partially_closed', 'closed', 'seasonal_closure', 'unknown', 'fetch_failed', 'manual_review_required')),
  note TEXT NOT NULL DEFAULT '',
  confirmed_by TEXT NOT NULL,
  confirmed_at TEXT NOT NULL,
  expires_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (road_monitor_id) REFERENCES road_monitors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_road_monitors_enabled_mode ON road_monitors(enabled, update_mode);
CREATE INDEX IF NOT EXISTS idx_road_monitors_last_attempt ON road_monitors(last_attempt_at);
CREATE INDEX IF NOT EXISTS idx_road_monitors_last_success ON road_monitors(last_success_at DESC);
CREATE INDEX IF NOT EXISTS idx_road_snapshots_monitor_fetched ON road_status_snapshots(road_monitor_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_road_snapshots_hash ON road_status_snapshots(road_monitor_id, content_hash);
CREATE INDEX IF NOT EXISTS idx_road_day_links_day_sort ON road_monitor_day_links(trip_day_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_road_confirmations_expiry ON road_manual_confirmations(road_monitor_id, expires_at);
