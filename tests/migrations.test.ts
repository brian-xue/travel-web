import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { afterEach, describe, expect, it } from "vitest";

const createdFiles: string[] = [];

function runSqlite(dbPath: string, sql: string) {
  return execFileSync("sqlite3", [dbPath], {
    input: sql,
    encoding: "utf8",
  }).trim();
}

function applyMigrations(dbPath: string) {
  const migration1 = fs.readFileSync(path.resolve("migrations/0001_initial.sql"), "utf8");
  const migration2 = fs.readFileSync(path.resolve("migrations/0002_trip_domain.sql"), "utf8");
  runSqlite(dbPath, `${migration1}\n${migration2}`);
}

afterEach(() => {
  for (const file of createdFiles.splice(0, createdFiles.length)) {
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
});

describe("phase 2 migrations", () => {
  it("creates the expected phase 2 tables", () => {
    const dbPath = path.join(os.tmpdir(), `travel-web-migration-${crypto.randomUUID()}.sqlite`);
    createdFiles.push(dbPath);
    applyMigrations(dbPath);

    const output = runSqlite(
      dbPath,
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('trips','trip_days','places','day_places','routes','notes','checklist_items','weather_snapshots','weather_alerts') ORDER BY name;",
    );

    expect(output.split("\n")).toEqual([
      "checklist_items",
      "day_places",
      "notes",
      "places",
      "routes",
      "trip_days",
      "trips",
      "weather_alerts",
      "weather_snapshots",
    ]);
  });

  it("creates important phase 2 columns used by the worker queries", () => {
    const dbPath = path.join(os.tmpdir(), `travel-web-columns-${crypto.randomUUID()}.sqlite`);
    createdFiles.push(dbPath);
    applyMigrations(dbPath);

    const tripsColumns = runSqlite(dbPath, "PRAGMA table_info(trips);");
    const tripDaysColumns = runSqlite(dbPath, "PRAGMA table_info(trip_days);");
    const placesColumns = runSqlite(dbPath, "PRAGMA table_info(places);");
    const weatherColumns = runSqlite(dbPath, "PRAGMA table_info(weather_snapshots);");

    expect(tripsColumns).toContain("status");
    expect(tripsColumns).toContain("published_version");
    expect(tripsColumns).toContain("draft_version");
    expect(tripDaysColumns).toContain("sort_order");
    expect(tripDaysColumns).toContain("google_maps_url");
    expect(placesColumns).toContain("weather_enabled");
    expect(placesColumns).toContain("description_markdown");
    expect(weatherColumns).toContain("fetched_at");
    expect(weatherColumns).toContain("fetch_error");
  });

  it("creates indexes needed by phase 2 lookups", () => {
    const dbPath = path.join(os.tmpdir(), `travel-web-indexes-${crypto.randomUUID()}.sqlite`);
    createdFiles.push(dbPath);
    applyMigrations(dbPath);

    const output = runSqlite(
      dbPath,
      "SELECT name FROM sqlite_master WHERE type = 'index' AND name IN ('idx_trips_status','idx_trip_days_trip_sort','idx_day_places_trip_day_visit_order','idx_routes_trip_day_id','idx_notes_trip_sort','idx_checklist_items_list_status','idx_weather_snapshots_place_fetched','idx_weather_alerts_expires_at') ORDER BY name;",
    );

    expect(output.split("\n")).toEqual([
      "idx_checklist_items_list_status",
      "idx_day_places_trip_day_visit_order",
      "idx_notes_trip_sort",
      "idx_routes_trip_day_id",
      "idx_trip_days_trip_sort",
      "idx_trips_status",
      "idx_weather_alerts_expires_at",
      "idx_weather_snapshots_place_fetched",
    ]);
  });
});
