import { EmptyState } from "@/components/States";
import { PageHeader } from "@/components/PageElements";

export function WeatherPage() {
  return (
    <>
      <PageHeader description="Weather and alert ingestion will arrive in a later milestone." title="Weather" />
      <EmptyState label="No forecast cached yet" detail="Official weather calls are not implemented in this skeleton." />
    </>
  );
}
