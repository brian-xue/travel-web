import type { RoadMonitor, RoadParserType, RoadSeverity, RoadStatus } from "@/lib/api";

export type RoadMonitorConfig = RoadMonitor;

export interface FetchContext {
  fetcher?: typeof fetch;
  timeoutMs?: number;
  maxBytes?: number;
}

export interface RawRoadResult {
  status: number;
  contentType: string;
  body: string;
  sourceUpdatedAt: string | null;
  sourceUrl: string;
}

export interface NormalizedRoadStatus {
  normalizedStatus: RoadStatus;
  severity: RoadSeverity;
  summary: string;
  sourceUpdatedAt: string | null;
  rawExcerpt: string;
  rawPayloadJson: string;
  confidence: "high" | "medium" | "low";
}

export interface RoadSourceAdapter {
  canHandle(config: RoadMonitorConfig): boolean;
  fetch(config: RoadMonitorConfig, context: FetchContext): Promise<RawRoadResult>;
  normalize(result: RawRoadResult, config: RoadMonitorConfig): Promise<NormalizedRoadStatus>;
}

export class RoadSourceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "RoadSourceError";
  }
}

export function parseConfig(config: RoadMonitorConfig): Record<string, unknown> {
  try {
    const parsed = JSON.parse(config.parserConfigJson) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function getPath(value: unknown, path: string | undefined): unknown {
  if (!path) return undefined;
  return path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

export function cleanExcerpt(value: string, maxLength = 500) {
  return value.replace(/\s+/g, " ").trim().slice(0, maxLength);
}

export function statusFromText(value: string, statusMap: Record<string, RoadStatus> = {}) {
  const text = value.toLowerCase();
  for (const [keyword, status] of Object.entries(statusMap)) {
    if (text.includes(keyword.toLowerCase())) return status;
  }
  if (/seasonal\s+clos|winter\s+clos/.test(text)) return "seasonal_closure";
  if (/fully\s+clos|closed|closure/.test(text)) return "closed";
  if (/restrict|limited|chain|traction/.test(text)) return "restricted";
  if (/delay|wait|hold/.test(text)) return "delayed";
  if (/caution|warning|hazard|advisory/.test(text)) return "open_with_caution";
  if (/open|clear/.test(text)) return "open";
  return "manual_review_required";
}

export function severityForStatus(status: RoadStatus): RoadSeverity {
  if (status === "closed" || status === "seasonal_closure") return "critical";
  if (status === "restricted" || status === "partially_closed") return "high";
  if (status === "delayed" || status === "open_with_caution") return "medium";
  if (status === "open") return "info";
  return "unknown";
}

export function adapterParserType(config: RoadMonitorConfig): RoadParserType {
  return config.parserType;
}
