import type { AppSettings, ChecklistInput, NoteInput, PlaceInput, TripDayInput, TripInput } from "@/lib/api";
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
  };
}
