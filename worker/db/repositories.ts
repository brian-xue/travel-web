import type {
  AppSettings,
  ChecklistInput,
  ChecklistItem,
  DashboardData,
  DayPlace,
  DayPlaceBundle,
  DayPlaceInput,
  DayPlaceReorderItem,
  NoteInput,
  NoteItem,
  Place,
  PlaceInput,
  RouteInput,
  RouteItem,
  Trip,
  TripDay,
  TripDayBundle,
  TripDayInput,
  TripInput,
  WeatherAlert,
  WeatherData,
  WeatherSnapshot,
} from "@/lib/api";
import type {
  AuditLogRecord,
  AuditLogRepository,
  ContentRepository,
  D1DatabaseLike,
  D1PreparedStatementLike,
  Repositories,
  SessionRecord,
  SessionsRepository,
  SettingsRepository,
  UserRecord,
  UsersRepository,
  WorkerEnv,
} from "../types";
import { D1RoadRepository } from "../roads/repository";

async function first<T>(statement: D1PreparedStatementLike) {
  const result = await statement.first<T>();
  return result ?? null;
}

async function all<T>(statement: D1PreparedStatementLike) {
  const result = await statement.all<T>();
  return result.results ?? [];
}

function nowIso() {
  return new Date().toISOString();
}

function rowBoolean(value: unknown) {
  return Number(value) === 1;
}

class D1SettingsRepository implements SettingsRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async get() {
    const row = await first<{ value_json: string }>(
      this.db.prepare("SELECT value_json FROM app_settings WHERE key = ?").bind("app_settings"),
    );

    if (!row) {
      const fallback: AppSettings = {
        weatherRefreshMinutes: 30,
        roadMonitoringMode: "manual",
        releaseVersion: "0.2.0",
        lastDataRefreshAt: new Date(0).toISOString(),
        uiPreferences: { compactCards: false },
      };
      await this.update(fallback);
      return fallback;
    }

    return JSON.parse(row.value_json) as AppSettings;
  }

  async update(nextSettings: AppSettings) {
    await this.db
      .prepare(
        "INSERT INTO app_settings (id, key, value_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
      )
      .bind(crypto.randomUUID(), "app_settings", JSON.stringify(nextSettings), nowIso())
      .run();
    return nextSettings;
  }
}

class D1UsersRepository implements UsersRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async getById(userId: string) {
    const row = await first<UserRecord>(
      this.db
        .prepare(
          "SELECT id, display_name as displayName, role, enabled, created_at as createdAt, updated_at as updatedAt FROM users WHERE id = ?",
        )
        .bind(userId),
    );
    return row ? { ...row, enabled: rowBoolean(row.enabled) } : null;
  }

  async getFirstByRole(role: UserRecord["role"]) {
    const row = await first<UserRecord>(
      this.db
        .prepare(
          "SELECT id, display_name as displayName, role, enabled, created_at as createdAt, updated_at as updatedAt FROM users WHERE role = ? ORDER BY created_at ASC LIMIT 1",
        )
        .bind(role),
    );
    return row ? { ...row, enabled: rowBoolean(row.enabled) } : null;
  }
}

class D1SessionsRepository implements SessionsRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async create(session: SessionRecord) {
    await this.db
      .prepare(
        "INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        session.id,
        session.userId,
        session.tokenHash,
        session.csrfToken,
        session.expiresAt,
        session.createdAt,
        session.lastSeenAt,
      )
      .run();
  }

  async findByTokenHash(tokenHash: string) {
    const row = await first<SessionRecord>(
      this.db
        .prepare(
          "SELECT id, user_id as userId, token_hash as tokenHash, csrf_token as csrfToken, expires_at as expiresAt, created_at as createdAt, last_seen_at as lastSeenAt FROM sessions WHERE token_hash = ?",
        )
        .bind(tokenHash),
    );
    return row;
  }

  async deleteByTokenHash(tokenHash: string) {
    await this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }

  async touch(tokenHash: string, lastSeenAt: string) {
    await this.db.prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?").bind(lastSeenAt, tokenHash).run();
  }
}

class D1AuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async insert(entry: Parameters<AuditLogRepository["insert"]>[0]) {
    await this.db
      .prepare(
        "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        entry.actorUserId,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.metadataJson,
        entry.createdAt,
      )
      .run();
  }

  async list(limit = 50) {
    return all<AuditLogRecord & { id: string }>(this.db.prepare("SELECT id, actor_user_id as actorUserId, action, entity_type as entityType, entity_id as entityId, metadata_json as metadataJson, created_at as createdAt FROM audit_log ORDER BY created_at DESC LIMIT ?").bind(Math.min(Math.max(limit, 1), 100)));
  }
}

type TripRow = Omit<Trip, "publishedVersion" | "draftVersion"> & {
  publishedVersion: number;
  draftVersion: number;
};

type TripDayRow = Omit<TripDay, "enabled"> & { enabled: number };
type PlaceRow = Omit<Place, "weatherEnabled" | "enabled"> & { weatherEnabled: number; enabled: number };
type DayPlaceRow = DayPlace;
type RouteRow = Omit<RouteItem, "enabled"> & { enabled: number };
type NoteRow = Omit<NoteItem, "enabled"> & { enabled: number };
type WeatherSnapshotRow = Omit<WeatherSnapshot, "stale"> & { stale: number };

class D1ContentRepository implements ContentRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  private mapTrip(row: TripRow): Trip {
    return row;
  }

  private mapDay(row: TripDayRow): TripDay {
    return { ...row, enabled: rowBoolean(row.enabled) };
  }

  private mapPlace(row: PlaceRow): Place {
    return { ...row, enabled: rowBoolean(row.enabled), weatherEnabled: rowBoolean(row.weatherEnabled) };
  }

  private mapRoute(row: RouteRow): RouteItem {
    return { ...row, enabled: rowBoolean(row.enabled) };
  }

  private mapNote(row: NoteRow): NoteItem {
    return { ...row, enabled: rowBoolean(row.enabled) };
  }

  private mapSnapshot(row: WeatherSnapshotRow): WeatherSnapshot {
    return { ...row, stale: rowBoolean(row.stale) };
  }

  async getDashboard() {
    const featuredTrip = await this.getFeaturedTripBundle();
    const latestWeather = await first<{ fetchedAt: string; stale: number }>(
      this.db
        .prepare("SELECT fetched_at as fetchedAt, stale FROM weather_snapshots ORDER BY fetched_at DESC LIMIT 1")
        .bind(),
    );
    const alertsRow = await first<{ count: number }>(
      this.db.prepare("SELECT COUNT(*) as count FROM weather_alerts WHERE expires_at IS NULL OR expires_at >= ?").bind(nowIso()),
    );
    const placeRow = await first<{ count: number }>(this.db.prepare("SELECT COUNT(*) as count FROM places WHERE enabled = 1").bind());
    const shoppingRow = await first<{ count: number }>(
      this.db.prepare("SELECT COUNT(*) as count FROM checklist_items WHERE list_type = 'shopping' AND status = 'pending'").bind(),
    );
    const packingRow = await first<{ count: number }>(
      this.db.prepare("SELECT COUNT(*) as count FROM checklist_items WHERE list_type = 'packing' AND status = 'pending'").bind(),
    );

    return {
      publishedTripDays: featuredTrip?.days.filter((day) => day.enabled).length ?? 0,
      totalPlaces: placeRow?.count ?? 0,
      latestWeatherUpdateAt: latestWeather?.fetchedAt ?? null,
      activeWeatherAlerts: alertsRow?.count ?? 0,
      pendingShoppingItems: shoppingRow?.count ?? 0,
      pendingPackingItems: packingRow?.count ?? 0,
      recentTripUpdateAt: featuredTrip?.updatedAt ?? null,
      staleWeather: latestWeather ? rowBoolean(latestWeather.stale) : true,
      featuredTripId: featuredTrip?.id ?? null,
      featuredTripDayId: featuredTrip?.days[0]?.id ?? null,
    } satisfies DashboardData;
  }

  async listTrips() {
    const rows = await all<TripRow>(
      this.db.prepare(
        "SELECT id, name, description, status, published_version as publishedVersion, draft_version as draftVersion, created_at as createdAt, updated_at as updatedAt FROM trips ORDER BY updated_at DESC",
      ),
    );
    return rows.map((row) => this.mapTrip(row));
  }

  async getTripBundle(tripId: string) {
    const trip = await first<TripRow>(
      this.db
        .prepare(
          "SELECT id, name, description, status, published_version as publishedVersion, draft_version as draftVersion, created_at as createdAt, updated_at as updatedAt FROM trips WHERE id = ?",
        )
        .bind(tripId),
    );
    if (!trip) {
      return null;
    }

    const days = await this.listTripDays(tripId);
    return { ...this.mapTrip(trip), days };
  }

  async getFeaturedTripBundle() {
    const trip = await first<TripRow>(
      this.db.prepare(
        "SELECT id, name, description, status, published_version as publishedVersion, draft_version as draftVersion, created_at as createdAt, updated_at as updatedAt FROM trips ORDER BY CASE status WHEN 'published' THEN 0 ELSE 1 END, updated_at DESC LIMIT 1",
      ),
    );
    if (!trip) {
      return null;
    }
    const days = await this.listTripDays(trip.id);
    return { ...this.mapTrip(trip), days };
  }

  async createTrip(input: TripInput) {
    const createdAt = nowIso();
    const trip: Trip = {
      id: crypto.randomUUID(),
      name: input.name,
      description: input.description,
      status: input.status,
      publishedVersion: input.status === "published" ? 1 : 0,
      draftVersion: 1,
      createdAt,
      updatedAt: createdAt,
    };
    await this.db
      .prepare(
        "INSERT INTO trips (id, name, description, status, published_version, draft_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        trip.id,
        trip.name,
        trip.description,
        trip.status,
        trip.publishedVersion,
        trip.draftVersion,
        trip.createdAt,
        trip.updatedAt,
      )
      .run();
    return trip;
  }

  async updateTrip(tripId: string, input: TripInput) {
    const current = await this.getTripBundle(tripId);
    if (!current) {
      return { ok: false };
    }
    if (input.expectedUpdatedAt && input.expectedUpdatedAt !== current.updatedAt) {
      return { ok: false, conflict: true as const };
    }
    const updated: Trip = {
      ...current,
      name: input.name,
      description: input.description,
      status: input.status,
      draftVersion: current.draftVersion + 1,
      updatedAt: nowIso(),
    };
    await this.db
      .prepare("UPDATE trips SET name = ?, description = ?, status = ?, draft_version = ?, updated_at = ? WHERE id = ?")
      .bind(updated.name, updated.description, updated.status, updated.draftVersion, updated.updatedAt, tripId)
      .run();
    return { ok: true, record: updated };
  }

  async deleteTrip(tripId: string) {
    await this.db.prepare("DELETE FROM trips WHERE id = ?").bind(tripId).run();
  }

  async publishTrip(tripId: string) {
    const current = await this.getTripBundle(tripId);
    if (!current) {
      return null;
    }
    const updated: Trip = {
      ...current,
      status: "published",
      publishedVersion: current.draftVersion,
      updatedAt: nowIso(),
    };
    await this.db
      .prepare("UPDATE trips SET status = 'published', published_version = draft_version, updated_at = ? WHERE id = ?")
      .bind(updated.updatedAt, tripId)
      .run();
    return updated;
  }

  async listTripDays(tripId: string) {
    const dayRows = await all<TripDayRow>(
      this.db
        .prepare(
          "SELECT id, trip_id as tripId, day_number as dayNumber, title, summary, estimated_distance_km as estimatedDistanceKm, estimated_drive_minutes as estimatedDriveMinutes, google_maps_url as googleMapsUrl, enabled, sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt FROM trip_days WHERE trip_id = ? ORDER BY sort_order ASC, day_number ASC",
        )
        .bind(tripId),
    );
    const days = dayRows.map((row) => this.mapDay(row));
    const dayPlaces = await all<DayPlaceRow>(
      this.db
        .prepare(
          "SELECT id, trip_day_id as tripDayId, place_id as placeId, visit_order as visitOrder, planned_arrival_text as plannedArrivalText, planned_duration_minutes as plannedDurationMinutes, note_markdown as noteMarkdown, created_at as createdAt, updated_at as updatedAt FROM day_places WHERE trip_day_id IN (SELECT id FROM trip_days WHERE trip_id = ?) ORDER BY visit_order ASC",
        )
        .bind(tripId),
    );
    const placeRows = await all<PlaceRow>(
      this.db
        .prepare(
          "SELECT id, name, place_type as placeType, latitude, longitude, description_markdown as descriptionMarkdown, official_url as officialUrl, google_maps_url as googleMapsUrl, weather_enabled as weatherEnabled, enabled, created_at as createdAt, updated_at as updatedAt FROM places WHERE id IN (SELECT place_id FROM day_places WHERE trip_day_id IN (SELECT id FROM trip_days WHERE trip_id = ?))",
        )
        .bind(tripId),
    );
    const routeRows = await all<RouteRow>(
      this.db
        .prepare(
          "SELECT id, trip_day_id as tripDayId, name, geojson, style_json as styleJson, enabled, created_at as createdAt, updated_at as updatedAt FROM routes WHERE trip_day_id IN (SELECT id FROM trip_days WHERE trip_id = ?)",
        )
        .bind(tripId),
    );
    const places = new Map(placeRows.map((row) => [row.id, this.mapPlace(row)]));
    const routesByDay = new Map<string, RouteItem[]>();
    routeRows.forEach((row) => {
      const list = routesByDay.get(row.tripDayId) ?? [];
      list.push(this.mapRoute(row));
      routesByDay.set(row.tripDayId, list);
    });
    const dayPlacesByDay = new Map<string, DayPlaceBundle[]>();
    dayPlaces.forEach((row) => {
      const place = places.get(row.placeId);
      if (!place) {
        return;
      }
      const list = dayPlacesByDay.get(row.tripDayId) ?? [];
      list.push({ ...row, place });
      dayPlacesByDay.set(row.tripDayId, list);
    });

    return days.map((day) => ({
      ...day,
      places: dayPlacesByDay.get(day.id) ?? [],
      routes: routesByDay.get(day.id) ?? [],
    })) satisfies TripDayBundle[];
  }

  async createTripDay(tripId: string, input: TripDayInput) {
    const existing = await first<{ maxSort: number | null; maxDay: number | null }>(
      this.db
        .prepare("SELECT MAX(sort_order) as maxSort, MAX(day_number) as maxDay FROM trip_days WHERE trip_id = ?")
        .bind(tripId),
    );
    const createdAt = nowIso();
    const day: TripDay = {
      id: crypto.randomUUID(),
      tripId,
      dayNumber: (existing?.maxDay ?? 0) + 1,
      title: input.title,
      summary: input.summary,
      estimatedDistanceKm: input.estimatedDistanceKm,
      estimatedDriveMinutes: input.estimatedDriveMinutes,
      googleMapsUrl: input.googleMapsUrl,
      enabled: input.enabled,
      sortOrder: (existing?.maxSort ?? 0) + 1,
      createdAt,
      updatedAt: createdAt,
    };
    await this.db
      .prepare(
        "INSERT INTO trip_days (id, trip_id, day_number, title, summary, estimated_distance_km, estimated_drive_minutes, google_maps_url, enabled, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        day.id,
        day.tripId,
        day.dayNumber,
        day.title,
        day.summary,
        day.estimatedDistanceKm,
        day.estimatedDriveMinutes,
        day.googleMapsUrl,
        day.enabled ? 1 : 0,
        day.sortOrder,
        day.createdAt,
        day.updatedAt,
      )
      .run();
    return day;
  }

  async updateTripDay(dayId: string, input: TripDayInput) {
    const current = await first<TripDayRow>(
      this.db
        .prepare(
          "SELECT id, trip_id as tripId, day_number as dayNumber, title, summary, estimated_distance_km as estimatedDistanceKm, estimated_drive_minutes as estimatedDriveMinutes, google_maps_url as googleMapsUrl, enabled, sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt FROM trip_days WHERE id = ?",
        )
        .bind(dayId),
    );
    if (!current) {
      return { ok: false };
    }
    if (input.expectedUpdatedAt && input.expectedUpdatedAt !== current.updatedAt) {
      return { ok: false, conflict: true as const };
    }
    const updated = {
      ...this.mapDay(current),
      ...input,
      updatedAt: nowIso(),
    };
    await this.db
      .prepare(
        "UPDATE trip_days SET title = ?, summary = ?, estimated_distance_km = ?, estimated_drive_minutes = ?, google_maps_url = ?, enabled = ?, updated_at = ? WHERE id = ?",
      )
      .bind(
        updated.title,
        updated.summary,
        updated.estimatedDistanceKm,
        updated.estimatedDriveMinutes,
        updated.googleMapsUrl,
        updated.enabled ? 1 : 0,
        updated.updatedAt,
        dayId,
      )
      .run();
    return { ok: true, record: updated };
  }

  async deleteTripDay(dayId: string) {
    await this.db.prepare("DELETE FROM trip_days WHERE id = ?").bind(dayId).run();
  }

  async copyTripDay(dayId: string) {
    const current = await first<TripDayRow>(
      this.db
        .prepare(
          "SELECT id, trip_id as tripId, day_number as dayNumber, title, summary, estimated_distance_km as estimatedDistanceKm, estimated_drive_minutes as estimatedDriveMinutes, google_maps_url as googleMapsUrl, enabled, sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt FROM trip_days WHERE id = ?",
        )
        .bind(dayId),
    );
    if (!current) {
      return null;
    }
    const duplicate = await this.createTripDay(current.tripId, {
      title: `${current.title} Copy`,
      summary: current.summary,
      estimatedDistanceKm: current.estimatedDistanceKm,
      estimatedDriveMinutes: current.estimatedDriveMinutes,
      googleMapsUrl: current.googleMapsUrl,
      enabled: rowBoolean(current.enabled),
    });
    return duplicate;
  }

  async reorderTripDays(items: Array<{ id: string; sortOrder: number }>) {
    for (const item of items) {
      await this.db
        .prepare("UPDATE trip_days SET sort_order = ?, day_number = ?, updated_at = ? WHERE id = ?")
        .bind(item.sortOrder, item.sortOrder, nowIso(), item.id)
        .run();
    }
  }

  async listPlaces() {
    const rows = await all<PlaceRow>(
      this.db.prepare(
        "SELECT id, name, place_type as placeType, latitude, longitude, description_markdown as descriptionMarkdown, official_url as officialUrl, google_maps_url as googleMapsUrl, weather_enabled as weatherEnabled, enabled, created_at as createdAt, updated_at as updatedAt FROM places ORDER BY updated_at DESC",
      ),
    );
    return rows.map((row) => this.mapPlace(row));
  }

  async createPlace(input: PlaceInput) {
    const createdAt = nowIso();
    const place: Place = {
      id: crypto.randomUUID(),
      name: input.name,
      placeType: input.placeType,
      latitude: input.latitude,
      longitude: input.longitude,
      descriptionMarkdown: input.descriptionMarkdown,
      officialUrl: input.officialUrl,
      googleMapsUrl: input.googleMapsUrl,
      weatherEnabled: input.weatherEnabled,
      enabled: input.enabled,
      createdAt,
      updatedAt: createdAt,
    };
    await this.db
      .prepare(
        "INSERT INTO places (id, name, place_type, latitude, longitude, description_markdown, official_url, google_maps_url, weather_enabled, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        place.id,
        place.name,
        place.placeType,
        place.latitude,
        place.longitude,
        place.descriptionMarkdown,
        place.officialUrl,
        place.googleMapsUrl,
        place.weatherEnabled ? 1 : 0,
        place.enabled ? 1 : 0,
        place.createdAt,
        place.updatedAt,
      )
      .run();
    return place;
  }

  async updatePlace(placeId: string, input: PlaceInput) {
    const current = await first<PlaceRow>(
      this.db
        .prepare(
          "SELECT id, name, place_type as placeType, latitude, longitude, description_markdown as descriptionMarkdown, official_url as officialUrl, google_maps_url as googleMapsUrl, weather_enabled as weatherEnabled, enabled, created_at as createdAt, updated_at as updatedAt FROM places WHERE id = ?",
        )
        .bind(placeId),
    );
    if (!current) {
      return { ok: false };
    }
    if (input.expectedUpdatedAt && input.expectedUpdatedAt !== current.updatedAt) {
      return { ok: false, conflict: true as const };
    }
    const updated: Place = {
      ...this.mapPlace(current),
      ...input,
      updatedAt: nowIso(),
    };
    await this.db
      .prepare(
        "UPDATE places SET name = ?, place_type = ?, latitude = ?, longitude = ?, description_markdown = ?, official_url = ?, google_maps_url = ?, weather_enabled = ?, enabled = ?, updated_at = ? WHERE id = ?",
      )
      .bind(
        updated.name,
        updated.placeType,
        updated.latitude,
        updated.longitude,
        updated.descriptionMarkdown,
        updated.officialUrl,
        updated.googleMapsUrl,
        updated.weatherEnabled ? 1 : 0,
        updated.enabled ? 1 : 0,
        updated.updatedAt,
        placeId,
      )
      .run();
    return { ok: true, record: updated };
  }

  async deletePlace(placeId: string) {
    await this.db.prepare("DELETE FROM places WHERE id = ?").bind(placeId).run();
  }

  async addDayPlace(dayId: string, input: DayPlaceInput) {
    const row = await first<{ maxVisit: number | null }>(
      this.db.prepare("SELECT MAX(visit_order) as maxVisit FROM day_places WHERE trip_day_id = ?").bind(dayId),
    );
    const createdAt = nowIso();
    const item: DayPlace = {
      id: crypto.randomUUID(),
      tripDayId: dayId,
      placeId: input.placeId,
      visitOrder: (row?.maxVisit ?? 0) + 1,
      plannedArrivalText: input.plannedArrivalText,
      plannedDurationMinutes: input.plannedDurationMinutes,
      noteMarkdown: input.noteMarkdown,
      createdAt,
      updatedAt: createdAt,
    };
    await this.db
      .prepare(
        "INSERT INTO day_places (id, trip_day_id, place_id, visit_order, planned_arrival_text, planned_duration_minutes, note_markdown, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        item.id,
        item.tripDayId,
        item.placeId,
        item.visitOrder,
        item.plannedArrivalText,
        item.plannedDurationMinutes,
        item.noteMarkdown,
        item.createdAt,
        item.updatedAt,
      )
      .run();
    const place = await first<PlaceRow>(
      this.db
        .prepare(
          "SELECT id, name, place_type as placeType, latitude, longitude, description_markdown as descriptionMarkdown, official_url as officialUrl, google_maps_url as googleMapsUrl, weather_enabled as weatherEnabled, enabled, created_at as createdAt, updated_at as updatedAt FROM places WHERE id = ?",
        )
        .bind(item.placeId),
    );
    if (!place) {
      return null;
    }
    return { ...item, place: this.mapPlace(place) };
  }

  async removeDayPlace(dayPlaceId: string) {
    await this.db.prepare("DELETE FROM day_places WHERE id = ?").bind(dayPlaceId).run();
  }

  async reorderDayPlaces(items: DayPlaceReorderItem[]) {
    for (const item of items) {
      await this.db
        .prepare("UPDATE day_places SET visit_order = ?, updated_at = ? WHERE id = ?")
        .bind(item.visitOrder, nowIso(), item.id)
        .run();
    }
  }

  async listRoutes(dayId: string) {
    const rows = await all<RouteRow>(
      this.db
        .prepare(
          "SELECT id, trip_day_id as tripDayId, name, geojson, style_json as styleJson, enabled, created_at as createdAt, updated_at as updatedAt FROM routes WHERE trip_day_id = ? ORDER BY updated_at DESC",
        )
        .bind(dayId),
    );
    return rows.map((row) => this.mapRoute(row));
  }

  async createRoute(dayId: string, input: RouteInput) {
    const createdAt = nowIso();
    const route: RouteItem = {
      id: crypto.randomUUID(),
      tripDayId: dayId,
      name: input.name,
      geojson: input.geojson,
      styleJson: input.styleJson,
      enabled: input.enabled,
      createdAt,
      updatedAt: createdAt,
    };
    await this.db
      .prepare(
        "INSERT INTO routes (id, trip_day_id, name, geojson, style_json, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        route.id,
        route.tripDayId,
        route.name,
        route.geojson,
        route.styleJson,
        route.enabled ? 1 : 0,
        route.createdAt,
        route.updatedAt,
      )
      .run();
    return route;
  }

  async updateRoute(routeId: string, input: RouteInput) {
    const current = await first<RouteRow>(
      this.db
        .prepare(
          "SELECT id, trip_day_id as tripDayId, name, geojson, style_json as styleJson, enabled, created_at as createdAt, updated_at as updatedAt FROM routes WHERE id = ?",
        )
        .bind(routeId),
    );
    if (!current) {
      return { ok: false };
    }
    if (input.expectedUpdatedAt && input.expectedUpdatedAt !== current.updatedAt) {
      return { ok: false, conflict: true as const };
    }
    const updated = {
      ...this.mapRoute(current),
      ...input,
      updatedAt: nowIso(),
    };
    await this.db
      .prepare("UPDATE routes SET name = ?, geojson = ?, style_json = ?, enabled = ?, updated_at = ? WHERE id = ?")
      .bind(updated.name, updated.geojson, updated.styleJson, updated.enabled ? 1 : 0, updated.updatedAt, routeId)
      .run();
    return { ok: true, record: updated };
  }

  async deleteRoute(routeId: string) {
    await this.db.prepare("DELETE FROM routes WHERE id = ?").bind(routeId).run();
  }

  async listNotes(tripId: string) {
    const rows = await all<NoteRow>(
      this.db
        .prepare(
          "SELECT id, trip_id as tripId, category, title, content_markdown as contentMarkdown, sort_order as sortOrder, enabled, created_at as createdAt, updated_at as updatedAt FROM notes WHERE trip_id = ? ORDER BY sort_order ASC, updated_at DESC",
        )
        .bind(tripId),
    );
    return rows.map((row) => this.mapNote(row));
  }

  async createNote(input: NoteInput) {
    const createdAt = nowIso();
    const note: NoteItem = {
      id: crypto.randomUUID(),
      tripId: input.tripId,
      category: input.category,
      title: input.title,
      contentMarkdown: input.contentMarkdown,
      sortOrder: input.sortOrder,
      enabled: input.enabled,
      createdAt,
      updatedAt: createdAt,
    };
    await this.db
      .prepare(
        "INSERT INTO notes (id, trip_id, category, title, content_markdown, sort_order, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        note.id,
        note.tripId,
        note.category,
        note.title,
        note.contentMarkdown,
        note.sortOrder,
        note.enabled ? 1 : 0,
        note.createdAt,
        note.updatedAt,
      )
      .run();
    return note;
  }

  async updateNote(noteId: string, input: NoteInput) {
    const current = await first<NoteRow>(
      this.db
        .prepare(
          "SELECT id, trip_id as tripId, category, title, content_markdown as contentMarkdown, sort_order as sortOrder, enabled, created_at as createdAt, updated_at as updatedAt FROM notes WHERE id = ?",
        )
        .bind(noteId),
    );
    if (!current) {
      return { ok: false };
    }
    if (input.expectedUpdatedAt && input.expectedUpdatedAt !== current.updatedAt) {
      return { ok: false, conflict: true as const };
    }
    const updated = {
      ...this.mapNote(current),
      ...input,
      updatedAt: nowIso(),
    };
    await this.db
      .prepare(
        "UPDATE notes SET category = ?, title = ?, content_markdown = ?, sort_order = ?, enabled = ?, updated_at = ? WHERE id = ?",
      )
      .bind(
        updated.category,
        updated.title,
        updated.contentMarkdown,
        updated.sortOrder,
        updated.enabled ? 1 : 0,
        updated.updatedAt,
        noteId,
      )
      .run();
    return { ok: true, record: updated };
  }

  async deleteNote(noteId: string) {
    await this.db.prepare("DELETE FROM notes WHERE id = ?").bind(noteId).run();
  }

  async listChecklistItems(tripId: string) {
    return all<ChecklistItem>(
      this.db
        .prepare(
          "SELECT id, trip_id as tripId, list_type as listType, category, title, quantity, priority, status, note, sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt FROM checklist_items WHERE trip_id = ? ORDER BY sort_order ASC, updated_at DESC",
        )
        .bind(tripId),
    );
  }

  async createChecklistItem(input: ChecklistInput) {
    const createdAt = nowIso();
    const item: ChecklistItem = {
      id: crypto.randomUUID(),
      tripId: input.tripId,
      listType: input.listType,
      category: input.category,
      title: input.title,
      quantity: input.quantity,
      priority: input.priority,
      status: input.status,
      note: input.note,
      sortOrder: input.sortOrder,
      createdAt,
      updatedAt: createdAt,
    };
    await this.db
      .prepare(
        "INSERT INTO checklist_items (id, trip_id, list_type, category, title, quantity, priority, status, note, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        item.id,
        item.tripId,
        item.listType,
        item.category,
        item.title,
        item.quantity,
        item.priority,
        item.status,
        item.note,
        item.sortOrder,
        item.createdAt,
        item.updatedAt,
      )
      .run();
    return item;
  }

  async updateChecklistItem(itemId: string, input: ChecklistInput) {
    const current = await first<ChecklistItem>(
      this.db
        .prepare(
          "SELECT id, trip_id as tripId, list_type as listType, category, title, quantity, priority, status, note, sort_order as sortOrder, created_at as createdAt, updated_at as updatedAt FROM checklist_items WHERE id = ?",
        )
        .bind(itemId),
    );
    if (!current) {
      return { ok: false };
    }
    if (input.expectedUpdatedAt && input.expectedUpdatedAt !== current.updatedAt) {
      return { ok: false, conflict: true as const };
    }
    const updated: ChecklistItem = {
      ...current,
      ...input,
      updatedAt: nowIso(),
    };
    await this.db
      .prepare(
        "UPDATE checklist_items SET list_type = ?, category = ?, title = ?, quantity = ?, priority = ?, status = ?, note = ?, sort_order = ?, updated_at = ? WHERE id = ?",
      )
      .bind(
        updated.listType,
        updated.category,
        updated.title,
        updated.quantity,
        updated.priority,
        updated.status,
        updated.note,
        updated.sortOrder,
        updated.updatedAt,
        itemId,
      )
      .run();
    return { ok: true, record: updated };
  }

  async deleteChecklistItem(itemId: string) {
    await this.db.prepare("DELETE FROM checklist_items WHERE id = ?").bind(itemId).run();
  }

  async getMapData(maptilerConfigured: boolean, maptilerStyleUrl: string | null) {
    const trip = await this.getFeaturedTripBundle();
    const places = await this.listPlaces();
    const snapshots = await this.getWeatherData();

    return {
      trip,
      days: trip?.days ?? [],
      places,
      dayPlaces: trip?.days.flatMap((day) => day.places.map((item) => ({ ...item, place: undefined as never }))).map((item) => ({
        id: item.id,
        tripDayId: item.tripDayId,
        placeId: item.placeId,
        visitOrder: item.visitOrder,
        plannedArrivalText: item.plannedArrivalText,
        plannedDurationMinutes: item.plannedDurationMinutes,
        noteMarkdown: item.noteMarkdown,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      })) ?? [],
      routes:
        trip?.days.flatMap((day) =>
          day.routes.map((route) => ({
            route,
            tripDay: {
              ...day,
              places: undefined as never,
              routes: undefined as never,
            } as unknown as TripDay,
          })),
        ) ?? [],
      weather: snapshots.snapshots.map((snapshot) => ({
        placeId: snapshot.placeId,
        summary:
          snapshot.currentTemperature === null
            ? "No current weather"
            : `${snapshot.currentTemperature}°C, code ${snapshot.weatherCode ?? "n/a"}`,
        stale: snapshot.stale,
        fetchedAt: snapshot.fetchedAt,
      })),
      maptilerConfigured,
      maptilerStyleUrl,
    };
  }

  async getWeatherData() {
    const trip = await this.getFeaturedTripBundle();
    const places = (await this.listPlaces()).filter((place) => place.weatherEnabled && place.enabled);
    const snapshotRows = await all<WeatherSnapshotRow>(
      this.db.prepare(
        "SELECT id, place_id as placeId, current_temperature as currentTemperature, apparent_temperature as apparentTemperature, weather_code as weatherCode, precipitation_probability as precipitationProbability, precipitation, wind_speed as windSpeed, wind_gust as windGust, wind_direction as windDirection, daily_high as dailyHigh, daily_low as dailyLow, sunrise, sunset, fetched_at as fetchedAt, source, stale, fetch_error as fetchError FROM weather_snapshots ORDER BY fetched_at DESC",
      ),
    );
    const alertRows = await all<WeatherAlert>(
      this.db.prepare(
        "SELECT id, place_id as placeId, event, severity, urgency, headline, description, instruction, official_url as officialUrl, effective_at as effectiveAt, expires_at as expiresAt, fetched_at as fetchedAt FROM weather_alerts ORDER BY fetched_at DESC",
      ),
    );
    const snapshots = snapshotRows.map((row) => this.mapSnapshot(row));
    return {
      trip,
      places,
      snapshots,
      alerts: alertRows,
      refreshedAt: snapshots[0]?.fetchedAt ?? null,
      stale: snapshots.some((snapshot) => snapshot.stale),
    } satisfies WeatherData;
  }

  async replaceWeatherSnapshots(items: WeatherSnapshot[]) {
    if (items.length === 0) {
      return;
    }
    for (const item of items) {
      await this.db.prepare("DELETE FROM weather_snapshots WHERE place_id = ?").bind(item.placeId).run();
      await this.db
        .prepare(
          "INSERT INTO weather_snapshots (id, place_id, current_temperature, apparent_temperature, weather_code, precipitation_probability, precipitation, wind_speed, wind_gust, wind_direction, daily_high, daily_low, sunrise, sunset, fetched_at, source, stale, fetch_error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          item.id,
          item.placeId,
          item.currentTemperature,
          item.apparentTemperature,
          item.weatherCode,
          item.precipitationProbability,
          item.precipitation,
          item.windSpeed,
          item.windGust,
          item.windDirection,
          item.dailyHigh,
          item.dailyLow,
          item.sunrise,
          item.sunset,
          item.fetchedAt,
          item.source,
          item.stale ? 1 : 0,
          item.fetchError,
        )
        .run();
    }
  }

  async replaceWeatherAlerts(items: WeatherAlert[]) {
    await this.db.prepare("DELETE FROM weather_alerts").bind().run();
    for (const item of items) {
      await this.db
        .prepare(
          "INSERT INTO weather_alerts (id, place_id, event, severity, urgency, headline, description, instruction, official_url, effective_at, expires_at, fetched_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          item.id,
          item.placeId,
          item.event,
          item.severity,
          item.urgency,
          item.headline,
          item.description,
          item.instruction,
          item.officialUrl,
          item.effectiveAt,
          item.expiresAt,
          item.fetchedAt,
        )
        .run();
    }
  }
}

export function createRepositories(env: WorkerEnv): Repositories {
  return {
    settings: new D1SettingsRepository(env.DB),
    users: new D1UsersRepository(env.DB),
    sessions: new D1SessionsRepository(env.DB),
    auditLog: new D1AuditLogRepository(env.DB),
    content: new D1ContentRepository(env.DB),
    roads: new D1RoadRepository(env.DB),
  };
}
