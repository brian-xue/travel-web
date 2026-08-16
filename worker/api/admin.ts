import type { AdminExport, RoadMonitorInput } from "@/lib/api";
import { jsonError, jsonSuccess } from "../lib/response";
import { validateJsonBodySize, validateRoadMonitorInput } from "../lib/validation";
import type { Repositories, SessionRecord, UserRecord } from "../types";

function requireAdmin(request: Request, user: UserRecord | null, session: SessionRecord | null) {
  if (user?.role !== "admin") return jsonError(403, { code: "FORBIDDEN", message: "Admin access is required" });
  if (!session || request.headers.get("X-CSRF-Token") !== session.csrfToken) return jsonError(403, { code: "CSRF_INVALID", message: "Missing or invalid CSRF header" });
  return null;
}

function isExport(value: unknown): value is AdminExport {
  const data = (value as AdminExport | null)?.data;
  return Boolean(value && typeof value === "object" && (value as AdminExport).schemaVersion === 1 && data && Array.isArray(data.roadMonitors) && data.roadMonitors.every((road) => validateRoadMonitorInput(road)));
}

async function parse(request: Request) {
  const text = await request.text();
  if (!validateJsonBodySize(text)) return { error: jsonError(400, { code: "BAD_REQUEST", message: "Import payload exceeds the size limit" }) };
  try { return { value: JSON.parse(text) as unknown }; } catch { return { error: jsonError(400, { code: "BAD_REQUEST", message: "Invalid import JSON" }) }; }
}

export async function exportAdminData(request: Request, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = requireAdmin(request, user, session);
  if (denied) return denied;
  const trips = await repositories.content.listTrips();
  const tripBundles = (await Promise.all(trips.map((trip) => repositories.content.getTripBundle(trip.id)))).filter((trip): trip is NonNullable<typeof trip> => Boolean(trip));
  const output: AdminExport = { schemaVersion: 1, exportedAt: new Date().toISOString(), data: { settings: await repositories.settings.get(), trips, tripBundles, places: await repositories.content.listPlaces(), roadMonitors: await repositories.roads.list() } };
  if (user) await repositories.auditLog.insert({ actorUserId: user.id, action: "admin.export", entityType: "export", entityId: "admin", metadataJson: JSON.stringify({ schemaVersion: 1 }), createdAt: output.exportedAt });
  return jsonSuccess(output);
}

export async function previewAdminImport(request: Request, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = requireAdmin(request, user, session);
  if (denied) return denied;
  const parsed = await parse(request);
  if (parsed.error || !isExport(parsed.value)) return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Unsupported export schema or invalid road monitor data" });
  return jsonSuccess({ schemaVersion: parsed.value.schemaVersion, mode: "merge" as const, counts: { trips: parsed.value.data.trips.length, places: parsed.value.data.places.length, roadMonitors: parsed.value.data.roadMonitors.length, tripBundles: parsed.value.data.tripBundles.length } });
}

export async function applyAdminImport(request: Request, repositories: Repositories, user: UserRecord | null, session: SessionRecord | null) {
  const denied = requireAdmin(request, user, session);
  if (denied) return denied;
  const parsed = await parse(request);
  const envelope = parsed.value as { payload?: unknown; mode?: "merge" | "replace" } | undefined;
  if (parsed.error || !envelope || !isExport(envelope.payload) || !["merge", "replace"].includes(envelope.mode ?? "")) return parsed.error ?? jsonError(400, { code: "BAD_REQUEST", message: "Invalid import payload or mode" });
  if (envelope.mode === "replace") {
    for (const road of await repositories.roads.list()) await repositories.roads.delete(road.id);
  }
  for (const road of envelope.payload.data.roadMonitors) {
    const input: RoadMonitorInput = { name: road.name, description: road.description, officialUrl: road.officialUrl, sourceType: road.sourceType, parserType: road.parserType, parserConfigJson: road.parserConfigJson, updateMode: road.updateMode, minimumIntervalMinutes: road.minimumIntervalMinutes, enabled: road.enabled, manualNote: road.manualNote };
    await repositories.roads.create(input);
  }
  if (user) await repositories.auditLog.insert({ actorUserId: user.id, action: "admin.import", entityType: "import", entityId: "admin", metadataJson: JSON.stringify({ schemaVersion: 1, mode: envelope.mode, roadMonitors: envelope.payload.data.roadMonitors.length }), createdAt: new Date().toISOString() });
  return jsonSuccess({ success: true, importedRoadMonitors: envelope.payload.data.roadMonitors.length });
}
