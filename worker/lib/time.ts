export function utcNowIso(date = new Date()) {
  return date.toISOString();
}

export function isExpired(isoTime: string, now = new Date()) {
  return new Date(isoTime).getTime() <= now.getTime();
}
