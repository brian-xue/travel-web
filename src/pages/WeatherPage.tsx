import { useEffect, useState } from "react";
import { ErrorState, LoadingState, UnauthorizedState } from "@/components/States";
import { PageHeader } from "@/components/PageElements";
import { useAuth } from "@/features/auth/useAuth";
import { api, type WeatherData } from "@/lib/api";

export function WeatherPage() {
  const { session } = useAuth();
  const [data, setData] = useState<WeatherData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canRefresh = session.user?.role === "editor" || session.user?.role === "admin";

  async function load() {
    setData(await api.getWeather());
  }

  useEffect(() => {
    void load().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load weather"));
  }, []);

  if (error) {
    return <ErrorState label="Unable to load weather" detail={error} />;
  }
  if (!data) {
    return <LoadingState label="Loading weather data" />;
  }

  return (
    <>
      <PageHeader
        title="Weather"
        description="Server-side weather snapshots from Open-Meteo with NWS alert overlays and stale-cache fallback."
        action={
          canRefresh ? (
            <button
              className="primary-button"
              onClick={async () => {
                if (!session.csrfToken) return;
                setData(await api.refreshWeather(session.csrfToken));
              }}
              type="button"
            >
              Refresh Weather
            </button>
          ) : null
        }
      />
      {!canRefresh ? (
        <UnauthorizedState
          label="Viewer mode"
          detail="Viewer mode can read cached weather but only editor or admin sessions can trigger a refresh."
        />
      ) : null}
      <div className="card-grid">
        {data.snapshots.map((snapshot) => (
          <article className="panel-card" key={snapshot.id}>
            <p className="eyebrow">{snapshot.placeId}</p>
            <strong>{snapshot.currentTemperature === null ? "No data" : `${snapshot.currentTemperature}°C`}</strong>
            <p>{snapshot.stale ? "Cached data may be stale." : "Fresh weather snapshot."}</p>
          </article>
        ))}
      </div>
      <div className="stacked-grid">
        {data.alerts.map((alert) => (
          <article className="panel-card" key={alert.id}>
            <p className="eyebrow">{alert.severity}</p>
            <h3>{alert.event}</h3>
            <p>{alert.headline}</p>
          </article>
        ))}
      </div>
    </>
  );
}
