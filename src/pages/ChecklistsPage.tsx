import { PlaceholderGrid, PageHeader } from "@/components/PageElements";

const checklistCards = [
  { title: "Shopping", value: "3 sample items", detail: "Example only, stored records to be added later." },
  { title: "Packing", value: "5 sample items", detail: "Prepared for D1-backed checklist rows." },
];

export function ChecklistsPage() {
  return (
    <>
      <PageHeader
        description="Shopping and luggage lists will become editable once checklist tables are introduced."
        title="Checklists"
      />
      <PlaceholderGrid items={checklistCards} />
    </>
  );
}
