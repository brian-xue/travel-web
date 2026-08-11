import { getSession, login, logout } from "./api/auth";
import {
  addDayPlace,
  copyTripDay,
  createChecklistItem,
  createNote,
  createPlace,
  createRoute,
  createTrip,
  createTripDay,
  deleteChecklistItem,
  deleteNote,
  deletePlace,
  deleteRoute,
  deleteTrip,
  deleteTripDay,
  getDashboard,
  getMapData,
  getTrip,
  getWeatherAlerts,
  getWeatherData,
  listChecklists,
  listNotes,
  listPlaces,
  listRoutes,
  listTripDays,
  listTrips,
  publishTrip,
  refreshWeather,
  removeDayPlace,
  reorderDayPlaces,
  reorderTripDays,
  searchGeocoding,
  updateChecklistItem,
  updateNote,
  updatePlace,
  updateRoute,
  updateTrip,
  updateTripDay,
} from "./api/content";
import { handleHealthCheck } from "./api/health";
import { getSettings, updateSettings } from "./api/settings";
import { createRepositories } from "./db/repositories";
import { getSessionTokenFromCookie, hashSessionToken } from "./lib/session";
import { isExpired } from "./lib/time";
import { jsonError } from "./lib/response";
import type { Repositories, WorkerEnv } from "./types";

const LOCAL_DEV_ORIGINS = new Set(["http://localhost:5173", "http://127.0.0.1:5173"]);

interface RequestContext {
  repositories: Repositories;
  token: string | null;
  session: Awaited<ReturnType<Repositories["sessions"]["findByTokenHash"]>>;
  user: Awaited<ReturnType<Repositories["users"]["getById"]>>;
}

async function buildRequestContext(request: Request, env: WorkerEnv, repositories: Repositories): Promise<RequestContext> {
  const token = getSessionTokenFromCookie(request.headers.get("Cookie"));
  if (!token) {
    return { repositories, token: null, session: null, user: null };
  }

  const tokenHash = await hashSessionToken(token, env.SESSION_SECRET);
  const session = await repositories.sessions.findByTokenHash(tokenHash);
  if (!session || isExpired(session.expiresAt)) {
    return { repositories, token, session: null, user: null };
  }

  const user = await repositories.users.getById(session.userId);
  return { repositories, token, session, user };
}

function ensureAuthenticated(context: RequestContext) {
  if (!context.session || !context.user) {
    return jsonError(401, {
      code: "UNAUTHORIZED",
      message: "Authentication required",
    });
  }
  return null;
}

function getAllowedOrigin(request: Request) {
  const origin = request.headers.get("Origin");
  if (!origin) {
    return null;
  }

  return LOCAL_DEV_ORIGINS.has(origin) ? origin : null;
}

function applyCorsHeaders(request: Request, response: Response) {
  const headers = new Headers(response.headers);
  const allowedOrigin = getAllowedOrigin(request);

  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
    headers.set("Access-Control-Allow-Credentials", "true");
  }

  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, X-CSRF-Token");
  headers.set("Vary", "Origin");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export async function handleRequest(request: Request, env: WorkerEnv, repositories = createRepositories(env)) {
  try {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return applyCorsHeaders(request, new Response(null, { status: 204 }));
    }

    const context = await buildRequestContext(request, env, repositories);

    if (url.pathname === "/api/health" && request.method === "GET") {
      return applyCorsHeaders(request, handleHealthCheck());
    }

    if (url.pathname === "/api/dashboard" && request.method === "GET") {
      return applyCorsHeaders(request, await getDashboard(repositories));
    }

    if (url.pathname === "/api/auth/login" && request.method === "POST") {
      return applyCorsHeaders(request, await login(request, env, repositories));
    }

    if (url.pathname === "/api/auth/logout" && request.method === "POST") {
      return applyCorsHeaders(request, await logout(context.token, request, env, repositories));
    }

    if (url.pathname === "/api/auth/session" && request.method === "GET") {
      return applyCorsHeaders(request, await getSession(context.token, env, repositories));
    }

    if (url.pathname === "/api/settings" && request.method === "GET") {
      return applyCorsHeaders(request, await getSettings(repositories));
    }

    if (url.pathname === "/api/settings" && request.method === "PUT") {
      const unauthorized = ensureAuthenticated(context);
      return applyCorsHeaders(
        request,
        unauthorized ?? (await updateSettings(request, repositories, context.user!, context.session!)),
      );
    }

    if (url.pathname === "/api/trips" && request.method === "GET") {
      return applyCorsHeaders(request, await listTrips(repositories));
    }

    if (url.pathname === "/api/trips" && request.method === "POST") {
      return applyCorsHeaders(request, await createTrip(request, repositories, context.user, context.session));
    }

    const tripMatch = url.pathname.match(/^\/api\/trips\/([^/]+)$/);
    if (tripMatch && request.method === "GET") {
      return applyCorsHeaders(request, await getTrip(tripMatch[1], repositories));
    }
    if (tripMatch && request.method === "PUT") {
      return applyCorsHeaders(request, await updateTrip(request, tripMatch[1], repositories, context.user, context.session));
    }
    if (tripMatch && request.method === "DELETE") {
      return applyCorsHeaders(request, await deleteTrip(request, tripMatch[1], repositories, context.user, context.session));
    }

    const publishMatch = url.pathname.match(/^\/api\/trips\/([^/]+)\/publish$/);
    if (publishMatch && request.method === "POST") {
      return applyCorsHeaders(request, await publishTrip(request, publishMatch[1], repositories, context.user, context.session));
    }

    const tripDaysMatch = url.pathname.match(/^\/api\/trips\/([^/]+)\/days$/);
    if (tripDaysMatch && request.method === "GET") {
      return applyCorsHeaders(request, await listTripDays(tripDaysMatch[1], repositories));
    }
    if (tripDaysMatch && request.method === "POST") {
      return applyCorsHeaders(request, await createTripDay(request, tripDaysMatch[1], repositories, context.user, context.session));
    }

    const dayMatch = url.pathname.match(/^\/api\/days\/([^/]+)$/);
    if (dayMatch && request.method === "PUT") {
      return applyCorsHeaders(request, await updateTripDay(request, dayMatch[1], repositories, context.user, context.session));
    }
    if (dayMatch && request.method === "DELETE") {
      return applyCorsHeaders(request, await deleteTripDay(request, dayMatch[1], repositories, context.user, context.session));
    }

    const dayCopyMatch = url.pathname.match(/^\/api\/days\/([^/]+)\/copy$/);
    if (dayCopyMatch && request.method === "POST") {
      return applyCorsHeaders(request, await copyTripDay(request, dayCopyMatch[1], repositories, context.user, context.session));
    }

    if (url.pathname === "/api/days/reorder" && request.method === "POST") {
      return applyCorsHeaders(request, await reorderTripDays(request, repositories, context.user, context.session));
    }

    if (url.pathname === "/api/places" && request.method === "GET") {
      return applyCorsHeaders(request, await listPlaces(repositories));
    }
    if (url.pathname === "/api/geocoding" && request.method === "GET") {
      return applyCorsHeaders(request, await searchGeocoding(request, env));
    }
    if (url.pathname === "/api/places" && request.method === "POST") {
      return applyCorsHeaders(request, await createPlace(request, repositories, context.user, context.session));
    }
    const placeMatch = url.pathname.match(/^\/api\/places\/([^/]+)$/);
    if (placeMatch && request.method === "PUT") {
      return applyCorsHeaders(request, await updatePlace(request, placeMatch[1], repositories, context.user, context.session));
    }
    if (placeMatch && request.method === "DELETE") {
      return applyCorsHeaders(request, await deletePlace(request, placeMatch[1], repositories, context.user, context.session));
    }

    const dayPlacesMatch = url.pathname.match(/^\/api\/days\/([^/]+)\/places$/);
    if (dayPlacesMatch && request.method === "POST") {
      return applyCorsHeaders(request, await addDayPlace(request, dayPlacesMatch[1], repositories, context.user, context.session));
    }

    const dayPlaceMatch = url.pathname.match(/^\/api\/day-places\/([^/]+)$/);
    if (dayPlaceMatch && request.method === "DELETE") {
      return applyCorsHeaders(request, await removeDayPlace(request, dayPlaceMatch[1], repositories, context.user, context.session));
    }
    if (url.pathname === "/api/day-places/reorder" && request.method === "POST") {
      return applyCorsHeaders(request, await reorderDayPlaces(request, repositories, context.user, context.session));
    }

    const dayRoutesMatch = url.pathname.match(/^\/api\/days\/([^/]+)\/routes$/);
    if (dayRoutesMatch && request.method === "GET") {
      return applyCorsHeaders(request, await listRoutes(dayRoutesMatch[1], repositories));
    }
    if (dayRoutesMatch && request.method === "POST") {
      return applyCorsHeaders(request, await createRoute(request, dayRoutesMatch[1], repositories, context.user, context.session));
    }
    const routeMatch = url.pathname.match(/^\/api\/routes\/([^/]+)$/);
    if (routeMatch && request.method === "PUT") {
      return applyCorsHeaders(request, await updateRoute(request, routeMatch[1], repositories, context.user, context.session));
    }
    if (routeMatch && request.method === "DELETE") {
      return applyCorsHeaders(request, await deleteRoute(request, routeMatch[1], repositories, context.user, context.session));
    }

    if (url.pathname === "/api/notes" && request.method === "GET") {
      return applyCorsHeaders(request, await listNotes(request, repositories));
    }
    if (url.pathname === "/api/notes" && request.method === "POST") {
      return applyCorsHeaders(request, await createNote(request, repositories, context.user, context.session));
    }
    const noteMatch = url.pathname.match(/^\/api\/notes\/([^/]+)$/);
    if (noteMatch && request.method === "PUT") {
      return applyCorsHeaders(request, await updateNote(request, noteMatch[1], repositories, context.user, context.session));
    }
    if (noteMatch && request.method === "DELETE") {
      return applyCorsHeaders(request, await deleteNote(request, noteMatch[1], repositories, context.user, context.session));
    }

    if (url.pathname === "/api/checklists" && request.method === "GET") {
      return applyCorsHeaders(request, await listChecklists(request, repositories));
    }
    if (url.pathname === "/api/checklists" && request.method === "POST") {
      return applyCorsHeaders(request, await createChecklistItem(request, repositories, context.user, context.session));
    }
    const checklistMatch = url.pathname.match(/^\/api\/checklists\/([^/]+)$/);
    if (checklistMatch && request.method === "PUT") {
      return applyCorsHeaders(request, await updateChecklistItem(request, checklistMatch[1], repositories, context.user, context.session));
    }
    if (checklistMatch && request.method === "DELETE") {
      return applyCorsHeaders(request, await deleteChecklistItem(request, checklistMatch[1], repositories, context.user, context.session));
    }

    if (url.pathname === "/api/map" && request.method === "GET") {
      return applyCorsHeaders(request, await getMapData(env, repositories));
    }
    if (url.pathname === "/api/weather" && request.method === "GET") {
      return applyCorsHeaders(request, await getWeatherData(repositories));
    }
    if (url.pathname === "/api/weather/alerts" && request.method === "GET") {
      return applyCorsHeaders(request, await getWeatherAlerts(repositories));
    }
    if (url.pathname === "/api/weather/refresh" && request.method === "POST") {
      return applyCorsHeaders(request, await refreshWeather(request, env, repositories, context.user, context.session));
    }

    return applyCorsHeaders(
      request,
      jsonError(404, {
        code: "NOT_FOUND",
        message: "Route not found",
      }),
    );
  } catch {
    return applyCorsHeaders(
      request,
      jsonError(500, {
        code: "INTERNAL_ERROR",
        message: "Unexpected server error",
      }),
    );
  }
}

export default {
  fetch(request: Request, env: WorkerEnv) {
    return handleRequest(request, env);
  },
};
