# travel-web Architecture and Features

## 1. Project Goal

`travel-web` is a personal travel planning workspace for a fictional sample trip. The codebase supports read-only viewer access, password-protected editor/admin sessions, trip planning, place management, route uploads, weather caching, notes, and checklists without storing real travel details in source control.

## 2. Current Phase

As of Tuesday, August 11, 2026, the repository contains:

- Phase 1 foundations: auth, sessions, D1 bootstrap, settings, shared UI shell
- Phase 2 additions: trip domain models, trip editor, map view, weather cache flow, notes, checklists, and supporting APIs

## 3. Tech Stack

- TypeScript
- React 19
- Vite
- React Router
- Cloudflare Workers
- Cloudflare D1
- Wrangler
- Vitest
- ESLint
- Prettier
- MapLibre GL JS

## 4. Frontend Routes

- `/` dashboard
- `/trip` published/viewer trip view
- `/admin` admin landing page
- `/admin/trip` trip editor
- `/map` route and place map
- `/weather` weather and alert view
- `/checklists` shared checklist management
- `/notes` markdown-backed notes
- `/settings` app settings
- `/login` editor/admin login

Viewer mode is the default when no editor/admin session exists. `ProtectedRoute` now means “viewer or better”, not “must be logged in”.

## 5. Worker Entry and Middleware

- Entry: `worker/index.ts`
- CORS:
  - handled before normal dispatch
  - allows `http://localhost:5173`
  - allows `http://127.0.0.1:5173`
  - supports credentialed requests
- Session flow:
  - no cookie: viewer-mode session payload
  - valid cookie: editor/admin session payload
- Main API groups:
  - auth
  - settings
  - dashboard
  - trips/days
  - places/day-places
  - routes
  - weather/alerts/refresh
  - notes
  - checklists
  - map

All responses use the shared envelope:

```json
{
  "ok": true,
  "data": {},
  "error": null
}
```

## 6. Data Model

### Core app tables

- `app_settings`
- `users`
- `sessions`
- `audit_log`

### Trip domain tables

- `trips`
  - `id`
  - `name`
  - `description`
  - `status`
  - `published_version`
  - `draft_version`
  - `created_at`
  - `updated_at`
- `trip_days`
  - `id`
  - `trip_id`
  - `day_number`
  - `title`
  - `summary`
  - `estimated_distance_km`
  - `estimated_drive_minutes`
  - `google_maps_url`
  - `enabled`
  - `sort_order`
  - `created_at`
  - `updated_at`
- `places`
  - `id`
  - `name`
  - `place_type`
  - `latitude`
  - `longitude`
  - `description_markdown`
  - `official_url`
  - `google_maps_url`
  - `weather_enabled`
  - `enabled`
  - `created_at`
  - `updated_at`
- `day_places`
  - `id`
  - `trip_day_id`
  - `place_id`
  - `visit_order`
  - `planned_arrival_text`
  - `planned_duration_minutes`
  - `note_markdown`
  - `created_at`
  - `updated_at`
- `routes`
  - `id`
  - `trip_day_id`
  - `name`
  - `geojson`
  - `style_json`
  - `enabled`
  - `created_at`
  - `updated_at`
- `notes`
  - `id`
  - `trip_id`
  - `category`
  - `title`
  - `content_markdown`
  - `sort_order`
  - `enabled`
  - `created_at`
  - `updated_at`
- `checklist_items`
  - `id`
  - `trip_id`
  - `list_type`
  - `category`
  - `title`
  - `quantity`
  - `priority`
  - `status`
  - `note`
  - `sort_order`
  - `created_at`
  - `updated_at`

### Weather cache tables

- `weather_snapshots`
  - `id`
  - `place_id`
  - `current_temperature`
  - `apparent_temperature`
  - `weather_code`
  - `precipitation_probability`
  - `precipitation`
  - `wind_speed`
  - `wind_gust`
  - `wind_direction`
  - `daily_high`
  - `daily_low`
  - `sunrise`
  - `sunset`
  - `fetched_at`
  - `source`
  - `stale`
  - `fetch_error`
- `weather_alerts`
  - `id`
  - `place_id`
  - `event`
  - `severity`
  - `urgency`
  - `headline`
  - `description`
  - `instruction`
  - `official_url`
  - `effective_at`
  - `expires_at`
  - `fetched_at`

## 7. Table Relationships

- one `trip` has many `trip_days`
- one `trip_day` has many `day_places`
- one `day_place` points to one `place`
- one `trip_day` has many `routes`
- one `trip` has many `notes`
- one `trip` has many `checklist_items`
- weather snapshots are linked to `places`
- weather alerts are linked to `places` when available

## 8. Trip Editing Flow

The current admin workflow supports real editing for trips, days, places, day-place assignments, and routes directly inside `/admin/trip`:

1. Editor/admin opens `/admin/trip`
2. Create or select a trip
3. Edit the trip name, description, and status
4. Add days, then edit day title, summary, distance, drive time, Google Maps URL, and enabled state
5. Create reusable places in the place library
6. Search place names through the Worker-backed MapTiler geocoder, select a result, and edit place name, type, coordinates, markdown, URLs, weather flag, and enabled state
7. Attach places to days with arrival text, duration, and note metadata
8. Add a sample route to a day, then edit route name, GeoJSON, style JSON, and enabled state
9. Review the MapTiler-backed map preview for the currently selected trip
10. Publish the trip

The current UI now covers the core Phase 2 authoring workflow in one place. It is still intentionally simple and does not yet include advanced drag-and-drop ordering, rich route drawing tools, or snapshot publishing.

## 9. Draft and Publish Strategy

The repository uses a simplified publish model:

- records auto-save directly into the live tables
- `draft_version` increments on trip updates
- publishing marks the trip as `published`
- `published_version` is updated to the current `draft_version`

This is not a full immutable snapshot system. Viewer mode currently reads the latest records for the published trip. That keeps the implementation manageable for this phase, but it means published content is not isolated from later draft edits. This limitation should be considered if a stricter publish workflow is needed in a future phase.

## 10. Sync and Conflict Strategy

The project uses shared D1-backed state across devices.

- writes update `updated_at`
- frontend pages fetch fresh data on load
- manual refresh is available on weather and admin workflows
- update requests may send `expectedUpdatedAt`
- if the stored record changed, the API returns `409 Conflict`

The conflict model is last-write-wins with explicit detection. Silent overwrites are avoided when `expectedUpdatedAt` is supplied.

## 11. Authentication and Authorization

### Viewer mode

- available without a password
- can browse published data, notes, checklists, map, and weather
- cannot trigger protected write endpoints

### Editor mode

- password-protected with `EDITOR_PASSWORD_HASH`
- can create and edit trip content
- can refresh weather manually

### Admin mode

- password-protected with `AUTH_PASSWORD_HASH`
- currently inherits editor write power
- uses the same login form as editor mode, but resolves to the admin role when the admin password matches
- reserved for future restore/import/export/admin-only operations

## 12. CSRF Strategy

State-changing requests use:

- `SameSite=Lax` cookies
- `HttpOnly`
- `Secure`
- `X-CSRF-Token`

Viewer mode does not need a CSRF token because it does not own a write-capable session.

## 13. MapLibre Integration

The map page uses MapLibre GL JS with:

- a MapTiler-hosted style URL
- day route GeoJSON from D1
- markers created from `places`
- weather summaries from cached weather snapshots

### MapTiler Key Injection

- the runtime expects `MAPTILER_API_KEY`
- the Worker builds a style URL when the key is present
- the frontend shows a configuration error when the key is missing
- `/admin/trip` uses the same Worker-provided MapTiler style URL for live trip preview
- because the map key is public in browser usage, domain restrictions should be configured in MapTiler

### Basemap Caching

- MapTiler tiles are fetched directly by the browser/provider
- the app does not persist third-party basemap tiles in D1, KV, or R2
- business data remains D1-backed and can be refreshed independently

## 14. GeoJSON Import and Validation

Route creation and updates validate:

- JSON parse success
- geometry type is `LineString` or `MultiLineString`
- coordinate ranges are valid
- payload size stays under the configured limit

This validation is performed server-side in `worker/lib/validation.ts`.

## 15. Google Maps URL Generation

Two helper paths exist:

- place search URLs
- day directions URLs for ordered stop chains

The helpers properly encode place names and lat/lon values before building Google Maps URLs.

## 16. Weather Flow

### Open-Meteo

- fetched server-side
- no API key required
- cached into `weather_snapshots`
- current conditions and single-day forecast values are stored

### NWS Alerts

- fetched server-side
- `User-Agent` comes from configuration
- alerts are cached into `weather_alerts`
- original official URLs are preserved when returned by the API

### Refresh Policy

- settings support `30` or `60` minute intervals
- manual refresh is editor/admin only
- refresh skips when cached data is still inside the selected interval
- stale cache behavior preserves older successful data on failures

### Cron

The current Worker code is prepared for server-side refresh behavior, but a full scheduled refresh path is still a follow-up item. Manual refresh and D1 cache persistence are already implemented.

## 17. Notes and Checklists

Notes and checklist items are editable through dedicated pages.

- Notes use safe Markdown rendering
- Checklist items support statuses such as `pending`, `packed`, and `purchased`
- Viewer mode reads them without a password
- Editor/admin sessions can create and update them

## 18. API Surface in This Phase

- `GET /api/dashboard`
- `GET|POST /api/trips`
- `GET|PUT|DELETE /api/trips/:id`
- `POST /api/trips/:id/publish`
- `GET|POST /api/trips/:id/days`
- `PUT|DELETE /api/days/:id`
- `POST /api/days/:id/copy`
- `POST /api/days/reorder`
- `GET|POST /api/places`
- `PUT|DELETE /api/places/:id`
- `GET /api/geocoding?q=...`
- `POST /api/days/:id/places`
- `DELETE /api/day-places/:id`
- `POST /api/day-places/reorder`
- `GET|POST /api/days/:id/routes`
- `PUT|DELETE /api/routes/:id`
- `GET|POST /api/notes`
- `PUT|DELETE /api/notes/:id`
- `GET|POST /api/checklists`
- `PUT|DELETE /api/checklists/:id`
- `GET /api/map`
- `GET /api/weather`
- `GET /api/weather/alerts`
- `POST /api/weather/refresh`

## 19. Testing

Current automated coverage includes:

- auth/session helpers
- viewer-mode session fallback
- CORS handling
- settings permissions
- frontend route behavior

Phase-2-specific parsing and CRUD coverage is only partially represented right now. The codebase is ready for additional tests around route validation, weather parsing, conflict flows, and markdown safety.

## 20. Known Limitations

- the trip admin UI is functional and now supports core CRUD editing, but it is still intentionally lightweight
- publish is a marker-based workflow, not a snapshot-based workflow
- weather scheduling is not fully automated yet
- the map bundle is large because MapLibre is loaded for client rendering
- trip/day/place ordering still does not expose every advanced editing interaction from the phase brief

## 21. Troubleshooting

- If editor/admin login fails, verify the password hashes in `.dev.vars`.
- If the map page shows a configuration error, confirm `MAPTILER_API_KEY` is set.
- The place editor uses the same Worker-side `MAPTILER_API_KEY` for forward geocoding. Restrict production keys with MapTiler Allowed HTTP origins to the deployed Cloudflare domain and required local development origins.
- If weather refresh does not run, verify the session has editor/admin access and a valid CSRF token.
- If a write request returns `409`, reload the latest record and retry with a fresh `expectedUpdatedAt`.
- If route uploads fail, validate the GeoJSON geometry type and payload size first.

## 22. How to Add a Safe Example Trip

Use only fictional placeholders such as:

- `Example Mountain Loop`
- `Day 1`
- `Sample Scenic Point`
- `Example Viewpoint`

Do not commit:

- real hotel names tied to an actual booking
- real travel dates
- real home addresses
- real phone numbers
- real routes that identify a personal itinerary
