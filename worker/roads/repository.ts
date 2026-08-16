import type {
  RoadManualConfirmation,
  RoadMonitor,
  RoadMonitorDetail,
  RoadMonitorInput,
  RoadMonitorDayLink,
  RoadStatusSnapshot,
  RoadUpdateMode,
} from "@/lib/api";
import type { D1DatabaseLike, D1PreparedStatementLike, RoadRepository } from "../types";

async function first<T>(statement: D1PreparedStatementLike) {
  return (await statement.first<T>()) ?? null;
}

async function all<T>(statement: D1PreparedStatementLike) {
  return (await statement.all<T>()).results ?? [];
}

function nowIso() {
  return new Date().toISOString();
}

function rowBoolean(value: unknown) {
  return Number(value) === 1;
}

type RoadRow = Omit<RoadMonitor, "enabled" | "currentSnapshot"> & { enabled: number; currentSnapshot: RoadStatusSnapshot | null };
type SnapshotRow = Omit<RoadStatusSnapshot, "isManual" | "stale"> & { isManual: number; stale?: number };

export class D1RoadRepository implements RoadRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  private mapSnapshot(row: SnapshotRow): RoadStatusSnapshot {
    return { ...row, isManual: rowBoolean(row.isManual), stale: rowBoolean(row.stale) };
  }

  private mapRoad(row: RoadRow): RoadMonitor {
    const stale = !row.lastSuccessAt || Boolean(row.lastErrorCode);
    return { ...row, enabled: rowBoolean(row.enabled), currentSnapshot: row.currentSnapshot ? { ...row.currentSnapshot, stale } : null };
  }

  private roadSelect() {
    return `SELECT r.id, r.name, r.description, r.official_url as officialUrl, r.source_type as sourceType,
      r.parser_type as parserType, r.parser_config_json as parserConfigJson, r.update_mode as updateMode,
      r.minimum_interval_minutes as minimumIntervalMinutes, r.enabled, r.manual_status_override as manualStatusOverride,
      r.manual_note as manualNote, r.last_attempt_at as lastAttemptAt, r.last_success_at as lastSuccessAt,
      r.last_changed_at as lastChangedAt, r.last_error_code as lastErrorCode, r.last_error_message as lastErrorMessage,
      r.created_at as createdAt, r.updated_at as updatedAt,
      s.id as snapshotId, s.road_monitor_id as snapshotRoadMonitorId, s.normalized_status as snapshotStatus,
      s.severity as snapshotSeverity, s.summary as snapshotSummary, s.source_updated_at as snapshotSourceUpdatedAt,
      s.fetched_at as snapshotFetchedAt, s.content_hash as snapshotContentHash, s.raw_excerpt as snapshotRawExcerpt,
      s.raw_payload_json as snapshotRawPayloadJson, s.is_manual as snapshotIsManual, s.created_at as snapshotCreatedAt
      FROM road_monitors r LEFT JOIN road_status_snapshots s ON s.id = (
        SELECT id FROM road_status_snapshots WHERE road_monitor_id = r.id ORDER BY fetched_at DESC LIMIT 1
      )`;
  }

  private mapRoadRow(row: Record<string, unknown>): RoadMonitor {
    const snapshot = row.snapshotId
      ? {
          id: String(row.snapshotId),
          roadMonitorId: String(row.snapshotRoadMonitorId),
          normalizedStatus: row.snapshotStatus as RoadStatusSnapshot["normalizedStatus"],
          severity: row.snapshotSeverity as RoadStatusSnapshot["severity"],
          summary: String(row.snapshotSummary ?? ""),
          sourceUpdatedAt: (row.snapshotSourceUpdatedAt as string | null) ?? null,
          fetchedAt: String(row.snapshotFetchedAt),
          contentHash: String(row.snapshotContentHash),
          rawExcerpt: String(row.snapshotRawExcerpt ?? ""),
          rawPayloadJson: String(row.snapshotRawPayloadJson ?? "{}"),
          isManual: rowBoolean(row.snapshotIsManual),
          stale: false,
          createdAt: String(row.snapshotCreatedAt),
        }
      : null;
    return this.mapRoad({ ...row, currentSnapshot: snapshot } as RoadRow);
  }

  async list() {
    const rows = await all<Record<string, unknown>>(this.db.prepare(`${this.roadSelect()} ORDER BY r.updated_at DESC`));
    return rows.map((row) => this.mapRoadRow(row));
  }

  async get(id: string) {
    const row = await first<Record<string, unknown>>(this.db.prepare(`${this.roadSelect()} WHERE r.id = ?`).bind(id));
    if (!row) return null;
    const monitor = this.mapRoadRow(row);
    const history = (await all<SnapshotRow>(this.db.prepare("SELECT id, road_monitor_id as roadMonitorId, normalized_status as normalizedStatus, severity, summary, source_updated_at as sourceUpdatedAt, fetched_at as fetchedAt, content_hash as contentHash, raw_excerpt as rawExcerpt, raw_payload_json as rawPayloadJson, is_manual as isManual, created_at as createdAt FROM road_status_snapshots WHERE road_monitor_id = ? ORDER BY fetched_at DESC LIMIT 50").bind(id))).map((item) => this.mapSnapshot(item));
    const confirmations = await all<RoadManualConfirmation>(this.db.prepare("SELECT id, road_monitor_id as roadMonitorId, confirmed_status as confirmedStatus, note, confirmed_by as confirmedBy, confirmed_at as confirmedAt, expires_at as expiresAt, created_at as createdAt FROM road_manual_confirmations WHERE road_monitor_id = ? ORDER BY confirmed_at DESC LIMIT 20").bind(id));
    const dayLinks = await all<RoadMonitorDayLink>(this.db.prepare("SELECT id, road_monitor_id as roadMonitorId, trip_day_id as tripDayId, sort_order as sortOrder, note, created_at as createdAt FROM road_monitor_day_links WHERE road_monitor_id = ? ORDER BY sort_order ASC").bind(id));
    return { ...monitor, history, confirmations, dayLinks } satisfies RoadMonitorDetail;
  }

  async create(input: RoadMonitorInput) {
    const id = crypto.randomUUID();
    const timestamp = nowIso();
    await this.db.prepare("INSERT INTO road_monitors (id, name, description, official_url, source_type, parser_type, parser_config_json, update_mode, minimum_interval_minutes, enabled, manual_note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(id, input.name, input.description, input.officialUrl, input.sourceType, input.parserType, input.parserConfigJson, input.updateMode, input.minimumIntervalMinutes, input.enabled ? 1 : 0, input.manualNote, timestamp, timestamp).run();
    const created = await this.get(id);
    if (!created) throw new Error("Road monitor was not created");
    return created;
  }

  async update(id: string, input: RoadMonitorInput) {
    await this.db.prepare("UPDATE road_monitors SET name = ?, description = ?, official_url = ?, source_type = ?, parser_type = ?, parser_config_json = ?, update_mode = ?, minimum_interval_minutes = ?, enabled = ?, manual_note = ?, updated_at = ? WHERE id = ?").bind(input.name, input.description, input.officialUrl, input.sourceType, input.parserType, input.parserConfigJson, input.updateMode, input.minimumIntervalMinutes, input.enabled ? 1 : 0, input.manualNote, nowIso(), id).run();
    const updated = await this.get(id);
    return updated;
  }

  async delete(id: string) {
    await this.db.prepare("DELETE FROM road_monitors WHERE id = ?").bind(id).run();
  }

  async updateMode(id: string, mode: RoadUpdateMode) {
    await this.db.prepare("UPDATE road_monitors SET update_mode = ?, updated_at = ? WHERE id = ?").bind(mode, nowIso(), id).run();
    const updated = await this.get(id);
    return updated;
  }

  async updateAllModes(mode: RoadUpdateMode) {
    await this.db.prepare("UPDATE road_monitors SET update_mode = ?, updated_at = ?").bind(mode, nowIso()).run();
    return this.list();
  }

  async due(now: string) {
    const rows = await this.list();
    return rows.filter((road) => {
      if (!road.enabled || road.updateMode === "paused" || road.sourceType === "manual") return false;
      if (!road.lastAttemptAt) return true;
      const interval = road.updateMode === "hourly" ? Math.max(60, road.minimumIntervalMinutes) : Math.max(1_440, road.minimumIntervalMinutes);
      return Date.parse(now) - Date.parse(road.lastAttemptAt) >= interval * 60_000;
    });
  }

  async markAttempt(id: string, attemptedAt: string, errorCode?: string, errorMessage?: string) {
    await this.db.prepare("UPDATE road_monitors SET last_attempt_at = ?, last_error_code = ?, last_error_message = ?, updated_at = ? WHERE id = ?").bind(attemptedAt, errorCode ?? null, errorMessage ?? null, attemptedAt, id).run();
  }

  async saveSnapshot(snapshot: RoadStatusSnapshot, state: { lastSuccessAt: string; lastChangedAt: string | null }) {
    await this.db.prepare("INSERT INTO road_status_snapshots (id, road_monitor_id, normalized_status, severity, summary, source_updated_at, fetched_at, content_hash, raw_excerpt, raw_payload_json, is_manual, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(snapshot.id, snapshot.roadMonitorId, snapshot.normalizedStatus, snapshot.severity, snapshot.summary, snapshot.sourceUpdatedAt, snapshot.fetchedAt, snapshot.contentHash, snapshot.rawExcerpt, snapshot.rawPayloadJson, snapshot.isManual ? 1 : 0, snapshot.createdAt).run();
    await this.db.prepare("UPDATE road_monitors SET last_attempt_at = ?, last_success_at = ?, last_changed_at = ?, last_error_code = NULL, last_error_message = NULL, updated_at = ? WHERE id = ?").bind(snapshot.fetchedAt, state.lastSuccessAt, state.lastChangedAt, snapshot.fetchedAt, snapshot.roadMonitorId).run();
  }

  async saveFailureSnapshot(snapshot: RoadStatusSnapshot, errorCode: string, errorMessage: string) {
    await this.db.prepare("INSERT INTO road_status_snapshots (id, road_monitor_id, normalized_status, severity, summary, source_updated_at, fetched_at, content_hash, raw_excerpt, raw_payload_json, is_manual, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").bind(snapshot.id, snapshot.roadMonitorId, "fetch_failed", "unknown", snapshot.summary, null, snapshot.fetchedAt, snapshot.contentHash, snapshot.rawExcerpt, snapshot.rawPayloadJson, 0, snapshot.createdAt).run();
    await this.markAttempt(snapshot.roadMonitorId, snapshot.fetchedAt, errorCode, errorMessage);
  }

  async addConfirmation(confirmation: RoadManualConfirmation) {
    await this.db.prepare("DELETE FROM road_manual_confirmations WHERE road_monitor_id = ?").bind(confirmation.roadMonitorId).run();
    await this.db.prepare("INSERT INTO road_manual_confirmations (id, road_monitor_id, confirmed_status, note, confirmed_by, confirmed_at, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").bind(confirmation.id, confirmation.roadMonitorId, confirmation.confirmedStatus, confirmation.note, confirmation.confirmedBy, confirmation.confirmedAt, confirmation.expiresAt, confirmation.createdAt).run();
    await this.db.prepare("UPDATE road_monitors SET manual_status_override = ?, manual_note = ?, updated_at = ? WHERE id = ?").bind(confirmation.confirmedStatus, confirmation.note, confirmation.confirmedAt, confirmation.roadMonitorId).run();
    return confirmation;
  }

  async clearConfirmation(id: string) {
    await this.db.prepare("DELETE FROM road_manual_confirmations WHERE road_monitor_id = ?").bind(id).run();
    await this.db.prepare("UPDATE road_monitors SET manual_status_override = NULL, manual_note = '', updated_at = ? WHERE id = ?").bind(nowIso(), id).run();
  }

  async linkDay(roadMonitorId: string, tripDayId: string, sortOrder: number, note: string) {
    await this.db.prepare("INSERT INTO road_monitor_day_links (id, road_monitor_id, trip_day_id, sort_order, note, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(road_monitor_id, trip_day_id) DO UPDATE SET sort_order = excluded.sort_order, note = excluded.note").bind(crypto.randomUUID(), roadMonitorId, tripDayId, sortOrder, note, nowIso()).run();
  }

  async unlinkDay(roadMonitorId: string, tripDayId: string) {
    await this.db.prepare("DELETE FROM road_monitor_day_links WHERE road_monitor_id = ? AND trip_day_id = ?").bind(roadMonitorId, tripDayId).run();
  }
}
