import { EmptyState, LastUpdated } from "@/components/States";
import { PageHeader, PlaceholderGrid } from "@/components/PageElements";

const dashboardCards = [
  { title: "Trip Overview", value: "3 sample days", detail: "Example data only. Replace with D1-backed trip records later." },
  { title: "Weather Status", value: "Pending sync", detail: "Forecast collection is not enabled in this phase." },
  { title: "Road Status", value: "Monitoring staged", detail: "Road checks will connect to future scheduled jobs." },
  { title: "Checklist Items", value: "8 placeholders", detail: "Shopping and luggage counts are sample values." },
];

export function DashboardPage() {
  return (
    <>
      <PageHeader
        description="An authenticated overview for sample itinerary planning, weather status, and quick navigation."
        title="Dashboard"
      />
      <LastUpdated value="2026-07-18T00:00:00.000Z" />
      <PlaceholderGrid items={dashboardCards} />
      <EmptyState
        detail="No live data is connected yet. This page is wired for future D1-backed content."
        label="Friendly empty state"
      />
    </>
  );
}
