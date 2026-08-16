import type { AppSettings, ChecklistInput, NoteInput, PlaceInput, RoadManualConfirmation, RoadMonitor, RoadMonitorDetail, RoadMonitorInput, RoadStatusSnapshot, RoadUpdateMode, TripDayInput, TripInput } from "@/lib/api";
import type {
  AuditLogRecord,
  AuditLogRepository,
  ContentRepository,
  Repositories,
  SessionRecord,
  SessionsRepository,
  SettingsRepository,
  UserRecord,
  UsersRepository,
  RoadRepository,
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

  async list() {
    return this.entries.map((entry, index) => ({ id: String(index), ...entry })).reverse();
  }
}

class MemoryContentRepository implements ContentRepository {
  async getDashboard() {
    return {
      publishedTripDays: 0,
      totalPlaces: 0,
      latestWeatherUpdateAt: null,
      activeWeatherAlerts: 0,
      pendingShoppingItems: 0,
      pendingPackingItems: 0,
      recentTripUpdateAt: null,
      staleWeather: true,
      featuredTripId: null,
      featuredTripDayId: null,
    };
  }
  async listTrips() {
    return [];
  }
  async getTripBundle() {
    return null;
  }
  async getFeaturedTripBundle() {
    return null;
  }
  async createTrip(input: TripInput) {
    return {
      id: "trip-test",
      name: input.name,
      description: input.description,
      status: input.status,
      publishedVersion: 0,
      draftVersion: 1,
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    };
  }
  async updateTrip() {
    return { ok: false, conflict: true as const };
  }
  async deleteTrip() {}
  async publishTrip() {
    return null;
  }
  async listTripDays() {
    return [];
  }
  async createTripDay(tripId: string, input: TripDayInput) {
    return {
      id: "day-test",
      tripId,
      dayNumber: 1,
      title: input.title,
      summary: input.summary,
      estimatedDistanceKm: input.estimatedDistanceKm,
      estimatedDriveMinutes: input.estimatedDriveMinutes,
      googleMapsUrl: input.googleMapsUrl,
      enabled: input.enabled,
      sortOrder: 1,
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    };
  }
  async updateTripDay() {
    return { ok: false, conflict: true as const };
  }
  async deleteTripDay() {}
  async copyTripDay() {
    return null;
  }
  async reorderTripDays() {}
  async listPlaces() {
    return [];
  }
  async createPlace(input: PlaceInput) {
    return {
      id: "place-test",
      name: input.name,
      placeType: input.placeType,
      latitude: input.latitude,
      longitude: input.longitude,
      descriptionMarkdown: input.descriptionMarkdown,
      officialUrl: input.officialUrl,
      googleMapsUrl: input.googleMapsUrl,
      weatherEnabled: input.weatherEnabled,
      enabled: input.enabled,
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    };
  }
  async updatePlace() {
    return { ok: false, conflict: true as const };
  }
  async deletePlace() {}
  async addDayPlace() {
    return null;
  }
  async removeDayPlace() {}
  async reorderDayPlaces() {}
  async listRoutes() {
    return [];
  }
  async createRoute() {
    return null;
  }
  async updateRoute() {
    return { ok: false, conflict: true as const };
  }
  async deleteRoute() {}
  async listNotes() {
    return [];
  }
  async createNote(input: NoteInput) {
    return {
      id: "note-test",
      tripId: input.tripId,
      category: input.category,
      title: input.title,
      contentMarkdown: input.contentMarkdown,
      sortOrder: input.sortOrder,
      enabled: input.enabled,
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    };
  }
  async updateNote() {
    return { ok: false, conflict: true as const };
  }
  async deleteNote() {}
  async listChecklistItems() {
    return [];
  }
  async createChecklistItem(input: ChecklistInput) {
    return {
      id: "checklist-test",
      tripId: input.tripId,
      listType: input.listType,
      category: input.category,
      title: input.title,
      quantity: input.quantity,
      priority: input.priority,
      status: input.status,
      note: input.note,
      sortOrder: input.sortOrder,
      createdAt: "2026-07-20T00:00:00.000Z",
      updatedAt: "2026-07-20T00:00:00.000Z",
    };
  }
  async updateChecklistItem() {
    return { ok: false, conflict: true as const };
  }
  async deleteChecklistItem() {}
  async getMapData() {
    return {
      trip: null,
      days: [],
      places: [],
      dayPlaces: [],
      routes: [],
      weather: [],
      maptilerConfigured: false,
      maptilerStyleUrl: null,
    };
  }
  async getWeatherData() {
    return {
      trip: null,
      places: [],
      snapshots: [],
      alerts: [],
      refreshedAt: null,
      stale: true,
    };
  }
  async replaceWeatherSnapshots() {}
  async replaceWeatherAlerts() {}
}

class MemoryRoadRepository implements RoadRepository {
  roads: RoadMonitor[] = [];
  async list() { return this.roads; }
  async get(id: string): Promise<RoadMonitorDetail | null> {
    const road = this.roads.find((item) => item.id === id);
    return road ? { ...road, history: road.currentSnapshot ? [road.currentSnapshot] : [], confirmations: [], dayLinks: [] } : null;
  }
  async create(input: RoadMonitorInput) {
    const timestamp = new Date().toISOString();
    const road: RoadMonitor = { ...input, id: "road-test", manualStatusOverride: null, lastAttemptAt: null, lastSuccessAt: null, lastChangedAt: null, lastErrorCode: null, lastErrorMessage: null, createdAt: timestamp, updatedAt: timestamp, currentSnapshot: null };
    this.roads = [road];
    return road;
  }
  async update(id: string, input: RoadMonitorInput) { const current = this.roads.find((item) => item.id === id); if (!current) return null; const updated = { ...current, ...input, updatedAt: new Date().toISOString() }; this.roads = [updated]; return updated; }
  async delete(id: string) { this.roads = this.roads.filter((road) => road.id !== id); }
  async updateMode(id: string, mode: RoadUpdateMode) { const current = this.roads.find((item) => item.id === id); if (!current) return null; return this.update(id, { ...current, updateMode: mode }); }
  async updateAllModes(mode: RoadUpdateMode) { this.roads = this.roads.map((road) => ({ ...road, updateMode: mode })); return this.roads; }
  async due() { return this.roads.filter((road) => road.enabled && road.updateMode !== "paused"); }
  async markAttempt(id: string, attemptedAt: string, errorCode?: string, errorMessage?: string) { const road = this.roads.find((item) => item.id === id); if (road) Object.assign(road, { lastAttemptAt: attemptedAt, lastErrorCode: errorCode ?? null, lastErrorMessage: errorMessage ?? null }); }
  async saveFailureSnapshot(snapshot: RoadStatusSnapshot, errorCode: string, errorMessage: string) { await this.markAttempt(snapshot.roadMonitorId, snapshot.fetchedAt, errorCode, errorMessage); }
  async saveSnapshot(snapshot: RoadStatusSnapshot) { const road = this.roads.find((item) => item.id === snapshot.roadMonitorId); if (road) Object.assign(road, { currentSnapshot: snapshot, lastSuccessAt: snapshot.fetchedAt, lastAttemptAt: snapshot.fetchedAt, lastErrorCode: null, lastErrorMessage: null }); }
  async addConfirmation(confirmation: RoadManualConfirmation) { const road = this.roads.find((item) => item.id === confirmation.roadMonitorId); if (road) Object.assign(road, { manualStatusOverride: confirmation.confirmedStatus, manualNote: confirmation.note }); return confirmation; }
  async clearConfirmation(id: string) { const road = this.roads.find((item) => item.id === id); if (road) Object.assign(road, { manualStatusOverride: null, manualNote: "" }); }
  async linkDay() {}
  async unlinkDay() {}
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
    content: new MemoryContentRepository(),
    roads: new MemoryRoadRepository(),
  };
}
