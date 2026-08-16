import type { SessionState } from "@/features/auth/types";

export interface ApiEnvelope<T> {
  ok: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
}

export type TripStatus = "draft" | "published" | "archived";
export type PlaceType =
  | "city"
  | "scenic_point"
  | "lodging_city"
  | "fuel"
  | "food"
  | "trailhead"
  | "viewpoint"
  | "road_checkpoint"
  | "custom";
export type NoteCategory = "driving" | "altitude" | "weather" | "park" | "safety" | "packing" | "custom";
export type ChecklistListType = "shopping" | "packing" | "car" | "document" | "custom";
export type ChecklistStatus = "pending" | "purchased" | "packed" | "loaded" | "skipped";
export type RoadSourceType = "api" | "json" | "rss" | "html" | "manual" | "unsupported";
export type RoadParserType = "generic_json" | "generic_rss" | "keyword_html" | "custom_adapter" | "manual_only";
export type RoadUpdateMode = "paused" | "daily" | "hourly";
export type RoadStatus =
  | "open"
  | "open_with_caution"
  | "delayed"
  | "restricted"
  | "partially_closed"
  | "closed"
  | "seasonal_closure"
  | "unknown"
  | "fetch_failed"
  | "manual_review_required";
export type RoadSeverity = "info" | "low" | "medium" | "high" | "critical" | "unknown";

export interface AppSettings {
  weatherRefreshMinutes: 30 | 60;
  roadMonitoringMode: string;
  releaseVersion: string;
  lastDataRefreshAt: string;
  uiPreferences: {
    compactCards: boolean;
  };
}

export interface Trip {
  id: string;
  name: string;
  description: string;
  status: TripStatus;
  publishedVersion: number;
  draftVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface TripDay {
  id: string;
  tripId: string;
  dayNumber: number;
  title: string;
  summary: string;
  estimatedDistanceKm: number;
  estimatedDriveMinutes: number;
  googleMapsUrl: string;
  enabled: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Place {
  id: string;
  name: string;
  placeType: PlaceType;
  latitude: number;
  longitude: number;
  descriptionMarkdown: string;
  officialUrl: string;
  googleMapsUrl: string;
  weatherEnabled: boolean;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DayPlace {
  id: string;
  tripDayId: string;
  placeId: string;
  visitOrder: number;
  plannedArrivalText: string;
  plannedDurationMinutes: number;
  noteMarkdown: string;
  createdAt: string;
  updatedAt: string;
}

export interface RouteItem {
  id: string;
  tripDayId: string;
  name: string;
  geojson: string;
  styleJson: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NoteItem {
  id: string;
  tripId: string;
  category: NoteCategory;
  title: string;
  contentMarkdown: string;
  sortOrder: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChecklistItem {
  id: string;
  tripId: string;
  listType: ChecklistListType;
  category: string;
  title: string;
  quantity: number;
  priority: number;
  status: ChecklistStatus;
  note: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface WeatherSnapshot {
  id: string;
  placeId: string;
  currentTemperature: number | null;
  apparentTemperature: number | null;
  weatherCode: number | null;
  precipitationProbability: number | null;
  precipitation: number | null;
  windSpeed: number | null;
  windGust: number | null;
  windDirection: number | null;
  dailyHigh: number | null;
  dailyLow: number | null;
  sunrise: string | null;
  sunset: string | null;
  fetchedAt: string;
  source: string;
  stale: boolean;
  fetchError: string | null;
}

export interface WeatherAlert {
  id: string;
  placeId: string | null;
  event: string;
  severity: string;
  urgency: string;
  headline: string;
  description: string;
  instruction: string;
  officialUrl: string;
  effectiveAt: string | null;
  expiresAt: string | null;
  fetchedAt: string;
}

export interface DayPlaceBundle extends DayPlace {
  place: Place;
}

export interface TripDayBundle extends TripDay {
  places: DayPlaceBundle[];
  routes: RouteItem[];
}

export interface TripBundle extends Trip {
  days: TripDayBundle[];
}

export interface DashboardData {
  publishedTripDays: number;
  totalPlaces: number;
  latestWeatherUpdateAt: string | null;
  activeWeatherAlerts: number;
  pendingShoppingItems: number;
  pendingPackingItems: number;
  recentTripUpdateAt: string | null;
  staleWeather: boolean;
  featuredTripId: string | null;
  featuredTripDayId: string | null;
}

export interface MapRouteFeature {
  route: RouteItem;
  tripDay: TripDay;
}

export interface MapData {
  trip: Trip | null;
  days: TripDay[];
  places: Place[];
  dayPlaces: DayPlace[];
  routes: MapRouteFeature[];
  weather: Array<{ placeId: string; summary: string; stale: boolean; fetchedAt: string }>;
  maptilerConfigured: boolean;
  maptilerStyleUrl: string | null;
}

export interface WeatherData {
  trip: Trip | null;
  places: Place[];
  snapshots: WeatherSnapshot[];
  alerts: WeatherAlert[];
  refreshedAt: string | null;
  stale: boolean;
}

export interface RoadStatusSnapshot {
  id: string;
  roadMonitorId: string;
  normalizedStatus: RoadStatus;
  severity: RoadSeverity;
  summary: string;
  sourceUpdatedAt: string | null;
  fetchedAt: string;
  contentHash: string;
  rawExcerpt: string;
  rawPayloadJson: string;
  isManual: boolean;
  stale: boolean;
  createdAt: string;
}

export interface RoadManualConfirmation {
  id: string;
  roadMonitorId: string;
  confirmedStatus: RoadStatus;
  note: string;
  confirmedBy: string;
  confirmedAt: string;
  expiresAt: string | null;
  createdAt: string;
}

export interface RoadMonitorDayLink {
  id: string;
  roadMonitorId: string;
  tripDayId: string;
  sortOrder: number;
  note: string;
  createdAt: string;
}

export interface RoadMonitor {
  id: string;
  name: string;
  description: string;
  officialUrl: string;
  sourceType: RoadSourceType;
  parserType: RoadParserType;
  parserConfigJson: string;
  updateMode: RoadUpdateMode;
  minimumIntervalMinutes: number;
  enabled: boolean;
  manualStatusOverride: RoadStatus | null;
  manualNote: string;
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastChangedAt: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  currentSnapshot: RoadStatusSnapshot | null;
}

export interface RoadMonitorDetail extends RoadMonitor {
  history: RoadStatusSnapshot[];
  confirmations: RoadManualConfirmation[];
  dayLinks: RoadMonitorDayLink[];
}

export interface RoadMonitorInput {
  name: string;
  description: string;
  officialUrl: string;
  sourceType: RoadSourceType;
  parserType: RoadParserType;
  parserConfigJson: string;
  updateMode: RoadUpdateMode;
  minimumIntervalMinutes: number;
  enabled: boolean;
  manualNote: string;
}

export interface AdminExport {
  schemaVersion: 1;
  exportedAt: string;
  data: {
    settings: AppSettings;
    trips: Trip[];
    tripBundles: TripBundle[];
    places: Place[];
    roadMonitors: RoadMonitor[];
  };
}

export interface AuditLogItem {
  id: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadataJson: string;
  createdAt: string;
}

export interface ConflictAwareInput {
  expectedUpdatedAt?: string;
}

export interface TripInput extends ConflictAwareInput {
  name: string;
  description: string;
  status: TripStatus;
}

export interface TripDayInput extends ConflictAwareInput {
  title: string;
  summary: string;
  estimatedDistanceKm: number;
  estimatedDriveMinutes: number;
  googleMapsUrl: string;
  enabled: boolean;
}

export interface DayReorderItem {
  id: string;
  sortOrder: number;
}

export interface PlaceInput extends ConflictAwareInput {
  name: string;
  placeType: PlaceType;
  latitude: number;
  longitude: number;
  descriptionMarkdown: string;
  officialUrl: string;
  googleMapsUrl: string;
  weatherEnabled: boolean;
  enabled: boolean;
}

export interface GeocodingFeature {
  id: string;
  text?: string;
  place_name: string;
  center: [number, number];
  relevance?: number;
  place_type?: string[];
}

export interface GeocodingResponse {
  features: GeocodingFeature[];
}

export interface DayPlaceInput {
  placeId: string;
  plannedArrivalText: string;
  plannedDurationMinutes: number;
  noteMarkdown: string;
}

export interface DayPlaceReorderItem {
  id: string;
  visitOrder: number;
}

export interface RouteInput extends ConflictAwareInput {
  name: string;
  geojson: string;
  styleJson: string;
  enabled: boolean;
}

export interface NoteInput extends ConflictAwareInput {
  tripId: string;
  category: NoteCategory;
  title: string;
  contentMarkdown: string;
  sortOrder: number;
  enabled: boolean;
}

export interface ChecklistInput extends ConflictAwareInput {
  tripId: string;
  listType: ChecklistListType;
  category: string;
  title: string;
  quantity: number;
  priority: number;
  status: ChecklistStatus;
  note: string;
  sortOrder: number;
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

function resolveApiBaseUrl(configuredBaseUrl: string) {
  const browserLocation =
    typeof globalThis === "object" && "location" in globalThis
      ? (globalThis.location as { hostname?: string })
      : null;

  if (!configuredBaseUrl || !browserLocation?.hostname) {
    return configuredBaseUrl;
  }

  try {
    const parsed = new URL(configuredBaseUrl);
    if (LOOPBACK_HOSTS.has(parsed.hostname) && LOOPBACK_HOSTS.has(browserLocation.hostname)) {
      parsed.hostname = browserLocation.hostname;
      return parsed.toString().replace(/\/$/, "");
    }
  } catch {
    return configuredBaseUrl;
  }

  return configuredBaseUrl;
}

const API_BASE_URL = resolveApiBaseUrl(
  (import.meta as ImportMeta & {
    env?: {
      VITE_API_BASE_URL?: string;
    };
  }).env?.VITE_API_BASE_URL ?? "",
);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!payload.ok || payload.data === null) {
    throw new Error(payload.error?.message ?? "Request failed");
  }
  return payload.data;
}

export const api = {
  getSession: () => request<SessionState>("/api/auth/session"),
  login: (password: string) =>
    request<SessionState>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: (csrfToken: string) =>
    request<{ success: true }>("/api/auth/logout", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  getSettings: () => request<AppSettings>("/api/settings"),
  updateSettings: (settings: AppSettings, csrfToken: string) =>
    request<AppSettings>("/api/settings", {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(settings),
    }),
  getDashboard: () => request<DashboardData>("/api/dashboard"),
  listTrips: () => request<Trip[]>("/api/trips"),
  createTrip: (input: TripInput, csrfToken: string) =>
    request<Trip>("/api/trips", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  getTrip: (tripId: string) => request<TripBundle>(`/api/trips/${tripId}`),
  updateTrip: (tripId: string, input: TripInput, csrfToken: string) =>
    request<Trip>(`/api/trips/${tripId}`, {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  deleteTrip: (tripId: string, csrfToken: string) =>
    request<{ success: true }>(`/api/trips/${tripId}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  publishTrip: (tripId: string, csrfToken: string) =>
    request<Trip>(`/api/trips/${tripId}/publish`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  listTripDays: (tripId: string) => request<TripDayBundle[]>(`/api/trips/${tripId}/days`),
  createTripDay: (tripId: string, input: TripDayInput, csrfToken: string) =>
    request<TripDay>(`/api/trips/${tripId}/days`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  updateTripDay: (dayId: string, input: TripDayInput, csrfToken: string) =>
    request<TripDay>(`/api/days/${dayId}`, {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  deleteTripDay: (dayId: string, csrfToken: string) =>
    request<{ success: true }>(`/api/days/${dayId}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  copyTripDay: (dayId: string, csrfToken: string) =>
    request<TripDay>(`/api/days/${dayId}/copy`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  reorderTripDays: (items: DayReorderItem[], csrfToken: string) =>
    request<{ success: true }>("/api/days/reorder", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ items }),
    }),
  listPlaces: () => request<Place[]>("/api/places"),
  searchGeocoding: (query: string, signal?: AbortSignal) =>
    request<GeocodingResponse>(`/api/geocoding?q=${encodeURIComponent(query)}`, { signal }),
  createPlace: (input: PlaceInput, csrfToken: string) =>
    request<Place>("/api/places", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  updatePlace: (placeId: string, input: PlaceInput, csrfToken: string) =>
    request<Place>(`/api/places/${placeId}`, {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  deletePlace: (placeId: string, csrfToken: string) =>
    request<{ success: true }>(`/api/places/${placeId}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  addDayPlace: (dayId: string, input: DayPlaceInput, csrfToken: string) =>
    request<DayPlaceBundle>(`/api/days/${dayId}/places`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  removeDayPlace: (dayPlaceId: string, csrfToken: string) =>
    request<{ success: true }>(`/api/day-places/${dayPlaceId}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  reorderDayPlaces: (items: DayPlaceReorderItem[], csrfToken: string) =>
    request<{ success: true }>("/api/day-places/reorder", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ items }),
    }),
  listRoutes: (dayId: string) => request<RouteItem[]>(`/api/days/${dayId}/routes`),
  createRoute: (dayId: string, input: RouteInput, csrfToken: string) =>
    request<RouteItem>(`/api/days/${dayId}/routes`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  updateRoute: (routeId: string, input: RouteInput, csrfToken: string) =>
    request<RouteItem>(`/api/routes/${routeId}`, {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  deleteRoute: (routeId: string, csrfToken: string) =>
    request<{ success: true }>(`/api/routes/${routeId}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  listNotes: (tripId: string) => request<NoteItem[]>(`/api/notes?tripId=${encodeURIComponent(tripId)}`),
  createNote: (input: NoteInput, csrfToken: string) =>
    request<NoteItem>("/api/notes", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  updateNote: (noteId: string, input: NoteInput, csrfToken: string) =>
    request<NoteItem>(`/api/notes/${noteId}`, {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  deleteNote: (noteId: string, csrfToken: string) =>
    request<{ success: true }>(`/api/notes/${noteId}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  listChecklists: (tripId: string) => request<ChecklistItem[]>(`/api/checklists?tripId=${encodeURIComponent(tripId)}`),
  createChecklistItem: (input: ChecklistInput, csrfToken: string) =>
    request<ChecklistItem>("/api/checklists", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  updateChecklistItem: (itemId: string, input: ChecklistInput, csrfToken: string) =>
    request<ChecklistItem>(`/api/checklists/${itemId}`, {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  deleteChecklistItem: (itemId: string, csrfToken: string) =>
    request<{ success: true }>(`/api/checklists/${itemId}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  getMapData: () => request<MapData>("/api/map"),
  getWeather: () => request<WeatherData>("/api/weather"),
  getWeatherAlerts: () => request<WeatherAlert[]>("/api/weather/alerts"),
  refreshWeather: (csrfToken: string) =>
    request<WeatherData>("/api/weather/refresh", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  listRoadMonitors: () => request<RoadMonitor[]>("/api/roads"),
  getRoadMonitor: (roadId: string) => request<RoadMonitorDetail>(`/api/roads/${roadId}`),
  createRoadMonitor: (input: RoadMonitorInput, csrfToken: string) =>
    request<RoadMonitor>("/api/roads", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  updateRoadMonitor: (roadId: string, input: RoadMonitorInput, csrfToken: string) =>
    request<RoadMonitor>(`/api/roads/${roadId}`, {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(input),
    }),
  deleteRoadMonitor: (roadId: string, csrfToken: string) =>
    request<{ success: true }>(`/api/roads/${roadId}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  refreshRoadMonitor: (roadId: string, csrfToken: string) =>
    request<RoadMonitor>(`/api/roads/${roadId}/refresh`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  testRoadParser: (roadId: string, csrfToken: string) =>
    request<{ persisted: false; normalized: { normalizedStatus: RoadStatus; severity: RoadSeverity; summary: string } }>(`/api/roads/${roadId}/test-parser`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  refreshAllRoadMonitors: (csrfToken: string) =>
    request<RoadMonitor[]>("/api/roads/refresh-all", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  confirmRoadStatus: (roadId: string, confirmedStatus: RoadStatus, note: string, expiresAt: string | null, csrfToken: string) =>
    request<RoadManualConfirmation>(`/api/roads/${roadId}/manual-confirmation`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ confirmedStatus, note, expiresAt }),
    }),
  clearRoadConfirmation: (roadId: string, csrfToken: string) =>
    request<{ success: true }>(`/api/roads/${roadId}/manual-confirmation`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  linkRoadDay: (roadId: string, tripDayId: string, note: string, csrfToken: string) =>
    request<{ success: true }>(`/api/roads/${roadId}/days`, {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ tripDayId, note }),
    }),
  unlinkRoadDay: (roadId: string, tripDayId: string, csrfToken: string) =>
    request<{ success: true }>(`/api/roads/${roadId}/days/${tripDayId}`, {
      method: "DELETE",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  updateRoadMode: (roadId: string, updateMode: RoadUpdateMode, csrfToken: string) =>
    request<RoadMonitor>(`/api/roads/${roadId}/update-mode`, {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ updateMode }),
    }),
  updateAllRoadModes: (updateMode: RoadUpdateMode, csrfToken: string) =>
    request<RoadMonitor[]>("/api/roads/update-mode/all", {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ updateMode }),
    }),
  exportAdminData: (csrfToken: string) =>
    request<AdminExport>("/api/admin/export", {
      headers: { "X-CSRF-Token": csrfToken },
    }),
  getAuditLog: (csrfToken: string) =>
    request<AuditLogItem[]>("/api/admin/audit", {
      headers: { "X-CSRF-Token": csrfToken },
    }),
  previewAdminImport: (payload: unknown, csrfToken: string) =>
    request<{ schemaVersion: number; mode: "merge" | "replace"; counts: Record<string, number> }>("/api/admin/import/preview", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(payload),
    }),
  applyAdminImport: (payload: unknown, mode: "merge" | "replace", csrfToken: string) =>
    request<{ success: true; importedRoadMonitors: number }>("/api/admin/import/apply", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify({ payload, mode }),
    }),
};
