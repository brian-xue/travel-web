import { EmptyState } from "@/components/States";
import { PageHeader } from "@/components/PageElements";

export function NotesPage() {
  return (
    <>
      <PageHeader description="Travel notes and reminders live here once persistence is added." title="Notes" />
      <EmptyState label="No notes saved yet" detail="This empty state is ready for D1-backed note records." />
    </>
  );
}
