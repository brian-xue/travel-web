import { EmptyState } from "@/components/States";
import { PageHeader } from "@/components/PageElements";

export function MapPage() {
  return (
    <>
      <PageHeader description="Map rendering and route overlays are intentionally deferred." title="Map" />
      <EmptyState
        detail="MapTiler configuration is secret-backed, but no live map integration is enabled in this phase."
        label="Map module staged"
      />
    </>
  );
}
