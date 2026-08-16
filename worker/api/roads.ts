import type { RoadMonitorInput, RoadStatus, RoadUpdateMode } from "@/lib/api";
import { jsonError, jsonSuccess } from "../lib/response";
import { validateJsonBodySize } from "../lib/validation";
import { validatePublicHttpsUrl } from "../roads/adapters/safe-fetch";
import { checkRoadMonitor, runRoadMonitorCycle } from "../roads/scheduler";
import type { Repositories, SessionRecord, UserRecord } from "../types";

function canEdit(user: UserRecord | null) {
  return user?.role === "editor" || user?.role === "admin";
}

function canAdmin(user: UserRecord | null) {
  return user?.role === "admin";
}

function forbidden(user: UserRecord | null, admin = false) {
  if (admin ? !canAdmin(user) : !canEdit(user)) return jsonError(403, { code: "FORBIDDEN", message: admin ? "Admin access is required" : "Editor or admin access is required" });
  return null;
}

function csrf(request: Request, session: SessionRecord | null) {
  if (!session || request.headers.get("X-CSRF-Token") !== session.csrfToken) return jsonError(403, { code: "CSRF_INVALID", message: "Missing or invalid CSRF header" });
  return null;
}

async function body<T>(request: Request) {
  const text = await request.text();
  if (!validateJsonBodySize(text)) return { error: jsonError(400, { code: "BAD_REQUEST", message: "JSON body exceeds the size limit" }) };
  try {
    return { value: JSON.parse(text) as T };
  } catch {
    return { error: jsonError(400, { code: "BAD_REQUEST", message: "Invalid JSON body" }) };
  }
}

function audit(repositories: Repositories, user: UserRecord, action: string, entityId: string, metadata: Record<string, unknown> = {}) {
  return repositories.auditLog.insert({ actorUserId: user.id, action, entityType: "road_monitor", entityId, metadataJson: JSON.stringify(metadata), createdAt: new Date().toISOString() });
}

export async function listRoadMonitors(repositories: Repositories) {
  return jsonSuccess(await repositories.roads.list());
}

export async function getRoadMonitor(id: string, repositories: Repositories) {
  const road = await repositories.roads.get(id);
  return road ? jsonSuccess(road) : jsonError(404, { code: "NOT_FOUND", message: "Road monitor not found" });
}

export async function createRoadMonitor(request: Request, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = forbidden(user);
  const csrfError = csrf(request, session);
  if (denied) return denied;
  if (csrfError) return csrfError;
  const parsed = await body<RoadMonitorInput>(request);
  if (parsed.error || !parsed.value) return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid road monitor payload" });
  try { validatePublicHttpsUrl(parsed.value.officialUrl); } catch (error) { return jsonError(400, { code: "UNSAFE_URL", message: error instanceof Error ? error.message : "Unsafe road source URL" }); }
  const road = await repositories.roads.create(parsed.value);
  if (user) await audit(repositories, user, "road.create", road.id, { parserType: road.parserType, sourceType: road.sourceType });
  return jsonSuccess(road);
}

export async function updateRoadMonitor(request: Request, id: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = forbidden(user);
  const csrfError = csrf(request, session);
  if (denied) return denied;
  if (csrfError) return csrfError;
  const parsed = await body<RoadMonitorInput>(request);
  if (parsed.error || !parsed.value) return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid road monitor payload" });
  try { validatePublicHttpsUrl(parsed.value.officialUrl); } catch (error) { return jsonError(400, { code: "UNSAFE_URL", message: error instanceof Error ? error.message : "Unsafe road source URL" }); }
  const road = await repositories.roads.update(id, parsed.value);
  if (!road) return jsonError(404, { code: "NOT_FOUND", message: "Road monitor not found" });
  if (user) await audit(repositories, user, "road.update", id);
  return jsonSuccess(road);
}

export async function deleteRoadMonitor(request: Request, id: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = forbidden(user);
  const csrfError = csrf(request, session);
  if (denied) return denied;
  if (csrfError) return csrfError;
  await repositories.roads.delete(id);
  if (user) await audit(repositories, user, "road.delete", id);
  return jsonSuccess({ success: true });
}

export async function refreshRoad(request: Request, id: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = forbidden(user);
  const csrfError = csrf(request, session);
  if (denied) return denied;
  if (csrfError) return csrfError;
  const road = await repositories.roads.get(id);
  if (!road) return jsonError(404, { code: "NOT_FOUND", message: "Road monitor not found" });
  if (road.lastAttemptAt && Date.now() - Date.parse(road.lastAttemptAt) < road.minimumIntervalMinutes * 60_000) return jsonError(429, { code: "REFRESH_THROTTLED", message: "This road monitor was checked too recently" });
  const result = await checkRoadMonitor(repositories.roads, road, true);
  if (user) await audit(repositories, user, "road.refresh", id);
  return result ? jsonSuccess(result) : jsonError(500, { code: "ROAD_REFRESH_FAILED", message: "Road refresh failed" });
}

export async function refreshAllRoads(request: Request, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = forbidden(user);
  const csrfError = csrf(request, session);
  if (denied) return denied;
  if (csrfError) return csrfError;
  const roads = await runRoadMonitorCycle(repositories.roads);
  if (user) await audit(repositories, user, "road.refresh_all", "all");
  return jsonSuccess(roads);
}

export async function testRoadParser(request: Request, id: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = forbidden(user);
  const csrfError = csrf(request, session);
  if (denied) return denied;
  if (csrfError) return csrfError;
  const road = await repositories.roads.get(id);
  if (!road) return jsonError(404, { code: "NOT_FOUND", message: "Road monitor not found" });
  const adapter = (await import("../roads/adapters")).findRoadAdapter(road);
  if (!adapter) return jsonError(400, { code: "ADAPTER_UNSUPPORTED", message: "No adapter supports this configuration" });
  try {
    const normalized = await adapter.normalize(await adapter.fetch(road, {}), road);
    return jsonSuccess({ persisted: false, normalized });
  } catch (error) {
    return jsonError(502, { code: error instanceof Error && "code" in error ? String(error.code) : "ROAD_TEST_FAILED", message: error instanceof Error ? error.message : "Parser test failed" });
  }
}

export async function updateRoadMode(request: Request, id: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = forbidden(user);
  const csrfError = csrf(request, session);
  if (denied) return denied;
  if (csrfError) return csrfError;
  const parsed = await body<{ updateMode: RoadUpdateMode }>(request);
  if (parsed.error || !parsed.value || !["paused", "daily", "hourly"].includes(parsed.value.updateMode)) return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid road update mode" });
  const road = await repositories.roads.updateMode(id, parsed.value.updateMode);
  if (!road) return jsonError(404, { code: "NOT_FOUND", message: "Road monitor not found" });
  if (user) await audit(repositories, user, "road.mode.update", id, { updateMode: parsed.value.updateMode });
  return jsonSuccess(road);
}

export async function updateAllRoadModes(request: Request, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = forbidden(user);
  const csrfError = csrf(request, session);
  if (denied) return denied;
  if (csrfError) return csrfError;
  const parsed = await body<{ updateMode: RoadUpdateMode }>(request);
  if (parsed.error || !parsed.value || !["paused", "daily", "hourly"].includes(parsed.value.updateMode)) return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid road update mode" });
  const roads = await repositories.roads.updateAllModes(parsed.value.updateMode);
  if (user) await audit(repositories, user, "road.mode.update_all", "all", { updateMode: parsed.value.updateMode });
  return jsonSuccess(roads);
}

export async function confirmRoad(request: Request, id: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = forbidden(user);
  const csrfError = csrf(request, session);
  if (denied) return denied;
  if (csrfError) return csrfError;
  if (!user) return jsonError(401, { code: "UNAUTHORIZED", message: "Authentication required" });
  const parsed = await body<{ confirmedStatus: RoadStatus; note: string; expiresAt: string | null }>(request);
  if (parsed.error || !parsed.value || !["open", "open_with_caution", "delayed", "restricted", "partially_closed", "closed", "seasonal_closure", "unknown", "fetch_failed", "manual_review_required"].includes(parsed.value.confirmedStatus) || typeof parsed.value.note !== "string") return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid manual confirmation" });
  const confirmation = await repositories.roads.addConfirmation({ id: crypto.randomUUID(), roadMonitorId: id, confirmedStatus: parsed.value.confirmedStatus, note: parsed.value.note, confirmedBy: user.id, confirmedAt: new Date().toISOString(), expiresAt: parsed.value.expiresAt ?? null, createdAt: new Date().toISOString() });
  await audit(repositories, user, "road.manual_confirm", id, { confirmedStatus: confirmation.confirmedStatus });
  return jsonSuccess(confirmation);
}

export async function clearRoadConfirmation(request: Request, id: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = forbidden(user);
  const csrfError = csrf(request, session);
  if (denied) return denied;
  if (csrfError) return csrfError;
  await repositories.roads.clearConfirmation(id);
  if (user) await audit(repositories, user, "road.manual_confirm.clear", id);
  return jsonSuccess({ success: true });
}

export async function linkRoadDay(request: Request, id: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = forbidden(user);
  const csrfError = csrf(request, session);
  if (denied) return denied;
  if (csrfError) return csrfError;
  const parsed = await body<{ tripDayId: string; sortOrder?: number; note?: string }>(request);
  if (parsed.error || !parsed.value || typeof parsed.value.tripDayId !== "string" || !parsed.value.tripDayId) return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Trip day link requires tripDayId" });
  await repositories.roads.linkDay(id, parsed.value.tripDayId, Number.isInteger(parsed.value.sortOrder) ? parsed.value.sortOrder! : 0, parsed.value.note ?? "");
  if (user) await audit(repositories, user, "road.day.link", id, { tripDayId: parsed.value.tripDayId });
  return jsonSuccess({ success: true });
}

export async function unlinkRoadDay(request: Request, id: string, dayId: string, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = forbidden(user);
  const csrfError = csrf(request, session);
  if (denied) return denied;
  if (csrfError) return csrfError;
  await repositories.roads.unlinkDay(id, dayId);
  if (user) await audit(repositories, user, "road.day.unlink", id, { tripDayId: dayId });
  return jsonSuccess({ success: true });
}
