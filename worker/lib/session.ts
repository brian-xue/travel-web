import type { SessionRecord } from "../types";

const encoder = new TextEncoder();
const LOCAL_LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1"]);

function randomHex(bytes = 24) {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(values)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function hashSessionToken(token: string, sessionSecret: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`${sessionSecret}:${token}`));
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionRecord(userId: string, sessionSecret: string, now: Date) {
  const token = randomHex(32);
  const csrfToken = randomHex(16);
  const tokenHash = await hashSessionToken(token, sessionSecret);
  const createdAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 7).toISOString();

  const session: SessionRecord = {
    id: crypto.randomUUID(),
    userId,
    tokenHash,
    csrfToken,
    expiresAt,
    createdAt,
    lastSeenAt: createdAt,
  };

  return { session, token };
}

function shouldUseSecureCookie(requestUrl?: string) {
  if (!requestUrl) {
    return true;
  }

  try {
    return !LOCAL_LOOPBACK_HOSTS.has(new URL(requestUrl).hostname);
  } catch {
    return true;
  }
}

export function buildSessionCookie(token: string, expiresAt: string, requestUrl?: string) {
  return `travel_web_session=${token}; HttpOnly${shouldUseSecureCookie(requestUrl) ? "; Secure" : ""}; SameSite=Lax; Path=/; Expires=${new Date(expiresAt).toUTCString()}`;
}

export function buildClearedSessionCookie(requestUrl?: string) {
  return `travel_web_session=; HttpOnly${shouldUseSecureCookie(requestUrl) ? "; Secure" : ""}; SameSite=Lax; Path=/; Max-Age=0`;
}

export function getSessionTokenFromCookie(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }
  const match = cookieHeader.match(/(?:^|;\s*)travel_web_session=([^;]+)/);
  return match?.[1] ?? null;
}
