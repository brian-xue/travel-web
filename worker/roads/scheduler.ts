import type { RoadMonitor, RoadStatusSnapshot } from "@/lib/api";
import type { RoadRepository } from "../types";
import { findRoadAdapter } from "./adapters";
import { RoadSourceError, type RoadMonitorConfig } from "./types";

async function contentHash(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function snapshotBase(road: RoadMonitor, fetchedAt: string): RoadStatusSnapshot {
  return {
    id: crypto.randomUUID(),
    roadMonitorId: road.id,
    normalizedStatus: "fetch_failed",
    severity: "unknown",
    summary: "",
    sourceUpdatedAt: null,
    fetchedAt,
    contentHash: "",
    rawExcerpt: "",
    rawPayloadJson: "{}",
    isManual: false,
    stale: true,
    createdAt: fetchedAt,
  };
}

export async function checkRoadMonitor(repository: RoadRepository, road: RoadMonitor, force = false) {
  const now = new Date().toISOString();
  if (!force && (await repository.due(now)).every((item) => item.id !== road.id)) return repository.get(road.id);
  const adapter = findRoadAdapter(road as RoadMonitorConfig);
  if (!adapter) {
    const failure = snapshotBase(road, now);
    failure.summary = "No adapter is available for this monitor configuration.";
    failure.rawExcerpt = failure.summary;
    failure.contentHash = await contentHash(failure.summary);
    await repository.saveFailureSnapshot(failure, "ADAPTER_UNSUPPORTED", failure.summary);
    return repository.get(road.id);
  }

  try {
    await repository.markAttempt(road.id, now);
    const raw = await adapter.fetch(road as RoadMonitorConfig, {});
    const normalized = await adapter.normalize(raw, road as RoadMonitorConfig);
    const hash = await contentHash(`${normalized.normalizedStatus}|${normalized.summary}|${normalized.rawPayloadJson}`);
    const previous = road.currentSnapshot;
    const snapshot: RoadStatusSnapshot = {
      ...snapshotBase(road, now),
      normalizedStatus: normalized.normalizedStatus,
      severity: normalized.severity,
      summary: normalized.summary,
      sourceUpdatedAt: normalized.sourceUpdatedAt,
      contentHash: hash,
      rawExcerpt: normalized.rawExcerpt,
      rawPayloadJson: normalized.rawPayloadJson,
    };
    await repository.saveSnapshot(snapshot, { lastSuccessAt: now, lastChangedAt: !previous || previous.contentHash !== hash ? now : road.lastChangedAt });
  } catch (error) {
    const sourceError = error instanceof RoadSourceError ? error : new RoadSourceError("ROAD_CHECK_FAILED", "Road source check failed");
    const failure = snapshotBase(road, now);
    failure.summary = sourceError.message;
    failure.rawExcerpt = sourceError.message;
    failure.contentHash = await contentHash(`${sourceError.code}|${sourceError.message}`);
    await repository.saveFailureSnapshot(failure, sourceError.code, sourceError.message);
  }
  return repository.get(road.id);
}

export async function runRoadMonitorCycle(repository: RoadRepository) {
  const due = await repository.due(new Date().toISOString());
  const results: Array<RoadMonitor | null> = [];
  for (const road of due.slice(0, 10)) {
    results.push(await checkRoadMonitor(repository, road));
  }
  return results.filter((road): road is RoadMonitor => Boolean(road));
}
