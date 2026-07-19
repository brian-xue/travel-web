import type { AppSettings } from "@/lib/api";
import type {
  AuditLogRepository,
  D1DatabaseLike,
  D1PreparedStatementLike,
  Repositories,
  SessionRecord,
  SessionsRepository,
  SettingsRepository,
  UserRecord,
  UsersRepository,
  WorkerEnv,
} from "../types";

async function first<T>(statement: D1PreparedStatementLike) {
  const result = await statement.first<T>();
  return result ?? null;
}

class D1SettingsRepository implements SettingsRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async get() {
    const row = await first<{ value_json: string }>(
      this.db.prepare("SELECT value_json FROM app_settings WHERE key = ?").bind("app_settings"),
    );

    if (!row) {
      const fallback: AppSettings = {
        weatherRefreshMinutes: 30,
        roadMonitoringMode: "manual",
        releaseVersion: "0.1.0",
        lastDataRefreshAt: new Date(0).toISOString(),
        uiPreferences: { compactCards: false },
      };
      await this.update(fallback);
      return fallback;
    }

    return JSON.parse(row.value_json) as AppSettings;
  }

  async update(nextSettings: AppSettings) {
    await this.db
      .prepare(
        "INSERT INTO app_settings (id, key, value_json, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json, updated_at = excluded.updated_at",
      )
      .bind(crypto.randomUUID(), "app_settings", JSON.stringify(nextSettings), new Date().toISOString())
      .run();
    return nextSettings;
  }
}

class D1UsersRepository implements UsersRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async getById(userId: string) {
    const row = await first<UserRecord>(
      this.db
        .prepare(
          "SELECT id, display_name as displayName, role, enabled, created_at as createdAt, updated_at as updatedAt FROM users WHERE id = ?",
        )
        .bind(userId),
    );
    return row;
  }

  async getFirstByRole(role: UserRecord["role"]) {
    const row = await first<UserRecord>(
      this.db
        .prepare(
          "SELECT id, display_name as displayName, role, enabled, created_at as createdAt, updated_at as updatedAt FROM users WHERE role = ? ORDER BY created_at ASC LIMIT 1",
        )
        .bind(role),
    );
    return row;
  }
}

class D1SessionsRepository implements SessionsRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async create(session: SessionRecord) {
    await this.db
      .prepare(
        "INSERT INTO sessions (id, user_id, token_hash, csrf_token, expires_at, created_at, last_seen_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        session.id,
        session.userId,
        session.tokenHash,
        session.csrfToken,
        session.expiresAt,
        session.createdAt,
        session.lastSeenAt,
      )
      .run();
  }

  async findByTokenHash(tokenHash: string) {
    const row = await first<SessionRecord>(
      this.db
        .prepare(
          "SELECT id, user_id as userId, token_hash as tokenHash, csrf_token as csrfToken, expires_at as expiresAt, created_at as createdAt, last_seen_at as lastSeenAt FROM sessions WHERE token_hash = ?",
        )
        .bind(tokenHash),
    );
    return row;
  }

  async deleteByTokenHash(tokenHash: string) {
    await this.db.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(tokenHash).run();
  }

  async touch(tokenHash: string, lastSeenAt: string) {
    await this.db
      .prepare("UPDATE sessions SET last_seen_at = ? WHERE token_hash = ?")
      .bind(lastSeenAt, tokenHash)
      .run();
  }
}

class D1AuditLogRepository implements AuditLogRepository {
  constructor(private readonly db: D1DatabaseLike) {}

  async insert(entry: Parameters<AuditLogRepository["insert"]>[0]) {
    await this.db
      .prepare(
        "INSERT INTO audit_log (id, actor_user_id, action, entity_type, entity_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
      )
      .bind(
        crypto.randomUUID(),
        entry.actorUserId,
        entry.action,
        entry.entityType,
        entry.entityId,
        entry.metadataJson,
        entry.createdAt,
      )
      .run();
  }
}

export function createRepositories(env: WorkerEnv): Repositories {
  return {
    settings: new D1SettingsRepository(env.DB),
    users: new D1UsersRepository(env.DB),
    sessions: new D1SessionsRepository(env.DB),
    auditLog: new D1AuditLogRepository(env.DB),
  };
}
