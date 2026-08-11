import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { PageHeader } from "@/components/PageElements";
import { TripMap } from "@/components/TripMap";
import { api, type MapData } from "@/lib/api";

export function MapPage() {
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void api
      .getMapData()
      .then(setData)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load map data"));
  }, []);

  if (error) {
    return <ErrorState label="Unable to load the map" detail={error} />;
  }
  if (!data) {
    return <LoadingState label="Loading map" />;
  }
  if (!data.maptilerConfigured) {
    return (
      <>
        <PageHeader title="Map" description="Published routes and place markers rendered with MapLibre." />
        <ErrorState
          label="MapTiler key is not configured"
          detail="Add MAPTILER_API_KEY in local or deployed configuration so the browser can load the basemap style."
        />
      </>
    );
  }
  if (data.routes.length === 0) {
    return (
      <>
        <PageHeader title="Map" description="Published routes and place markers rendered with MapLibre." />
        <EmptyState label="No routes are available yet" detail="Upload or paste GeoJSON in the trip admin route editor." />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Map" description="Published routes, stop markers, and weather summaries for the active trip." />
      <TripMap data={data} />
      <div className="sub-grid">
        {data.weather.map((entry) => (
          <article className="mini-card" key={entry.placeId}>
            <strong>{entry.placeId}</strong>
            <p>{entry.summary}</p>
            <p className="muted">{entry.stale ? "Stale" : "Fresh"}</p>
          </article>
        ))}
      </div>
    </>
  );
}
