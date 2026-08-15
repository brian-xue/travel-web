import { useEffect, useState } from "react";
import { TripMap } from "@/components/TripMap";
import { PlaceGeocoder } from "@/components/PlaceGeocoder";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { PageHeader } from "@/components/PageElements";
import { useAuth } from "@/features/auth/useAuth";
import {
  api,
  type DayPlace,
  type DayPlaceBundle,
  type GeocodingFeature,
  type MapData,
  type Place,
  type PlaceInput,
  type PlaceType,
  type RouteInput,
  type RouteItem,
  type Trip,
  type TripBundle,
  type TripDay,
  type TripDayInput,
  type TripInput,
  type TripStatus,
} from "@/lib/api";

const PLACE_TYPES: PlaceType[] = [
  "city",
  "scenic_point",
  "lodging_city",
  "fuel",
  "food",
  "trailhead",
  "viewpoint",
  "road_checkpoint",
  "custom",
];

const TRIP_STATUSES: TripStatus[] = ["draft", "published", "archived"];

function buildSampleRouteInput(): RouteInput {
  return {
    name: "Example Route",
    geojson: JSON.stringify(
      {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [
            [-105.2, 39.5],
            [-105.25, 39.55],
            [-105.3, 39.6],
          ],
        },
        properties: {},
      },
      null,
      2,
    ),
    styleJson: JSON.stringify({ color: "#0f766e", width: 4, opacity: 0.9 }, null, 2),
    enabled: true,
  };
}

function buildTripDraft(trip: TripBundle): TripInput {
  return {
    expectedUpdatedAt: trip.updatedAt,
    name: trip.name,
    description: trip.description,
    status: trip.status,
  };
}

function buildDayDraft(day: TripDay): TripDayInput {
  return {
    expectedUpdatedAt: day.updatedAt,
    title: day.title,
    summary: day.summary,
    estimatedDistanceKm: day.estimatedDistanceKm,
    estimatedDriveMinutes: day.estimatedDriveMinutes,
    googleMapsUrl: day.googleMapsUrl,
    enabled: day.enabled,
  };
}

function buildPlaceDraft(place: Place): PlaceInput {
  return {
    expectedUpdatedAt: place.updatedAt,
    name: place.name,
    placeType: place.placeType,
    latitude: place.latitude,
    longitude: place.longitude,
    descriptionMarkdown: place.descriptionMarkdown,
    officialUrl: place.officialUrl,
    googleMapsUrl: place.googleMapsUrl,
    weatherEnabled: place.weatherEnabled,
    enabled: place.enabled,
  };
}

function buildRouteDraft(route: RouteItem): RouteInput {
  return {
    expectedUpdatedAt: route.updatedAt,
    name: route.name,
    geojson: route.geojson,
    styleJson: route.styleJson,
    enabled: route.enabled,
  };
}

function buildSamplePlaceInput(index: number): PlaceInput {
  return {
    name: `Example Place ${index}`,
    placeType: "scenic_point",
    latitude: 39.5 + (index - 1) * 0.01,
    longitude: -105.2 - (index - 1) * 0.01,
    descriptionMarkdown: "## Example stop\n- Scenic overlook\n- Fictional placeholder",
    officialUrl: "",
    googleMapsUrl: "",
    weatherEnabled: true,
    enabled: true,
  };
}

function buildPreviewData(bundle: TripBundle, mapData: MapData | null, placeDrafts: Record<string, PlaceInput>): MapData {
  const weatherByPlaceId = new Map(mapData?.weather.map((entry) => [entry.placeId, entry]) ?? []);
  const places = dedupePlaces(bundle.days.flatMap((day) => day.places.map((entry) => entry.place))).map((place) => {
    const draft = placeDrafts[place.id];
    return draft
      ? {
          ...place,
          name: draft.name,
          placeType: draft.placeType,
          latitude: draft.latitude,
          longitude: draft.longitude,
          descriptionMarkdown: draft.descriptionMarkdown,
          officialUrl: draft.officialUrl,
          googleMapsUrl: draft.googleMapsUrl,
          weatherEnabled: draft.weatherEnabled,
          enabled: draft.enabled,
        }
      : place;
  });

  return {
    trip: {
      id: bundle.id,
      name: bundle.name,
      description: bundle.description,
      status: bundle.status,
      publishedVersion: bundle.publishedVersion,
      draftVersion: bundle.draftVersion,
      createdAt: bundle.createdAt,
      updatedAt: bundle.updatedAt,
    },
    days: bundle.days.map((day) => ({
      id: day.id,
      tripId: day.tripId,
      dayNumber: day.dayNumber,
      title: day.title,
      summary: day.summary,
      estimatedDistanceKm: day.estimatedDistanceKm,
      estimatedDriveMinutes: day.estimatedDriveMinutes,
      googleMapsUrl: day.googleMapsUrl,
      enabled: day.enabled,
      sortOrder: day.sortOrder,
      createdAt: day.createdAt,
      updatedAt: day.updatedAt,
    })),
    places,
    dayPlaces: bundle.days.flatMap((day) =>
      day.places.map(
        (entry): DayPlace => ({
          id: entry.id,
          tripDayId: entry.tripDayId,
          placeId: entry.placeId,
          visitOrder: entry.visitOrder,
          plannedArrivalText: entry.plannedArrivalText,
          plannedDurationMinutes: entry.plannedDurationMinutes,
          noteMarkdown: entry.noteMarkdown,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
        }),
      ),
    ),
    routes: bundle.days.flatMap((day) =>
      day.routes.map((route) => ({
        route,
        tripDay: {
          id: day.id,
          tripId: day.tripId,
          dayNumber: day.dayNumber,
          title: day.title,
          summary: day.summary,
          estimatedDistanceKm: day.estimatedDistanceKm,
          estimatedDriveMinutes: day.estimatedDriveMinutes,
          googleMapsUrl: day.googleMapsUrl,
          enabled: day.enabled,
          sortOrder: day.sortOrder,
          createdAt: day.createdAt,
          updatedAt: day.updatedAt,
        },
      })),
    ),
    weather: places
      .map((place) => weatherByPlaceId.get(place.id))
      .filter((entry): entry is NonNullable<typeof entry> => Boolean(entry)),
    maptilerConfigured: mapData?.maptilerConfigured ?? false,
    maptilerStyleUrl: mapData?.maptilerStyleUrl ?? null,
  };
}

function dedupePlaces(places: Place[]) {
  return Array.from(new Map(places.map((place) => [place.id, place])).values());
}

export function AdminTripPage() {
  const { session } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [bundle, setBundle] = useState<TripBundle | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tripDraft, setTripDraft] = useState<TripInput | null>(null);
  const [tripStatus, setTripStatus] = useState<string | null>(null);
  const [tripSelectionStatus, setTripSelectionStatus] = useState<string | null>(null);
  const [placeCreateStatus, setPlaceCreateStatus] = useState<string | null>(null);
  const [dayDrafts, setDayDrafts] = useState<Record<string, TripDayInput>>({});
  const [dayStatus, setDayStatus] = useState<Record<string, string>>({});
  const [placeDrafts, setPlaceDrafts] = useState<Record<string, PlaceInput>>({});
  const [placeStatus, setPlaceStatus] = useState<Record<string, string>>({});
  const [routeDrafts, setRouteDrafts] = useState<Record<string, RouteInput>>({});
  const [routeStatus, setRouteStatus] = useState<Record<string, string>>({});
  const [dayPlaceForms, setDayPlaceForms] = useState<
    Record<string, { placeId: string; plannedArrivalText: string; plannedDurationMinutes: string; noteMarkdown: string }>
  >({});
  const [dayPlaceStatus, setDayPlaceStatus] = useState<Record<string, string>>({});
  const canEdit = session.user?.role === "editor" || session.user?.role === "admin";
  const canAdmin = session.user?.role === "admin";

  async function refreshMapData() {
    try {
      setMapData(await api.getMapData());
    } catch {
      setMapData(null);
    }
  }

  async function loadBase(nextSelectedTripId?: string) {
    const [tripList, placeList] = await Promise.all([api.listTrips(), api.listPlaces()]);
    setTrips(tripList);
    setPlaces(placeList);
    const resolvedTripId = nextSelectedTripId ?? (selectedTripId || tripList[0]?.id || "");
    setSelectedTripId(resolvedTripId);
    if (resolvedTripId) {
      setBundle(await api.getTrip(resolvedTripId));
    } else {
      setBundle(null);
    }
    await refreshMapData();
  }

  useEffect(() => {
    void loadBase().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load trip admin data");
    });
  }, []);

  useEffect(() => {
    if (!bundle) {
      setTripDraft(null);
      setDayDrafts({});
      setRouteDrafts({});
      setDayPlaceForms({});
      return;
    }

    setTripDraft(buildTripDraft(bundle));
    setDayDrafts(Object.fromEntries(bundle.days.map((day) => [day.id, buildDayDraft(day)])));
    setRouteDrafts(
      Object.fromEntries(bundle.days.flatMap((day) => day.routes.map((route) => [route.id, buildRouteDraft(route)]))),
    );
    setDayPlaceForms(
      Object.fromEntries(
        bundle.days.map((day) => [
          day.id,
          {
            placeId: places[0]?.id ?? "",
            plannedArrivalText: "Morning",
            plannedDurationMinutes: "45",
            noteMarkdown: `Stop ${day.places.length + 1}`,
          },
        ]),
      ),
    );
  }, [bundle, places]);

  useEffect(() => {
    setPlaceDrafts(Object.fromEntries(places.map((place) => [place.id, buildPlaceDraft(place)])));
  }, [places]);

  if (error) {
    return <ErrorState label="Unable to load trip admin" detail={error} />;
  }

  if (!trips && !bundle) {
    return <LoadingState label="Loading trip admin" />;
  }

  async function createSampleTrip() {
    if (!session.csrfToken || !canEdit) return;
    const created = await api.createTrip(
      {
        name: "Example Mountain Loop",
        description: "A fictional multi-day sample trip used for phase-two testing.",
        status: "draft",
      },
      session.csrfToken,
    );
    setTripSelectionStatus("Created a sample trip.");
    await loadBase(created.id);
  }

  async function saveTrip() {
    if (!session.csrfToken || !bundle || !tripDraft) return;
    try {
      const updated = await api.updateTrip(bundle.id, tripDraft, session.csrfToken);
      setBundle((current) => (current ? { ...current, ...updated } : current));
      setTripDraft(buildTripDraft({ ...(bundle as TripBundle), ...updated }));
      setTripStatus("Trip saved.");
    } catch (saveError) {
      setTripStatus(saveError instanceof Error ? saveError.message : "Failed to save trip");
    }
  }

  async function removeTrip() {
    if (!session.csrfToken || !bundle || !canAdmin) return;
    try {
      await api.deleteTrip(bundle.id, session.csrfToken);
      setTripSelectionStatus("Trip deleted.");
      await loadBase("");
    } catch (deleteError) {
      setTripSelectionStatus(deleteError instanceof Error ? deleteError.message : "Failed to delete trip");
    }
  }

  async function createDay() {
    if (!session.csrfToken || !bundle) return;
    await api.createTripDay(
      bundle.id,
      {
        title: `Day ${bundle.days.length + 1}`,
        summary: "Example drive and stop planning block.",
        estimatedDistanceKm: 120,
        estimatedDriveMinutes: 150,
        googleMapsUrl: "",
        enabled: true,
      },
      session.csrfToken,
    );
    setTripStatus("Day added.");
    await loadBase(bundle.id);
  }

  async function saveDay(day: TripDay) {
    if (!session.csrfToken || !bundle) return;
    const draft = dayDrafts[day.id];
    if (!draft) return;
    try {
      await api.updateTripDay(day.id, draft, session.csrfToken);
      setDayStatus((current) => ({ ...current, [day.id]: "Day saved." }));
      await loadBase(bundle.id);
    } catch (saveError) {
      setDayStatus((current) => ({
        ...current,
        [day.id]: saveError instanceof Error ? saveError.message : "Failed to save day",
      }));
    }
  }

  async function removeDay(day: TripDay) {
    if (!session.csrfToken || !bundle) return;
    try {
      await api.deleteTripDay(day.id, session.csrfToken);
      setDayStatus((current) => ({ ...current, [day.id]: "Day deleted." }));
      await loadBase(bundle.id);
    } catch (deleteError) {
      setDayStatus((current) => ({
        ...current,
        [day.id]: deleteError instanceof Error ? deleteError.message : "Failed to delete day",
      }));
    }
  }

  async function createPlace() {
    if (!session.csrfToken || !canEdit) return;
    try {
      await api.createPlace(buildSamplePlaceInput(places.length + 1), session.csrfToken);
      setPlaceCreateStatus("Created a sample place.");
      await loadBase(bundle?.id);
    } catch (createError) {
      setPlaceCreateStatus(createError instanceof Error ? createError.message : "Failed to create place");
    }
  }

  async function savePlace(place: Place) {
    if (!session.csrfToken) return;
    const draft = placeDrafts[place.id];
    if (!draft) return;
    try {
      await api.updatePlace(place.id, draft, session.csrfToken);
      setPlaceStatus((current) => ({ ...current, [place.id]: "Place saved." }));
      await loadBase(bundle?.id);
    } catch (saveError) {
      setPlaceStatus((current) => ({
        ...current,
        [place.id]: saveError instanceof Error ? saveError.message : "Failed to save place",
      }));
    }
  }

  async function removePlace(place: Place) {
    if (!session.csrfToken) return;
    try {
      await api.deletePlace(place.id, session.csrfToken);
      setPlaceStatus((current) => ({ ...current, [place.id]: "Place deleted." }));
      await loadBase(bundle?.id);
    } catch (deleteError) {
      setPlaceStatus((current) => ({
        ...current,
        [place.id]: deleteError instanceof Error ? deleteError.message : "Failed to delete place",
      }));
    }
  }

  function updateDayDraft(dayId: string, patch: Partial<TripDayInput>) {
    setDayDrafts((current) => ({
      ...current,
      [dayId]: {
        ...current[dayId],
        ...patch,
      },
    }));
    setDayStatus((current) => ({ ...current, [dayId]: "" }));
  }

  function updatePlaceDraft(placeId: string, patch: Partial<PlaceInput>) {
    setPlaceDrafts((current) => ({
      ...current,
      [placeId]: {
        ...current[placeId],
        ...patch,
      },
    }));
    setPlaceStatus((current) => ({ ...current, [placeId]: "" }));
  }

  function selectPlaceLocation(placeId: string, feature: GeocodingFeature) {
    const [longitude, latitude] = feature.center;
    updatePlaceDraft(placeId, {
      name: feature.place_name,
      latitude,
      longitude,
    });
  }

  function updateDayPlaceForm(dayId: string, patch: Partial<(typeof dayPlaceForms)[string]>) {
    setDayPlaceForms((current) => ({
      ...current,
      [dayId]: {
        placeId: current[dayId]?.placeId ?? places[0]?.id ?? "",
        plannedArrivalText: current[dayId]?.plannedArrivalText ?? "Morning",
        plannedDurationMinutes: current[dayId]?.plannedDurationMinutes ?? "45",
        noteMarkdown: current[dayId]?.noteMarkdown ?? "Stop 1",
        ...patch,
      },
    }));
    setDayPlaceStatus((current) => ({ ...current, [dayId]: "" }));
  }

  async function addPlaceToDay(dayId: string) {
    if (!session.csrfToken || !bundle) return;
    const form = dayPlaceForms[dayId];
    if (!form?.placeId) {
      setDayPlaceStatus((current) => ({ ...current, [dayId]: "Choose a place first." }));
      return;
    }

    try {
      await api.addDayPlace(
        dayId,
        {
          placeId: form.placeId,
          plannedArrivalText: form.plannedArrivalText,
          plannedDurationMinutes: Number(form.plannedDurationMinutes) || 0,
          noteMarkdown: form.noteMarkdown,
        },
        session.csrfToken,
      );
      const refreshed = await api.getTrip(bundle.id);
      setBundle(refreshed);
      setDayPlaceForms((current) => ({
        ...current,
        [dayId]: {
          ...form,
          noteMarkdown: `Stop ${(refreshed.days.find((day) => day.id === dayId)?.places.length ?? 0) + 1}`,
        },
      }));
      setDayPlaceStatus((current) => ({ ...current, [dayId]: "Place added to the day." }));
    } catch (attachError) {
      setDayPlaceStatus((current) => ({
        ...current,
        [dayId]: attachError instanceof Error ? attachError.message : "Failed to attach place",
      }));
    }
  }

  async function removeDayPlace(dayId: string, dayPlace: DayPlaceBundle) {
    if (!session.csrfToken || !bundle) return;
    try {
      await api.removeDayPlace(dayPlace.id, session.csrfToken);
      const refreshed = await api.getTrip(bundle.id);
      setBundle(refreshed);
      setDayPlaceStatus((current) => ({ ...current, [dayId]: "Place removed from the day." }));
    } catch (removeError) {
      setDayPlaceStatus((current) => ({
        ...current,
        [dayId]: removeError instanceof Error ? removeError.message : "Failed to remove place",
      }));
    }
  }

  async function addRoute(dayId: string) {
    if (!session.csrfToken || !bundle) return;
    await api.createRoute(dayId, buildSampleRouteInput(), session.csrfToken);
    await loadBase(bundle.id);
  }

  function updateRouteDraft(routeId: string, patch: Partial<RouteInput>) {
    setRouteDrafts((current) => ({
      ...current,
      [routeId]: {
        ...current[routeId],
        ...patch,
      },
    }));
    setRouteStatus((current) => ({ ...current, [routeId]: "" }));
  }

  async function saveRoute(route: RouteItem) {
    if (!session.csrfToken || !bundle) return;
    const draft = routeDrafts[route.id];
    if (!draft) return;
    try {
      await api.updateRoute(route.id, draft, session.csrfToken);
      setRouteStatus((current) => ({ ...current, [route.id]: "Route saved." }));
      await loadBase(bundle.id);
    } catch (saveError) {
      setRouteStatus((current) => ({
        ...current,
        [route.id]: saveError instanceof Error ? saveError.message : "Failed to save route",
      }));
    }
  }

  async function removeRoute(route: RouteItem) {
    if (!session.csrfToken || !bundle) return;
    try {
      await api.deleteRoute(route.id, session.csrfToken);
      setRouteStatus((current) => ({ ...current, [route.id]: "Route deleted." }));
      await loadBase(bundle.id);
    } catch (deleteError) {
      setRouteStatus((current) => ({
        ...current,
        [route.id]: deleteError instanceof Error ? deleteError.message : "Failed to delete route",
      }));
    }
  }

  const previewData = bundle ? buildPreviewData(bundle, mapData, placeDrafts) : null;

  return (
    <>
      <PageHeader
        title="Trip Admin"
        description="Edit trip details, day plans, and place metadata, then preview the live route map with MapTiler."
      />
      {!canEdit ? (
        <EmptyState label="Read-only viewer mode" detail="Sign in as editor or admin to modify trip content." />
      ) : (
        <div className="button-row">
          <button className="primary-button" onClick={() => void createSampleTrip()} type="button">
            Create Sample Trip
          </button>
          <button className="secondary-button" onClick={() => void createPlace()} type="button">
            Create Sample Place
          </button>
          {bundle ? (
            <>
              <button className="secondary-button" onClick={() => void createDay()} type="button">
                Add Day
              </button>
              <button
                className="secondary-button"
                onClick={() => session.csrfToken && void api.publishTrip(bundle.id, session.csrfToken).then(() => loadBase(bundle.id))}
                type="button"
              >
                Publish Trip
              </button>
              {canAdmin ? (
                <button className="danger-button" onClick={() => void removeTrip()} type="button">
                  Delete Trip
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      )}
      {tripSelectionStatus ? <p className={tripSelectionStatus.includes("Failed") ? "error-text" : "save-status saved"}>{tripSelectionStatus}</p> : null}
      {placeCreateStatus ? <p className={placeCreateStatus.includes("Failed") ? "error-text" : "save-status saved"}>{placeCreateStatus}</p> : null}
      {trips.length > 0 ? (
        <label className="inline-field">
          Selected trip
          <select
            onChange={async (event) => {
              const nextTripId = event.target.value;
              setSelectedTripId(nextTripId);
              setBundle(await api.getTrip(nextTripId));
            }}
            value={selectedTripId}
          >
            {trips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {bundle && tripDraft ? (
        <>
          <section className="panel-card">
            <div className="title-row">
              <div>
                <p className="eyebrow">Trip Details</p>
                <h3>{bundle.name}</h3>
              </div>
              {canEdit ? (
                <button className="primary-button" onClick={() => void saveTrip()} type="button">
                  Save Trip
                </button>
              ) : null}
            </div>
            <div className="two-column-grid">
              <label>
                Trip Name
                <input onChange={(event) => setTripDraft((current) => (current ? { ...current, name: event.target.value } : current))} type="text" value={tripDraft.name} />
              </label>
              <label>
                Status
                <select
                  onChange={(event) => setTripDraft((current) => (current ? { ...current, status: event.target.value as TripStatus } : current))}
                  value={tripDraft.status}
                >
                  {TRIP_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label>
              Description
              <textarea
                onChange={(event) => setTripDraft((current) => (current ? { ...current, description: event.target.value } : current))}
                rows={4}
                value={tripDraft.description}
              />
            </label>
            <p className="muted">{`Draft version ${bundle.draftVersion} · Published version ${bundle.publishedVersion}`}</p>
            {tripStatus ? <p className={tripStatus.includes("Failed") ? "error-text" : "save-status saved"}>{tripStatus}</p> : null}
          </section>

          {previewData ? (
            <section className="panel-card">
              <PageHeader
                title="Map Preview"
                description="This preview uses the current trip/day/place data and the MapTiler style returned by the Worker."
              />
              {previewData.maptilerConfigured ? (
                previewData.places.length > 0 || previewData.routes.length > 0 ? (
                  <>
                    <TripMap data={previewData} />
                    {previewData.weather.length > 0 ? (
                      <div className="sub-grid">
                        {previewData.weather.map((entry) => (
                          <article className="mini-card" key={entry.placeId}>
                            <strong>{entry.placeId}</strong>
                            <p>{entry.summary}</p>
                            <p className="muted">{entry.stale ? "Stale" : "Fresh"}</p>
                          </article>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <EmptyState label="No map features yet" detail="Add at least one place or route to see the MapTiler preview." />
                )
              ) : (
                <ErrorState
                  label="MapTiler key is not configured"
                  detail="Set MAPTILER_API_KEY in .dev.vars or deployed secrets so the Worker can return a browser-ready style URL."
                />
              )}
            </section>
          ) : null}

          <div className="stacked-grid">
            {bundle.days.map((day) => {
              const dayDraft = dayDrafts[day.id] ?? buildDayDraft(day);
              return (
                <article className="panel-card" key={day.id}>
                  <div className="title-row">
                    <div>
                      <p className="eyebrow">{`Day ${day.dayNumber}`}</p>
                      <h3>{day.title}</h3>
                    </div>
                    {canEdit ? (
                      <div className="button-row">
                        <button className="primary-button" onClick={() => void saveDay(day)} type="button">
                          Save Day
                        </button>
                        <button className="secondary-button" onClick={() => void addRoute(day.id)} type="button">
                          Add Sample Route
                        </button>
                        <button className="danger-button" onClick={() => void removeDay(day)} type="button">
                          Delete Day
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="two-column-grid">
                    <label>
                      Title
                      <input onChange={(event) => updateDayDraft(day.id, { title: event.target.value })} type="text" value={dayDraft.title} />
                    </label>
                    <label className="checkbox-row">
                      <input checked={dayDraft.enabled} onChange={(event) => updateDayDraft(day.id, { enabled: event.target.checked })} type="checkbox" />
                      Enabled
                    </label>
                  </div>
                  <label>
                    Summary
                    <textarea onChange={(event) => updateDayDraft(day.id, { summary: event.target.value })} rows={3} value={dayDraft.summary} />
                  </label>
                  <div className="three-column-grid">
                    <label>
                      Distance (km)
                      <input
                        min="0"
                        onChange={(event) => updateDayDraft(day.id, { estimatedDistanceKm: Number(event.target.value) || 0 })}
                        type="number"
                        value={dayDraft.estimatedDistanceKm}
                      />
                    </label>
                    <label>
                      Drive Minutes
                      <input
                        min="0"
                        onChange={(event) => updateDayDraft(day.id, { estimatedDriveMinutes: Number(event.target.value) || 0 })}
                        type="number"
                        value={dayDraft.estimatedDriveMinutes}
                      />
                    </label>
                    <label>
                      Google Maps URL
                      <input onChange={(event) => updateDayDraft(day.id, { googleMapsUrl: event.target.value })} type="url" value={dayDraft.googleMapsUrl} />
                    </label>
                  </div>
                  <p className="muted">{`${day.places.length} place stops · ${day.routes.length} routes`}</p>
                  {dayStatus[day.id] ? <p className={dayStatus[day.id].includes("Failed") ? "error-text" : "save-status saved"}>{dayStatus[day.id]}</p> : null}
                  {canEdit ? (
                    <section className="panel-card">
                      <p className="eyebrow">Add Place To Day</p>
                      {places.length === 0 ? (
                        <p className="muted">Create a sample place first, then assign it to this day.</p>
                      ) : (
                        <>
                          <label>
                            Place
                            <select
                              onChange={(event) => updateDayPlaceForm(day.id, { placeId: event.target.value })}
                              value={dayPlaceForms[day.id]?.placeId ?? places[0]?.id ?? ""}
                            >
                              {places.map((place) => (
                                <option key={place.id} value={place.id}>
                                  {place.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="three-column-grid">
                            <label>
                              Arrival
                              <input
                                onChange={(event) => updateDayPlaceForm(day.id, { plannedArrivalText: event.target.value })}
                                type="text"
                                value={dayPlaceForms[day.id]?.plannedArrivalText ?? "Morning"}
                              />
                            </label>
                            <label>
                              Duration Minutes
                              <input
                                min="0"
                                onChange={(event) => updateDayPlaceForm(day.id, { plannedDurationMinutes: event.target.value })}
                                type="number"
                                value={dayPlaceForms[day.id]?.plannedDurationMinutes ?? "45"}
                              />
                            </label>
                            <label>
                              Note
                              <input
                                onChange={(event) => updateDayPlaceForm(day.id, { noteMarkdown: event.target.value })}
                                type="text"
                                value={dayPlaceForms[day.id]?.noteMarkdown ?? ""}
                              />
                            </label>
                          </div>
                          <button className="secondary-button" onClick={() => void addPlaceToDay(day.id)} type="button">
                            Add Place To Day
                          </button>
                          {dayPlaceStatus[day.id] ? (
                            <p className={dayPlaceStatus[day.id].includes("Failed") || dayPlaceStatus[day.id].includes("Choose") ? "error-text" : "save-status saved"}>
                              {dayPlaceStatus[day.id]}
                            </p>
                          ) : null}
                        </>
                      )}
                    </section>
                  ) : null}
                  {day.places.length > 0 ? (
                    <div className="stacked-grid">
                      {day.places.map((dayPlace) => (
                        <section className="panel-card" key={dayPlace.id}>
                          <div className="title-row">
                            <div>
                              <p className="eyebrow">{dayPlace.place.placeType}</p>
                              <h4>{dayPlace.place.name}</h4>
                            </div>
                            {canEdit ? (
                              <button className="danger-button" onClick={() => void removeDayPlace(day.id, dayPlace)} type="button">
                                Remove Place
                              </button>
                            ) : null}
                          </div>
                          <p>{`${dayPlace.plannedArrivalText} · ${dayPlace.plannedDurationMinutes} minutes`}</p>
                          <p className="muted">{dayPlace.noteMarkdown}</p>
                        </section>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">No places attached to this day yet.</p>
                  )}
                  {day.routes.length > 0 ? (
                    <div className="stacked-grid">
                      {day.routes.map((route) => {
                        const draft = routeDrafts[route.id] ?? buildRouteDraft(route);
                        return (
                          <section className="panel-card" key={route.id}>
                            <div className="title-row">
                              <div>
                                <p className="eyebrow">Route</p>
                                <h4>{route.name}</h4>
                              </div>
                              {canEdit ? (
                                <div className="button-row">
                                  <button className="primary-button" onClick={() => void saveRoute(route)} type="button">
                                    Save Route
                                  </button>
                                  <button className="danger-button" onClick={() => void removeRoute(route)} type="button">
                                    Delete Route
                                  </button>
                                </div>
                              ) : null}
                            </div>
                            <label>
                              Route name
                              <input onChange={(event) => updateRouteDraft(route.id, { name: event.target.value })} type="text" value={draft.name} />
                            </label>
                            <label>
                              GeoJSON
                              <textarea onChange={(event) => updateRouteDraft(route.id, { geojson: event.target.value })} rows={10} value={draft.geojson} />
                            </label>
                            <label>
                              Style JSON
                              <textarea onChange={(event) => updateRouteDraft(route.id, { styleJson: event.target.value })} rows={5} value={draft.styleJson} />
                            </label>
                            <label className="checkbox-row">
                              <input checked={draft.enabled} onChange={(event) => updateRouteDraft(route.id, { enabled: event.target.checked })} type="checkbox" />
                              Enabled
                            </label>
                            {routeStatus[route.id] ? <p className={routeStatus[route.id].includes("Failed") ? "error-text" : "save-status saved"}>{routeStatus[route.id]}</p> : null}
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="muted">No routes yet for this day.</p>
                  )}
                </article>
              );
            })}
          </div>
        </>
      ) : (
        <EmptyState label="No trip selected" detail="Create a sample trip to start the second-stage workflow." />
      )}
      {places.length > 0 ? (
        <section className="stacked-grid">
          <PageHeader title="Place Library" description="Edit all reusable place records before attaching them to trip days." />
          <div className="stacked-grid">
            {places.map((place) => {
              const draft = placeDrafts[place.id] ?? buildPlaceDraft(place);
              return (
                <article className="panel-card" key={place.id}>
                  <div className="title-row">
                    <div>
                      <p className="eyebrow">{place.placeType}</p>
                      <h3>{place.name}</h3>
                    </div>
                    {canEdit ? (
                      <div className="button-row">
                        <button className="primary-button" onClick={() => void savePlace(place)} type="button">
                          Save Place
                        </button>
                        <button className="danger-button" onClick={() => void removePlace(place)} type="button">
                          Delete Place
                        </button>
                      </div>
                    ) : null}
                  </div>
                  <div className="two-column-grid">
                    <label>
                      Place Name
                      <PlaceGeocoder
                        onChange={(value) => updatePlaceDraft(place.id, { name: value })}
                        onSelect={(feature) => selectPlaceLocation(place.id, feature)}
                        value={draft.name}
                      />
                    </label>
                    <label>
                      Place Type
                      <select onChange={(event) => updatePlaceDraft(place.id, { placeType: event.target.value as PlaceType })} value={draft.placeType}>
                        {PLACE_TYPES.map((placeType) => (
                          <option key={placeType} value={placeType}>
                            {placeType}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="three-column-grid">
                    <label>
                      Latitude
                      <input
                        onChange={(event) => updatePlaceDraft(place.id, { latitude: Number(event.target.value) || 0 })}
                        step="0.000001"
                        type="number"
                        value={draft.latitude}
                      />
                    </label>
                    <label>
                      Longitude
                      <input
                        onChange={(event) => updatePlaceDraft(place.id, { longitude: Number(event.target.value) || 0 })}
                        step="0.000001"
                        type="number"
                        value={draft.longitude}
                      />
                    </label>
                    <label>
                      Official URL
                      <input onChange={(event) => updatePlaceDraft(place.id, { officialUrl: event.target.value })} type="url" value={draft.officialUrl} />
                    </label>
                  </div>
                  <label>
                    Google Maps URL
                    <input onChange={(event) => updatePlaceDraft(place.id, { googleMapsUrl: event.target.value })} type="url" value={draft.googleMapsUrl} />
                  </label>
                  <label>
                    Description Markdown
                    <textarea
                      onChange={(event) => updatePlaceDraft(place.id, { descriptionMarkdown: event.target.value })}
                      rows={5}
                      value={draft.descriptionMarkdown}
                    />
                  </label>
                  <div className="two-column-grid">
                    <label className="checkbox-row">
                      <input checked={draft.weatherEnabled} onChange={(event) => updatePlaceDraft(place.id, { weatherEnabled: event.target.checked })} type="checkbox" />
                      Weather Enabled
                    </label>
                    <label className="checkbox-row">
                      <input checked={draft.enabled} onChange={(event) => updatePlaceDraft(place.id, { enabled: event.target.checked })} type="checkbox" />
                      Enabled
                    </label>
                  </div>
                  {placeStatus[place.id] ? <p className={placeStatus[place.id].includes("Failed") ? "error-text" : "save-status saved"}>{placeStatus[place.id]}</p> : null}
                </article>
              );
            })}
          </div>
        </section>
      ) : null}
    </>
  );
}
