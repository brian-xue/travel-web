import type { AppSettings } from "@/lib/api";
import type {
  AuditLogRecord,
  AuditLogRepository,
  Repositories,
  SessionRecord,
  SessionsRepository,
  SettingsRepository,
  UserRecord,
  UsersRepository,
} from "@worker/types";

export const sampleSettings: AppSettings = {
  weatherRefreshMinutes: 30,
  roadMonitoringMode: "manual",
  releaseVersion: "0.1.0",
  lastDataRefreshAt: "2026-07-18T00:00:00.000Z",
  uiPreferences: { compactCards: false },
};

export const sampleUsers: UserRecord[] = [
  {
    id: "user-viewer",
    displayName: "Sample Viewer",
    role: "viewer",
    enabled: true,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
  },
  {
    id: "user-editor",
    displayName: "Sample Editor",
    role: "editor",
    enabled: true,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
  },
  {
    id: "user-admin",
    displayName: "Sample Admin",
    role: "admin",
    enabled: true,
    createdAt: "2026-07-18T00:00:00.000Z",
    updatedAt: "2026-07-18T00:00:00.000Z",
  },
];

class MemorySettingsRepository implements SettingsRepository {
  settings = { ...sampleSettings };

  async get() {
    return this.settings;
  }

  async update(nextSettings: AppSettings) {
    this.settings = nextSettings;
    return nextSettings;
  }
}

class MemoryUsersRepository implements UsersRepository {
  constructor(private readonly users = sampleUsers) {}

  async getById(userId: string) {
    return this.users.find((user) => user.id === userId) ?? null;
  }

  async getFirstByRole(role: UserRecord["role"]) {
    return this.users.find((user) => user.role === role) ?? null;
  }
}

class MemorySessionsRepository implements SessionsRepository {
  sessions = new Map<string, SessionRecord>();

  async create(session: SessionRecord) {
    this.sessions.set(session.tokenHash, session);
  }

  async findByTokenHash(tokenHash: string) {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteByTokenHash(tokenHash: string) {
    this.sessions.delete(tokenHash);
  }

  async touch(tokenHash: string, lastSeenAt: string) {
    const session = this.sessions.get(tokenHash);
    if (!session) {
      return;
    }
    this.sessions.set(tokenHash, { ...session, lastSeenAt });
  }
}

class MemoryAuditLogRepository implements AuditLogRepository {
  entries: AuditLogRecord[] = [];

  async insert(entry: AuditLogRecord) {
    this.entries.push(entry);
  }
}

export function createMemoryRepositories(): Repositories & {
  settings: MemorySettingsRepository;
  users: MemoryUsersRepository;
  sessions: MemorySessionsRepository;
  auditLog: MemoryAuditLogRepository;
} {
  return {
    settings: new MemorySettingsRepository(),
    users: new MemoryUsersRepository(),
    sessions: new MemorySessionsRepository(),
    auditLog: new MemoryAuditLogRepository(),
  };
}
