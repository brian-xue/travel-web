import { EmptyState } from "@/components/States";
import { PageHeader } from "@/components/PageElements";

export function RoadsPage() {
  return (
    <>
      <PageHeader description="Road monitoring placeholders are ready for future scheduled workers." title="Roads" />
      <EmptyState
        detail="Example Mountain Road is sample text only and is not a real route."
        label="No road checks configured"
      />
    </>
  );
}
