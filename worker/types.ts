import type {
  AppSettings,
  ChecklistInput,
  ChecklistItem,
  DashboardData,
  DayPlaceBundle,
  DayPlaceInput,
  DayPlaceReorderItem,
  MapData,
  NoteInput,
  NoteItem,
  Place,
  PlaceInput,
  RouteInput,
  RouteItem,
  RoadManualConfirmation,
  RoadMonitor,
  RoadMonitorDetail,
  RoadMonitorInput,
  RoadStatusSnapshot,
  RoadUpdateMode,
  Trip,
  TripBundle,
  TripDay,
  TripDayBundle,
  TripDayInput,
  TripInput,
  WeatherAlert,
  WeatherData,
  WeatherSnapshot,
} from "@/lib/api";
import type { SessionUser, UserRole } from "@/features/auth/types";

export interface D1PreparedStatementLike {
  bind(...values: unknown[]): D1PreparedStatementLike;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
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

export interface ConflictResult<T> {
  ok: boolean;
  record?: T;
  conflict?: true;
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
  list(limit?: number): Promise<Array<AuditLogRecord & { id: string }>>;
}

export interface ContentRepository {
  getDashboard(): Promise<DashboardData>;
  listTrips(): Promise<Trip[]>;
  getTripBundle(tripId: string): Promise<TripBundle | null>;
  getFeaturedTripBundle(): Promise<TripBundle | null>;
  createTrip(input: TripInput): Promise<Trip>;
  updateTrip(tripId: string, input: TripInput): Promise<ConflictResult<Trip>>;
  deleteTrip(tripId: string): Promise<void>;
  publishTrip(tripId: string): Promise<Trip | null>;

  listTripDays(tripId: string): Promise<TripDayBundle[]>;
  createTripDay(tripId: string, input: TripDayInput): Promise<TripDay>;
  updateTripDay(dayId: string, input: TripDayInput): Promise<ConflictResult<TripDay>>;
  deleteTripDay(dayId: string): Promise<void>;
  copyTripDay(dayId: string): Promise<TripDay | null>;
  reorderTripDays(items: Array<{ id: string; sortOrder: number }>): Promise<void>;

  listPlaces(): Promise<Place[]>;
  createPlace(input: PlaceInput): Promise<Place>;
  updatePlace(placeId: string, input: PlaceInput): Promise<ConflictResult<Place>>;
  deletePlace(placeId: string): Promise<void>;

  addDayPlace(dayId: string, input: DayPlaceInput): Promise<DayPlaceBundle | null>;
  removeDayPlace(dayPlaceId: string): Promise<void>;
  reorderDayPlaces(items: DayPlaceReorderItem[]): Promise<void>;

  listRoutes(dayId: string): Promise<RouteItem[]>;
  createRoute(dayId: string, input: RouteInput): Promise<RouteItem | null>;
  updateRoute(routeId: string, input: RouteInput): Promise<ConflictResult<RouteItem>>;
  deleteRoute(routeId: string): Promise<void>;

  listNotes(tripId: string): Promise<NoteItem[]>;
  createNote(input: NoteInput): Promise<NoteItem>;
  updateNote(noteId: string, input: NoteInput): Promise<ConflictResult<NoteItem>>;
  deleteNote(noteId: string): Promise<void>;

  listChecklistItems(tripId: string): Promise<ChecklistItem[]>;
  createChecklistItem(input: ChecklistInput): Promise<ChecklistItem>;
  updateChecklistItem(itemId: string, input: ChecklistInput): Promise<ConflictResult<ChecklistItem>>;
  deleteChecklistItem(itemId: string): Promise<void>;

  getMapData(maptilerConfigured: boolean, maptilerStyleUrl: string | null): Promise<MapData>;
  getWeatherData(): Promise<WeatherData>;
  replaceWeatherSnapshots(items: WeatherSnapshot[]): Promise<void>;
  replaceWeatherAlerts(items: WeatherAlert[]): Promise<void>;
}

export interface RoadRepository {
  list(): Promise<RoadMonitor[]>;
  get(id: string): Promise<RoadMonitorDetail | null>;
  create(input: RoadMonitorInput): Promise<RoadMonitor>;
  update(id: string, input: RoadMonitorInput): Promise<RoadMonitor | null>;
  delete(id: string): Promise<void>;
  updateMode(id: string, mode: RoadUpdateMode): Promise<RoadMonitor | null>;
  updateAllModes(mode: RoadUpdateMode): Promise<RoadMonitor[]>;
  due(now: string): Promise<RoadMonitor[]>;
  markAttempt(id: string, attemptedAt: string, errorCode?: string, errorMessage?: string): Promise<void>;
  saveFailureSnapshot(snapshot: RoadStatusSnapshot, errorCode: string, errorMessage: string): Promise<void>;
  saveSnapshot(snapshot: RoadStatusSnapshot, state: { lastSuccessAt: string; lastChangedAt: string | null }): Promise<void>;
  addConfirmation(confirmation: RoadManualConfirmation): Promise<RoadManualConfirmation>;
  clearConfirmation(id: string): Promise<void>;
  linkDay(roadMonitorId: string, tripDayId: string, sortOrder: number, note: string): Promise<void>;
  unlinkDay(roadMonitorId: string, tripDayId: string): Promise<void>;
}

export interface WorkerEnv {
  DB: D1DatabaseLike;
  MAPTILER_API_KEY?: string;
  AUTH_PASSWORD_HASH?: string;
  EDITOR_PASSWORD_HASH?: string;
  SESSION_SECRET: string;
  NWS_USER_AGENT?: string;
}

export interface Repositories {
  settings: SettingsRepository;
  users: UsersRepository;
  sessions: SessionsRepository;
  auditLog: AuditLogRepository;
  content: ContentRepository;
  roads: RoadRepository;
}
