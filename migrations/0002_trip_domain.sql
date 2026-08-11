CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  published_version INTEGER NOT NULL DEFAULT 0,
  draft_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trip_days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  estimated_distance_km REAL NOT NULL DEFAULT 0,
  estimated_drive_minutes INTEGER NOT NULL DEFAULT 0,
  google_maps_url TEXT NOT NULL DEFAULT '',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  sort_order INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  place_type TEXT NOT NULL CHECK (
    place_type IN (
      'city',
      'scenic_point',
      'lodging_city',
      'fuel',
      'food',
      'trailhead',
      'viewpoint',
      'road_checkpoint',
      'custom'
    )
  ),
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  description_markdown TEXT NOT NULL DEFAULT '',
  official_url TEXT NOT NULL DEFAULT '',
  google_maps_url TEXT NOT NULL DEFAULT '',
  weather_enabled INTEGER NOT NULL DEFAULT 0 CHECK (weather_enabled IN (0, 1)),
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS day_places (
  id TEXT PRIMARY KEY,
  trip_day_id TEXT NOT NULL,
  place_id TEXT NOT NULL,
  visit_order INTEGER NOT NULL,
  planned_arrival_text TEXT NOT NULL DEFAULT '',
  planned_duration_minutes INTEGER NOT NULL DEFAULT 0,
  note_markdown TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (trip_day_id) REFERENCES trip_days(id) ON DELETE CASCADE,
  FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS routes (
  id TEXT PRIMARY KEY,
  trip_day_id TEXT NOT NULL,
  name TEXT NOT NULL,
  geojson TEXT NOT NULL,
  style_json TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (trip_day_id) REFERENCES trip_days(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notes (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('driving', 'altitude', 'weather', 'park', 'safety', 'packing', 'custom')),
  title TEXT NOT NULL,
  content_markdown TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  list_type TEXT NOT NULL CHECK (list_type IN ('shopping', 'packing', 'car', 'document', 'custom')),
  category TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('pending', 'purchased', 'packed', 'loaded', 'skipped')),
  note TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weather_snapshots (
  id TEXT PRIMARY KEY,
  place_id TEXT NOT NULL,
  current_temperature REAL,
  apparent_temperature REAL,
  weather_code INTEGER,
  precipitation_probability REAL,
  precipitation REAL,
  wind_speed REAL,
  wind_gust REAL,
  wind_direction REAL,
  daily_high REAL,
  daily_low REAL,
  sunrise TEXT,
  sunset TEXT,
  fetched_at TEXT NOT NULL,
  source TEXT NOT NULL,
  stale INTEGER NOT NULL DEFAULT 0 CHECK (stale IN (0, 1)),
  fetch_error TEXT,
  FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS weather_alerts (
  id TEXT PRIMARY KEY,
  place_id TEXT,
  event TEXT NOT NULL,
  severity TEXT NOT NULL,
  urgency TEXT NOT NULL,
  headline TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  instruction TEXT NOT NULL DEFAULT '',
  official_url TEXT NOT NULL DEFAULT '',
  effective_at TEXT,
  expires_at TEXT,
  fetched_at TEXT NOT NULL,
  FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
CREATE INDEX IF NOT EXISTS idx_trips_updated_at ON trips(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_trip_days_trip_id ON trip_days(trip_id);
CREATE INDEX IF NOT EXISTS idx_trip_days_trip_sort ON trip_days(trip_id, sort_order, day_number);
CREATE INDEX IF NOT EXISTS idx_trip_days_enabled ON trip_days(enabled);
CREATE INDEX IF NOT EXISTS idx_trip_days_updated_at ON trip_days(updated_at);

CREATE INDEX IF NOT EXISTS idx_places_enabled ON places(enabled);
CREATE INDEX IF NOT EXISTS idx_places_weather_enabled ON places(weather_enabled);
CREATE INDEX IF NOT EXISTS idx_places_updated_at ON places(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_places_place_type ON places(place_type);

CREATE INDEX IF NOT EXISTS idx_day_places_trip_day_id ON day_places(trip_day_id);
CREATE INDEX IF NOT EXISTS idx_day_places_place_id ON day_places(place_id);
CREATE INDEX IF NOT EXISTS idx_day_places_trip_day_visit_order ON day_places(trip_day_id, visit_order);

CREATE INDEX IF NOT EXISTS idx_routes_trip_day_id ON routes(trip_day_id);
CREATE INDEX IF NOT EXISTS idx_routes_enabled ON routes(enabled);
CREATE INDEX IF NOT EXISTS idx_routes_updated_at ON routes(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_notes_trip_id ON notes(trip_id);
CREATE INDEX IF NOT EXISTS idx_notes_trip_sort ON notes(trip_id, sort_order, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_enabled ON notes(enabled);

CREATE INDEX IF NOT EXISTS idx_checklist_items_trip_id ON checklist_items(trip_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_trip_sort ON checklist_items(trip_id, sort_order, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_checklist_items_list_status ON checklist_items(list_type, status);

CREATE INDEX IF NOT EXISTS idx_weather_snapshots_place_id ON weather_snapshots(place_id);
CREATE INDEX IF NOT EXISTS idx_weather_snapshots_fetched_at ON weather_snapshots(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_snapshots_place_fetched ON weather_snapshots(place_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_snapshots_stale ON weather_snapshots(stale);

CREATE INDEX IF NOT EXISTS idx_weather_alerts_place_id ON weather_alerts(place_id);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_expires_at ON weather_alerts(expires_at);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_fetched_at ON weather_alerts(fetched_at DESC);
