const attempts = new Map<string, { count: number; firstAttemptAt: number }>();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function isRateLimited(ip: string, now = Date.now()) {
  const entry = attempts.get(ip);
  if (!entry) {
    return false;
  }
  if (now - entry.firstAttemptAt > WINDOW_MS) {
    attempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

export function recordAttempt(ip: string, now = Date.now()) {
  const current = attempts.get(ip);
  if (!current || now - current.firstAttemptAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAttemptAt: now });
    return;
  }
  attempts.set(ip, { count: current.count + 1, firstAttemptAt: current.firstAttemptAt });
}
