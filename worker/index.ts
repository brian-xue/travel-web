import { getSession, login, logout } from "./api/auth";
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
      const unauthorized = ensureAuthenticated(context);
      return applyCorsHeaders(request, unauthorized ?? (await getSettings(repositories)));
    }

    if (url.pathname === "/api/settings" && request.method === "PUT") {
      const unauthorized = ensureAuthenticated(context);
      return applyCorsHeaders(
        request,
        unauthorized ?? (await updateSettings(request, repositories, context.user!, context.session!)),
      );
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
