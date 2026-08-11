# travel-web Data Management

## Overview

This guide explains how to manage phase-two planning data in `travel-web` without placing real travel details in source code.

## 1. Create a Trip

1. Open `/admin/trip`
2. Use `Create Sample Trip`
3. Replace the fictional title and description with your own data in the `Trip Details` editor
4. Save the trip from the same page

## 2. Add a Day

1. Select the trip in `/admin/trip`
2. Use `Add Day`
3. Update the title, summary, distance, drive time, Google Maps URL, and enabled state in the day editor
4. Save the day card after each change

Use logical labels such as `Day 1`, `Day 2`, and descriptive summaries. You do not need to store exact dates.

## 3. Add a Place

1. Open `/admin/trip`
2. Use `Create Sample Place`
3. Enter a place name in `Place Library`; after at least three characters, choose a MapTiler search result to fill the full name and coordinates, or keep editing the name and latitude/longitude manually
4. Update the place type, markdown, URLs, weather flag, and enabled state
5. Save the place card after each change

Keep place details generic in sample or seeded data. Do not commit real private lodging details or personal addresses.

## 4. Attach a Place to a Day

Attach places to the relevant day with the `Add Place To Day` form so the viewer trip page and map page can show ordered stops and Google Maps links.

Recommended fields:

- arrival label such as `Morning` or `After lunch`
- duration in minutes
- short markdown note

## 5. Upload or Paste GeoJSON

Routes are stored as GeoJSON in the `routes` table.

In `/admin/trip`, create a sample route first, then edit:

- route name
- GeoJSON
- style JSON
- enabled state

Requirements:

- valid JSON
- `LineString` or `MultiLineString`
- valid coordinates
- keep the payload reasonably small

If validation fails, the Worker returns a clear error instead of saving a broken route.

## 6. Preview the Map

When `MAPTILER_API_KEY` is configured, `/admin/trip` shows a live `Map Preview` for the currently selected trip.

This preview uses:

- the current trip-day route GeoJSON
- the currently attached places
- the Worker-generated MapTiler style URL

If the preview is unavailable, verify that `MAPTILER_API_KEY` is present in `.dev.vars` or in deployed Worker secrets.

The place name search is served by the Worker using the same `MAPTILER_API_KEY`; it does not use a hardcoded browser key. For production, configure MapTiler Allowed HTTP origins to include only the deployed Cloudflare domain and necessary local development origins.

## 7. Configure Weather Points

Weather monitoring currently follows places where:

- `weather_enabled = true`
- the place itself is enabled

Use this for major stops, staging cities, scenic points, or checkpoints that matter for planning.

## 8. Publish Changes

The current publish model is lightweight:

- edits save directly into the live tables
- publishing updates the trip status and version markers

This is enough for the current phase, but it does not create an isolated immutable snapshot.

## 9. Export and Backup

Recommended backup approaches:

- export D1 data outside the app at regular intervals
- keep SQL migrations in source control
- retain manual exports before large edits or cleanup work

Future admin-only import/export tools can build on the current schema.

## 10. Handle Conflicts

Updates can send `expectedUpdatedAt`.

If another device already changed the record, the Worker returns:

- `409 Conflict`

When this happens:

1. reload the latest data
2. review the newer change
3. re-apply the edit against the current record

## 11. Recover from a Bad Change

Today, recovery is manual:

- inspect the affected record in the UI or database
- compare timestamps and audit activity
- restore the field values by editing them again

Because publish is marker-based in this phase, recovery is not yet a one-click rollback.

## 12. Checklist and Note Management

Notes and checklist items are stored separately from trip-day rows so they can be reused across the trip.

- notes support safe markdown
- checklist items support status updates and sorting
- viewer mode can read them
- editor/admin sessions can modify them

## 13. Security Reminder

Do not place real itinerary data in:

- source files
- seeded placeholder fixtures
- committed environment examples
- screenshots or example markdown

Use clearly fictional placeholders in code, and reserve real trip details for the live D1-backed UI only.
