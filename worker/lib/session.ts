import type { SessionRecord } from "../types";

const encoder = new TextEncoder();

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

export function buildSessionCookie(token: string, expiresAt: string) {
  return `travel_web_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Expires=${new Date(expiresAt).toUTCString()}`;
}

export function buildClearedSessionCookie() {
  return "travel_web_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0";
}

export function getSessionTokenFromCookie(cookieHeader: string | null) {
  if (!cookieHeader) {
    return null;
  }
  const match = cookieHeader.match(/(?:^|;\s*)travel_web_session=([^;]+)/);
  return match?.[1] ?? null;
}
