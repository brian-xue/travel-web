import type {
  ChecklistInput,
  DayPlaceInput,
  DayPlaceReorderItem,
  DayReorderItem,
  GeocodingResponse,
  NoteInput,
  PlaceInput,
  RouteInput,
  TripDayInput,
  TripInput,
} from "@/lib/api";
import { buildGoogleMapsDirectionsUrl, buildGoogleMapsPlaceUrl } from "../lib/googleMaps";
import { jsonError, jsonSuccess } from "../lib/response";
import {
  fetchWeatherForPlaces,
  shouldRefreshWeather,
} from "../lib/weather";
import {
  validateChecklistInput,
  validateDayPlaceInput,
  validateDayPlaceReorderItems,
  validateJsonBodySize,
  validateNoteInput,
  validatePlaceInput,
  validateRouteGeoJson,
  validateRouteInput,
  validateTripDayInput,
  validateTripInput,
} from "../lib/validation";
import type { Repositories, SessionRecord, UserRecord, WorkerEnv } from "../types";

function canEdit(user: UserRecord | null) {
  return user?.role === "editor" || user?.role === "admin";
}

function canAdmin(user: UserRecord | null) {
  return user?.role === "admin";
}

function requireEditor(user: UserRecord | null) {
  if (!canEdit(user)) {
    return jsonError(403, {
      code: "FORBIDDEN",
      message: "Editor or admin access is required",
    });
  }
  return null;
}

function requireAdmin(user: UserRecord | null) {
  if (!canAdmin(user)) {
    return jsonError(403, {
      code: "FORBIDDEN",
      message: "Admin access is required",
    });
  }
  return null;
}

function requireCsrf(request: Request, session: SessionRecord | null) {
  if (!session) {
    return jsonError(401, {
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  const csrfHeader = request.headers.get("X-CSRF-Token");
  if (!csrfHeader || csrfHeader !== session.csrfToken) {
    return jsonError(403, {
      code: "CSRF_INVALID",
      message: "Missing or invalid CSRF header",
    });
  }
  return null;
}

async function parseJsonBody<T>(request: Request) {
  const text = await request.text();
  if (!validateJsonBodySize(text)) {
    return { error: jsonError(400, { code: "BAD_REQUEST", message: "JSON body exceeds the size limit" }) };
  }
  return { value: JSON.parse(text) as T };
}

export async function getDashboard(repositories: Repositories) {
  return jsonSuccess(await repositories.content.getDashboard());
}

export async function listTrips(repositories: Repositories) {
  return jsonSuccess(await repositories.content.listTrips());
}

export async function createTrip(request: Request, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) {
    return forbidden;
  }
  if (csrf) {
    return csrf;
  }
  const parsed = await parseJsonBody<TripInput>(request);
  if (parsed.error || !validateTripInput(parsed.value)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid trip payload" });
  }
  const trip = await repositories.content.createTrip(parsed.value);
  return jsonSuccess(trip);
}

export async function getTrip(tripId: string, repositories: Repositories) {
  const trip = await repositories.content.getTripBundle(tripId);
  if (!trip) {
    return jsonError(404, { code: "NOT_FOUND", message: "Trip not found" });
  }
  return jsonSuccess(withComputedTripUrls(trip));
}

export async function updateTrip(
  request: Request,
  tripId: string,
  repositories: Repositories,
  user: UserRecord | null,
  session: SessionRecord | null,
) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) {
    return forbidden;
  }
  if (csrf) {
    return csrf;
  }
  const parsed = await parseJsonBody<TripInput>(request);
  if (parsed.error || !validateTripInput(parsed.value)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid trip payload" });
  }
  const result = await repositories.content.updateTrip(tripId, parsed.value);
  if (result.conflict) {
    return jsonError(409, { code: "CONFLICT", message: "Trip data changed. Refresh and try again." });
  }
  if (!result.record) {
    return jsonError(404, { code: "NOT_FOUND", message: "Trip not found" });
  }
  return jsonSuccess(result.record);
}

export async function deleteTrip(
  request: Request,
  tripId: string,
  repositories: Repositories,
  user: UserRecord | null,
  session: SessionRecord | null,
) {
  const forbidden = requireAdmin(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) {
    return forbidden;
  }
  if (csrf) {
    return csrf;
  }
  await repositories.content.deleteTrip(tripId);
  return jsonSuccess({ success: true });
}

export async function publishTrip(
  request: Request,
  tripId: string,
  repositories: Repositories,
  user: UserRecord | null,
  session: SessionRecord | null,
) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) {
    return forbidden;
  }
  if (csrf) {
    return csrf;
  }
  const trip = await repositories.content.publishTrip(tripId);
  if (!trip) {
    return jsonError(404, { code: "NOT_FOUND", message: "Trip not found" });
  }
  return jsonSuccess(trip);
}

export async function listTripDays(tripId: string, repositories: Repositories) {
  return jsonSuccess((await repositories.content.listTripDays(tripId)).map((day) => withComputedDayUrl(day)));
}

export async function createTripDay(
  request: Request,
  tripId: string,
  repositories: Repositories,
  user: UserRecord | null,
  session: SessionRecord | null,
) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) {
    return forbidden;
  }
  if (csrf) {
    return csrf;
  }
  const parsed = await parseJsonBody<TripDayInput>(request);
  if (parsed.error || !validateTripDayInput(parsed.value)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid day payload" });
  }
  return jsonSuccess(await repositories.content.createTripDay(tripId, parsed.value));
}

export async function updateTripDay(
  request: Request,
  dayId: string,
  repositories: Repositories,
  user: UserRecord | null,
  session: SessionRecord | null,
) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) {
    return forbidden;
  }
  if (csrf) {
    return csrf;
  }
  const parsed = await parseJsonBody<TripDayInput>(request);
  if (parsed.error || !validateTripDayInput(parsed.value)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid day payload" });
  }
  const result = await repositories.content.updateTripDay(dayId, parsed.value);
  if (result.conflict) {
    return jsonError(409, { code: "CONFLICT", message: "Day data changed. Refresh and try again." });
  }
  if (!result.record) {
    return jsonError(404, { code: "NOT_FOUND", message: "Day not found" });
  }
  return jsonSuccess(result.record);
}

export async function deleteTripDay(request: Request, dayId: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  await repositories.content.deleteTripDay(dayId);
  return jsonSuccess({ success: true });
}

export async function copyTripDay(request: Request, dayId: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  const copy = await repositories.content.copyTripDay(dayId);
  if (!copy) {
    return jsonError(404, { code: "NOT_FOUND", message: "Day not found" });
  }
  return jsonSuccess(copy);
}

export async function reorderTripDays(request: Request, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  const parsed = await parseJsonBody<{ items: DayReorderItem[] }>(request);
  const items = parsed.value?.items;
  if (parsed.error || !Array.isArray(items)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid reorder payload" });
  }
  await repositories.content.reorderTripDays(items);
  return jsonSuccess({ success: true });
}

export async function listPlaces(repositories: Repositories) {
  const places = await repositories.content.listPlaces();
  return jsonSuccess(
    places.map((place) => ({
      ...place,
      googleMapsUrl: place.googleMapsUrl || buildGoogleMapsPlaceUrl(place),
    })),
  );
}

export async function searchGeocoding(request: Request, env: WorkerEnv) {
  if (!env.MAPTILER_API_KEY) {
    return jsonError(503, {
      code: "MAPTILER_NOT_CONFIGURED",
      message: "MapTiler geocoding is not configured",
    });
  }

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 3) {
    return jsonError(400, {
      code: "BAD_REQUEST",
      message: "Geocoding queries must contain at least 3 characters",
    });
  }

  const endpoint = new URL(`https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json`);
  endpoint.searchParams.set("key", env.MAPTILER_API_KEY);
  endpoint.searchParams.set("country", "us");
  endpoint.searchParams.set("language", "en");
  endpoint.searchParams.set("limit", "5");
  endpoint.searchParams.set("autocomplete", "true");

  const response = await fetch(endpoint);
  if (!response.ok) {
    return jsonError(502, {
      code: "GEOCODING_UNAVAILABLE",
      message: "MapTiler could not complete the place search",
    });
  }

  const payload = (await response.json()) as GeocodingResponse;
  return jsonSuccess({ features: Array.isArray(payload.features) ? payload.features.slice(0, 5) : [] });
}

export async function createPlace(request: Request, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  const parsed = await parseJsonBody<PlaceInput>(request);
  if (parsed.error || !validatePlaceInput(parsed.value)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid place payload" });
  }
  const input = {
    ...parsed.value,
    googleMapsUrl:
      parsed.value.googleMapsUrl ||
      buildGoogleMapsPlaceUrl({
        name: parsed.value.name,
        latitude: parsed.value.latitude,
        longitude: parsed.value.longitude,
      }),
  };
  return jsonSuccess(await repositories.content.createPlace(input));
}

export async function updatePlace(
  request: Request,
  placeId: string,
  repositories: Repositories,
  user: UserRecord | null,
  session: SessionRecord | null,
) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  const parsed = await parseJsonBody<PlaceInput>(request);
  if (parsed.error || !validatePlaceInput(parsed.value)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid place payload" });
  }
  const result = await repositories.content.updatePlace(placeId, parsed.value);
  if (result.conflict) {
    return jsonError(409, { code: "CONFLICT", message: "Place data changed. Refresh and try again." });
  }
  if (!result.record) {
    return jsonError(404, { code: "NOT_FOUND", message: "Place not found" });
  }
  return jsonSuccess(result.record);
}

export async function deletePlace(request: Request, placeId: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  await repositories.content.deletePlace(placeId);
  return jsonSuccess({ success: true });
}

export async function addDayPlace(
  request: Request,
  dayId: string,
  repositories: Repositories,
  user: UserRecord | null,
  session: SessionRecord | null,
) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  const parsed = await parseJsonBody<DayPlaceInput>(request);
  if (parsed.error || !validateDayPlaceInput(parsed.value)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid day-place payload" });
  }
  const record = await repositories.content.addDayPlace(dayId, parsed.value);
  if (!record) {
    return jsonError(404, { code: "NOT_FOUND", message: "Place or day not found" });
  }
  return jsonSuccess(record);
}

export async function removeDayPlace(
  request: Request,
  dayPlaceId: string,
  repositories: Repositories,
  user: UserRecord | null,
  session: SessionRecord | null,
) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  await repositories.content.removeDayPlace(dayPlaceId);
  return jsonSuccess({ success: true });
}

export async function reorderDayPlaces(request: Request, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  const parsed = await parseJsonBody<{ items: DayPlaceReorderItem[] }>(request);
  if (parsed.error || !validateDayPlaceReorderItems(parsed.value?.items)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid day-place reorder payload" });
  }
  await repositories.content.reorderDayPlaces(parsed.value.items);
  return jsonSuccess({ success: true });
}

export async function listRoutes(dayId: string, repositories: Repositories) {
  return jsonSuccess(await repositories.content.listRoutes(dayId));
}

export async function createRoute(request: Request, dayId: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  const parsed = await parseJsonBody<RouteInput>(request);
  if (parsed.error || !validateRouteInput(parsed.value)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid route payload" });
  }
  const geojsonValidation = validateRouteGeoJson(parsed.value.geojson);
  if (!geojsonValidation.ok) {
    return jsonError(400, { code: "BAD_REQUEST", message: geojsonValidation.message });
  }
  const route = await repositories.content.createRoute(dayId, parsed.value);
  if (!route) {
    return jsonError(404, { code: "NOT_FOUND", message: "Trip day not found" });
  }
  return jsonSuccess(route);
}

export async function updateRoute(
  request: Request,
  routeId: string,
  repositories: Repositories,
  user: UserRecord | null,
  session: SessionRecord | null,
) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  const parsed = await parseJsonBody<RouteInput>(request);
  if (parsed.error || !validateRouteInput(parsed.value)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid route payload" });
  }
  const geojsonValidation = validateRouteGeoJson(parsed.value.geojson);
  if (!geojsonValidation.ok) {
    return jsonError(400, { code: "BAD_REQUEST", message: geojsonValidation.message });
  }
  const result = await repositories.content.updateRoute(routeId, parsed.value);
  if (result.conflict) {
    return jsonError(409, { code: "CONFLICT", message: "Route data changed. Refresh and try again." });
  }
  if (!result.record) {
    return jsonError(404, { code: "NOT_FOUND", message: "Route not found" });
  }
  return jsonSuccess(result.record);
}

export async function deleteRoute(request: Request, routeId: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  await repositories.content.deleteRoute(routeId);
  return jsonSuccess({ success: true });
}

export async function listNotes(request: Request, repositories: Repositories) {
  const tripId = new URL(request.url).searchParams.get("tripId");
  if (!tripId) {
    return jsonError(400, { code: "BAD_REQUEST", message: "tripId is required" });
  }
  return jsonSuccess(await repositories.content.listNotes(tripId));
}

export async function createNote(request: Request, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  const parsed = await parseJsonBody<NoteInput>(request);
  if (parsed.error || !validateNoteInput(parsed.value)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid note payload" });
  }
  return jsonSuccess(await repositories.content.createNote(parsed.value));
}

export async function updateNote(
  request: Request,
  noteId: string,
  repositories: Repositories,
  user: UserRecord | null,
  session: SessionRecord | null,
) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  const parsed = await parseJsonBody<NoteInput>(request);
  if (parsed.error || !validateNoteInput(parsed.value)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid note payload" });
  }
  const result = await repositories.content.updateNote(noteId, parsed.value);
  if (result.conflict) {
    return jsonError(409, { code: "CONFLICT", message: "Note data changed. Refresh and try again." });
  }
  if (!result.record) {
    return jsonError(404, { code: "NOT_FOUND", message: "Note not found" });
  }
  return jsonSuccess(result.record);
}

export async function deleteNote(request: Request, noteId: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  await repositories.content.deleteNote(noteId);
  return jsonSuccess({ success: true });
}

export async function listChecklists(request: Request, repositories: Repositories) {
  const tripId = new URL(request.url).searchParams.get("tripId");
  if (!tripId) {
    return jsonError(400, { code: "BAD_REQUEST", message: "tripId is required" });
  }
  return jsonSuccess(await repositories.content.listChecklistItems(tripId));
}

export async function createChecklistItem(request: Request, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  const parsed = await parseJsonBody<ChecklistInput>(request);
  if (parsed.error || !validateChecklistInput(parsed.value)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid checklist payload" });
  }
  return jsonSuccess(await repositories.content.createChecklistItem(parsed.value));
}

export async function updateChecklistItem(
  request: Request,
  itemId: string,
  repositories: Repositories,
  user: UserRecord | null,
  session: SessionRecord | null,
) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  const parsed = await parseJsonBody<ChecklistInput>(request);
  if (parsed.error || !validateChecklistInput(parsed.value)) {
    return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid checklist payload" });
  }
  const result = await repositories.content.updateChecklistItem(itemId, parsed.value);
  if (result.conflict) {
    return jsonError(409, { code: "CONFLICT", message: "Checklist data changed. Refresh and try again." });
  }
  if (!result.record) {
    return jsonError(404, { code: "NOT_FOUND", message: "Checklist item not found" });
  }
  return jsonSuccess(result.record);
}

export async function deleteChecklistItem(
  request: Request,
  itemId: string,
  repositories: Repositories,
  user: UserRecord | null,
  session: SessionRecord | null,
) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;
  await repositories.content.deleteChecklistItem(itemId);
  return jsonSuccess({ success: true });
}

export async function getMapData(env: WorkerEnv, repositories: Repositories) {
  const styleUrl = env.MAPTILER_API_KEY
    ? `https://api.maptiler.com/maps/streets/style.json?key=${encodeURIComponent(env.MAPTILER_API_KEY)}`
    : null;
  return jsonSuccess(await repositories.content.getMapData(Boolean(env.MAPTILER_API_KEY), styleUrl));
}

export async function getWeatherData(repositories: Repositories) {
  return jsonSuccess(await repositories.content.getWeatherData());
}

export async function getWeatherAlerts(repositories: Repositories) {
  const data = await repositories.content.getWeatherData();
  return jsonSuccess(data.alerts);
}

export async function refreshWeather(
  request: Request,
  env: WorkerEnv,
  repositories: Repositories,
  user: UserRecord | null,
  session: SessionRecord | null,
) {
  const forbidden = requireEditor(user);
  const csrf = requireCsrf(request, session);
  if (forbidden) return forbidden;
  if (csrf) return csrf;

  const settings = await repositories.settings.get();
  const currentWeather = await repositories.content.getWeatherData();
  if (!shouldRefreshWeather(currentWeather.refreshedAt, settings.weatherRefreshMinutes)) {
    return jsonSuccess(currentWeather);
  }

  const refreshed = await fetchWeatherForPlaces(
    currentWeather.places,
    fetch,
    env.NWS_USER_AGENT ?? "travel-web/1.0 contact@example.invalid",
    currentWeather.snapshots,
  );
  await repositories.content.replaceWeatherSnapshots(refreshed.snapshots);
  await repositories.content.replaceWeatherAlerts(refreshed.alerts);
  return jsonSuccess(await repositories.content.getWeatherData());
}

function withComputedTripUrls(trip: Awaited<ReturnType<Repositories["content"]["getTripBundle"]>> extends infer T ? Exclude<T, null> : never) {
  return {
    ...trip,
    days: trip.days.map((day) => withComputedDayUrl(day)),
  };
}

function withComputedDayUrl(day: Awaited<ReturnType<Repositories["content"]["listTripDays"]>>[number]) {
  const waypointPlaces = day.places.map((item) => item.place);
  return {
    ...day,
    googleMapsUrl: day.googleMapsUrl || buildGoogleMapsDirectionsUrl(waypointPlaces),
  };
}
