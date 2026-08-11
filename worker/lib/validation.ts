import type {
  AppSettings,
  ChecklistInput,
  DayPlaceInput,
  DayPlaceReorderItem,
  NoteInput,
  PlaceInput,
  RouteInput,
  TripDayInput,
  TripInput,
} from "@/lib/api";

const MAX_MARKDOWN_LENGTH = 10_000;
const MAX_TITLE_LENGTH = 160;
const MAX_JSON_BODY_LENGTH = 200_000;
const MAX_GEOJSON_LENGTH = 150_000;

export function validateLoginBody(payload: unknown) {
  if (!payload || typeof payload !== "object" || typeof (payload as { password?: unknown }).password !== "string") {
    return false;
  }
  return (payload as { password: string }).password.trim().length >= 6;
}

export function validateSettings(payload: unknown): payload is AppSettings {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const value = payload as AppSettings;
  return (
    (value.weatherRefreshMinutes === 30 || value.weatherRefreshMinutes === 60) &&
    typeof value.roadMonitoringMode === "string" &&
    typeof value.releaseVersion === "string" &&
    typeof value.lastDataRefreshAt === "string" &&
    typeof value.uiPreferences?.compactCards === "boolean"
  );
}

export function validateLatitude(value: number) {
  return Number.isFinite(value) && value >= -90 && value <= 90;
}

export function validateLongitude(value: number) {
  return Number.isFinite(value) && value >= -180 && value <= 180;
}

export function validateOptionalUrl(value: string) {
  if (!value) {
    return true;
  }
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validateTitle(value: string) {
  return typeof value === "string" && value.trim().length > 0 && value.length <= MAX_TITLE_LENGTH;
}

function validateMarkdown(value: string) {
  return typeof value === "string" && value.length <= MAX_MARKDOWN_LENGTH;
}

export function validateTripInput(payload: unknown): payload is TripInput {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const value = payload as TripInput;
  return (
    validateTitle(value.name) &&
    typeof value.description === "string" &&
    value.description.length <= MAX_MARKDOWN_LENGTH &&
    ["draft", "published", "archived"].includes(value.status)
  );
}

export function validateTripDayInput(payload: unknown): payload is TripDayInput {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const value = payload as TripDayInput;
  return (
    validateTitle(value.title) &&
    typeof value.summary === "string" &&
    value.summary.length <= MAX_MARKDOWN_LENGTH &&
    Number.isFinite(value.estimatedDistanceKm) &&
    value.estimatedDistanceKm >= 0 &&
    Number.isFinite(value.estimatedDriveMinutes) &&
    value.estimatedDriveMinutes >= 0 &&
    validateOptionalUrl(value.googleMapsUrl) &&
    typeof value.enabled === "boolean"
  );
}

export function validatePlaceInput(payload: unknown): payload is PlaceInput {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const value = payload as PlaceInput;
  return (
    validateTitle(value.name) &&
    validateLatitude(value.latitude) &&
    validateLongitude(value.longitude) &&
    validateMarkdown(value.descriptionMarkdown) &&
    validateOptionalUrl(value.officialUrl) &&
    validateOptionalUrl(value.googleMapsUrl) &&
    typeof value.weatherEnabled === "boolean" &&
    typeof value.enabled === "boolean"
  );
}

export function validateDayPlaceInput(payload: unknown): payload is DayPlaceInput {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const value = payload as DayPlaceInput;
  return (
    typeof value.placeId === "string" &&
    value.placeId.length > 0 &&
    typeof value.plannedArrivalText === "string" &&
    Number.isFinite(value.plannedDurationMinutes) &&
    value.plannedDurationMinutes >= 0 &&
    validateMarkdown(value.noteMarkdown)
  );
}

export function validateDayPlaceReorderItems(payload: unknown): payload is DayPlaceReorderItem[] {
  return (
    Array.isArray(payload) &&
    payload.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        Number.isFinite(item.visitOrder) &&
        item.visitOrder >= 1,
    )
  );
}

export function validateChecklistInput(payload: unknown): payload is ChecklistInput {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const value = payload as ChecklistInput;
  return (
    typeof value.tripId === "string" &&
    validateTitle(value.title) &&
    typeof value.category === "string" &&
    Number.isFinite(value.quantity) &&
    value.quantity >= 0 &&
    Number.isFinite(value.priority) &&
    value.priority >= 0 &&
    typeof value.note === "string" &&
    typeof value.sortOrder === "number"
  );
}

export function validateNoteInput(payload: unknown): payload is NoteInput {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const value = payload as NoteInput;
  return (
    typeof value.tripId === "string" &&
    validateTitle(value.title) &&
    validateMarkdown(value.contentMarkdown) &&
    typeof value.sortOrder === "number" &&
    typeof value.enabled === "boolean"
  );
}

export function validateRouteInput(payload: unknown): payload is RouteInput {
  if (!payload || typeof payload !== "object") {
    return false;
  }
  const value = payload as RouteInput;
  return validateTitle(value.name) && typeof value.geojson === "string" && typeof value.styleJson === "string";
}

export function validateRouteGeoJson(rawGeoJson: string) {
  if (rawGeoJson.length > MAX_GEOJSON_LENGTH) {
    return { ok: false, message: "GeoJSON payload exceeds the size limit" } as const;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawGeoJson);
  } catch {
    return { ok: false, message: "GeoJSON could not be parsed" } as const;
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, message: "GeoJSON must be an object" } as const;
  }

  const geometry =
    (parsed as { type?: string; geometry?: { type?: string; coordinates?: unknown } }).type === "Feature"
      ? (parsed as { geometry?: { type?: string; coordinates?: unknown } }).geometry
      : (parsed as { type?: string; coordinates?: unknown });

  if (!geometry || !["LineString", "MultiLineString"].includes(geometry.type ?? "")) {
    return { ok: false, message: "Route geometry must be a LineString or MultiLineString" } as const;
  }

  const points =
    geometry.type === "LineString"
      ? (geometry.coordinates as unknown[])
      : (geometry.coordinates as unknown[]).flatMap((segment) => (Array.isArray(segment) ? segment : []));

  const validCoordinates = points.every(
    (point) =>
      Array.isArray(point) &&
      point.length >= 2 &&
      typeof point[0] === "number" &&
      typeof point[1] === "number" &&
      validateLongitude(point[0]) &&
      validateLatitude(point[1]),
  );

  if (!validCoordinates) {
    return { ok: false, message: "Route geometry contains invalid coordinates" } as const;
  }

  return { ok: true } as const;
}

export function validateJsonBodySize(text: string) {
  return text.length <= MAX_JSON_BODY_LENGTH;
}
