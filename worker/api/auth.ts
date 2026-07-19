import { recordAttempt, isRateLimited } from "../auth/rateLimit";
import { verifyPassword } from "../lib/password";
import { buildClearedSessionCookie, buildSessionCookie, createSessionRecord, hashSessionToken } from "../lib/session";
import { isExpired } from "../lib/time";
import { jsonError, jsonSuccess } from "../lib/response";
import { validateLoginBody } from "../lib/validation";
import type { Repositories, WorkerEnv } from "../types";

async function buildViewerSession(repositories: Repositories) {
  const viewer = await repositories.users.getFirstByRole("viewer");
  if (!viewer || !viewer.enabled) {
    return {
      isAuthenticated: false,
      user: null,
      expiresAt: null,
      csrfToken: null,
    };
  }

  return {
    isAuthenticated: false,
    user: { id: viewer.id, displayName: viewer.displayName, role: viewer.role },
    expiresAt: null,
    csrfToken: null,
  };
}

async function matchRoleFromPassword(password: string, env: WorkerEnv) {
  if (env.EDITOR_PASSWORD_HASH && (await verifyPassword(password, env.EDITOR_PASSWORD_HASH))) {
    return "editor" as const;
  }
  if (env.AUTH_PASSWORD_HASH && (await verifyPassword(password, env.AUTH_PASSWORD_HASH))) {
    return "admin" as const;
  }
  return null;
}

export async function login(request: Request, env: WorkerEnv, repositories: Repositories) {
  const ip = request.headers.get("CF-Connecting-IP") ?? "127.0.0.1";
  if (isRateLimited(ip)) {
    return jsonError(429, {
      code: "RATE_LIMITED",
      message: "Too many login attempts. Please wait and try again.",
    });
  }

  const payload = (await request.json()) as { password: string };
  if (!validateLoginBody(payload)) {
    return jsonError(400, {
      code: "BAD_REQUEST",
      message: "Password is required",
    });
  }

  const role = await matchRoleFromPassword(payload.password, env);
  if (!role) {
    recordAttempt(ip);
    return jsonError(401, {
      code: "UNAUTHORIZED",
      message: "Invalid password",
    });
  }

  const user = await repositories.users.getFirstByRole(role);
  if (!user || !user.enabled) {
    return jsonError(403, {
      code: "FORBIDDEN",
      message: "User account unavailable",
    });
  }

  const { session, token } = await createSessionRecord(user.id, env.SESSION_SECRET, new Date());
  await repositories.sessions.create(session);
  await repositories.auditLog.insert({
    actorUserId: user.id,
    action: "auth.login",
    entityType: "session",
    entityId: session.id,
    metadataJson: JSON.stringify({ role: user.role }),
    createdAt: session.createdAt,
  });

  return jsonSuccess(
    {
      isAuthenticated: true,
      user: { id: user.id, displayName: user.displayName, role: user.role },
      expiresAt: session.expiresAt,
      csrfToken: session.csrfToken,
    },
    {
      headers: {
        "Set-Cookie": buildSessionCookie(token, session.expiresAt),
      },
    },
  );
}

export async function getSession(token: string | null, env: WorkerEnv, repositories: Repositories) {
  if (!token) {
    return jsonSuccess(await buildViewerSession(repositories));
  }

  const tokenHash = await hashSessionToken(token, env.SESSION_SECRET);
  const session = await repositories.sessions.findByTokenHash(tokenHash);
  if (!session || isExpired(session.expiresAt)) {
    return jsonSuccess(await buildViewerSession(repositories));
  }

  const user = await repositories.users.getById(session.userId);
  if (!user || !user.enabled) {
    return jsonSuccess(await buildViewerSession(repositories));
  }

  await repositories.sessions.touch(tokenHash, new Date().toISOString());

  return jsonSuccess({
    isAuthenticated: true,
    user: { id: user.id, displayName: user.displayName, role: user.role },
    expiresAt: session.expiresAt,
    csrfToken: session.csrfToken,
  });
}

export async function logout(token: string | null, request: Request, env: WorkerEnv, repositories: Repositories) {
  if (!token) {
    return jsonSuccess(
      { success: true },
      {
        headers: {
          "Set-Cookie": buildClearedSessionCookie(),
        },
      },
    );
  }

  const tokenHash = await hashSessionToken(token, env.SESSION_SECRET);
  const session = await repositories.sessions.findByTokenHash(tokenHash);
  if (session) {
    const csrfHeader = request.headers.get("X-CSRF-Token");
    if (!csrfHeader || csrfHeader !== session.csrfToken) {
      return jsonError(403, {
        code: "CSRF_INVALID",
        message: "Missing or invalid CSRF header",
      });
    }
    await repositories.sessions.deleteByTokenHash(tokenHash);
    await repositories.auditLog.insert({
      actorUserId: session.userId,
      action: "auth.logout",
      entityType: "session",
      entityId: session.id,
      metadataJson: JSON.stringify({ userId: session.userId }),
      createdAt: new Date().toISOString(),
    });
  }

  return jsonSuccess(
    { success: true },
    {
      headers: {
        "Set-Cookie": buildClearedSessionCookie(),
      },
    },
  );
}
