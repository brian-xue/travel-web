import { RoadSourceError, type FetchContext, type RawRoadResult } from "../types";

const MAX_RESPONSE_BYTES = 1_000_000;
const BLOCKED_HOSTS = new Set(["localhost", "localhost.localdomain", "metadata.google.internal", "instance-data"]);

export function validatePublicHttpsUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new RoadSourceError("INVALID_URL", "The source URL is invalid");
  }
  const hostname = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new RoadSourceError("UNSAFE_URL", "Road sources must use public HTTPS without credentials or custom ports");
  }
  if (BLOCKED_HOSTS.has(hostname) || hostname.endsWith(".internal") || hostname.endsWith(".local")) {
    throw new RoadSourceError("SSRF_BLOCKED", "Private or internal source hosts are not allowed");
  }
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(hostname) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) || hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fe80:")) {
    throw new RoadSourceError("SSRF_BLOCKED", "Private or link-local source addresses are not allowed");
  }
  return url;
}

export async function fetchPublicSource(urlValue: string, context: FetchContext = {}): Promise<RawRoadResult> {
  const url = validatePublicHttpsUrl(urlValue);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), context.timeoutMs ?? 8_000);
  try {
    const fetcher = context.fetcher ?? fetch;
    const response = await fetcher(url, {
      headers: { Accept: "application/json, application/rss+xml, application/xml, text/html", "User-Agent": "travel-web-road-monitor/1.0" },
      redirect: "manual",
      signal: controller.signal,
    });
    if (response.status >= 300 && response.status < 400) throw new RoadSourceError("REDIRECT_BLOCKED", "Redirects are not followed automatically");
    if (!response.ok) throw new RoadSourceError("SOURCE_HTTP_ERROR", `Source returned HTTP ${response.status}`);
    const contentLength = Number(response.headers.get("Content-Length") ?? 0);
    const maxBytes = context.maxBytes ?? MAX_RESPONSE_BYTES;
    if (contentLength > maxBytes) throw new RoadSourceError("SOURCE_TOO_LARGE", "Source response exceeds the size limit");
    const body = await response.text();
    if (new TextEncoder().encode(body).byteLength > maxBytes) throw new RoadSourceError("SOURCE_TOO_LARGE", "Source response exceeds the size limit");
    return { status: response.status, contentType: response.headers.get("Content-Type") ?? "", body, sourceUpdatedAt: response.headers.get("Last-Modified"), sourceUrl: url.toString() };
  } catch (error) {
    if (error instanceof RoadSourceError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") throw new RoadSourceError("SOURCE_TIMEOUT", "Source request timed out");
    throw new RoadSourceError("SOURCE_FETCH_FAILED", error instanceof Error ? error.message : "Source request failed");
  } finally {
    clearTimeout(timeoutId);
  }
}
