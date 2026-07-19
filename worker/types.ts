import type { AppSettings } from "@/lib/api";
import type { SessionUser, UserRole } from "@/features/auth/types";

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T>(): Promise<T | null>;
  run(): Promise<unknown>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatementLike;
}

export interface UserRecord extends SessionUser {
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SessionRecord {
  id: string;
  userId: string;
  tokenHash: string;
  csrfToken: string;
  expiresAt: string;
  createdAt: string;
  lastSeenAt: string;
}

export interface AuditLogRecord {
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadataJson: string;
  createdAt: string;
}

export interface SettingsRepository {
  get(): Promise<AppSettings>;
  update(nextSettings: AppSettings): Promise<AppSettings>;
}

export interface UsersRepository {
  getById(userId: string): Promise<UserRecord | null>;
  getFirstByRole(role: UserRole): Promise<UserRecord | null>;
}

export interface SessionsRepository {
  create(session: SessionRecord): Promise<void>;
  findByTokenHash(tokenHash: string): Promise<SessionRecord | null>;
  deleteByTokenHash(tokenHash: string): Promise<void>;
  touch(tokenHash: string, lastSeenAt: string): Promise<void>;
}

export interface AuditLogRepository {
  insert(entry: AuditLogRecord): Promise<void>;
}

export interface WorkerEnv {
  DB: D1DatabaseLike;
  MAPTILER_API_KEY?: string;
  AUTH_PASSWORD_HASH?: string;
  VIEWER_PASSWORD_HASH?: string;
  EDITOR_PASSWORD_HASH?: string;
  SESSION_SECRET: string;
  NWS_USER_AGENT?: string;
}

export interface Repositories {
  settings: SettingsRepository;
  users: UsersRepository;
  sessions: SessionsRepository;
  auditLog: AuditLogRepository;
}
