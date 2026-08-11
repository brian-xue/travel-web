import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { PageHeader } from "@/components/PageElements";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { api, type TripBundle } from "@/lib/api";

export function TripPage() {
  const [trip, setTrip] = useState<TripBundle | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const dashboard = await api.getDashboard();
        if (!dashboard.featuredTripId) {
          setTrip(null);
          return;
        }
        const nextTrip = await api.getTrip(dashboard.featuredTripId);
        setTrip(nextTrip);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load trip");
      }
    }

    void load();
  }, []);

  if (error) {
    return <ErrorState label="Unable to load the trip" detail={error} />;
  }

  if (!trip) {
    return <LoadingState label="Loading trip" />;
  }

  if (trip.days.length === 0) {
    return (
      <>
        <PageHeader title="Trip" description="Published day plans, places, route notes, and Google Maps handoff links." />
        <EmptyState label="No days are published yet" detail="Create a sample day in the trip admin workspace first." />
      </>
    );
  }

  return (
    <>
      <PageHeader title={trip.name} description={trip.description || "Published viewer-mode itinerary."} />
      <div className="stacked-grid">
        {trip.days.map((day) => (
          <article className="panel-card" key={day.id}>
            <div className="title-row">
              <div>
                <p className="eyebrow">{`Day ${day.dayNumber}`}</p>
                <h3>{day.title}</h3>
              </div>
              {day.googleMapsUrl ? (
                <a className="secondary-button" href={day.googleMapsUrl} rel="noreferrer" target="_blank">
                  Open in Google Maps
                </a>
              ) : null}
            </div>
            <p>{day.summary}</p>
            <p className="muted">{`${day.estimatedDistanceKm} km · ${day.estimatedDriveMinutes} minutes`}</p>
            <div className="sub-grid">
              {day.places.map((stop) => (
                <div className="mini-card" key={stop.id}>
                  <p className="eyebrow">{stop.plannedArrivalText || `Stop ${stop.visitOrder}`}</p>
                  <strong>{stop.place.name}</strong>
                  <p>{stop.place.placeType.replaceAll("_", " ")}</p>
                  {stop.noteMarkdown ? <SafeMarkdown markdown={stop.noteMarkdown} /> : null}
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
