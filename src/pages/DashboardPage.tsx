import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyState, ErrorState, LastUpdated, LoadingState } from "@/components/States";
import { PageHeader, PlaceholderGrid } from "@/components/PageElements";
import { api, type DashboardData, type Trip } from "@/lib/api";

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [dashboardData, tripList] = await Promise.all([api.getDashboard(), api.listTrips()]);
        setDashboard(dashboardData);
        setTrips(tripList);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load dashboard");
      }
    }

    void load();
  }, []);

  if (error) {
    return <ErrorState label="Unable to load dashboard" detail={error} />;
  }

  if (!dashboard) {
    return <LoadingState label="Loading dashboard" />;
  }

  if (trips.length === 0) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Published trip summaries, weather freshness, and quick travel-planning shortcuts."
        />
        <EmptyState
          label="No trip has been created yet"
          detail="Open the trip admin workspace to create a sample trip, add days, and publish it for viewer mode."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Published trip summaries, weather freshness, and quick travel-planning shortcuts."
        action={
          <Link className="primary-button" to="/admin/trip">
            Open Trip Admin
          </Link>
        }
      />
      <PlaceholderGrid
        items={[
          { title: "Published Days", value: String(dashboard.publishedTripDays), detail: "Visible viewer-mode day cards." },
          { title: "Places", value: String(dashboard.totalPlaces), detail: "Enabled places saved in D1-backed storage." },
          { title: "Weather Alerts", value: String(dashboard.activeWeatherAlerts), detail: "Currently active NWS alerts." },
          { title: "Pending Shopping", value: String(dashboard.pendingShoppingItems), detail: "Unchecked shopping items." },
          { title: "Pending Packing", value: String(dashboard.pendingPackingItems), detail: "Packing tasks not marked complete." },
          { title: "Weather State", value: dashboard.staleWeather ? "Stale" : "Fresh", detail: "Open the weather page for a full refresh." },
        ]}
      />
      {dashboard.latestWeatherUpdateAt ? <LastUpdated value={dashboard.latestWeatherUpdateAt} /> : null}
      <div className="card-grid">
        <article className="panel-card">
          <p className="eyebrow">Quick Open</p>
          <h3>Trip and map</h3>
          <p>Jump straight into the published itinerary or route view.</p>
          <div className="button-row">
            <Link className="secondary-button" to="/trip">
              Open Trip
            </Link>
            <Link className="secondary-button" to="/map">
              Open Map
            </Link>
          </div>
        </article>
        <article className="panel-card">
          <p className="eyebrow">Sync State</p>
          <h3>Latest content</h3>
          <p>Trip changes use last-write-wins with conflict detection on record updates.</p>
          {dashboard.recentTripUpdateAt ? <LastUpdated value={dashboard.recentTripUpdateAt} /> : null}
        </article>
      </div>
    </>
  );
}
