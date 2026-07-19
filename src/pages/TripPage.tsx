import { EmptyState } from "@/components/States";
import { PageHeader } from "@/components/PageElements";

export function TripPage() {
  return (
    <>
      <PageHeader description="Sample trip blocks will come from the database in a later phase." title="Trip" />
      <EmptyState
        detail="Example placeholder only: Day 1, Sample City A, Sample Scenic Point."
        label="No editable trip entries yet"
      />
    </>
  );
}
