import { Link } from "react-router-dom";
import { PageHeader, PlaceholderGrid } from "@/components/PageElements";

export function AdminPage() {
  return (
    <>
      <PageHeader title="Admin" description="Trip planning operations, publishing, notes, checklists, and weather refresh controls." />
      <PlaceholderGrid
        items={[
          { title: "Trip Editor", value: "/admin/trip", detail: "Create trips, days, places, and routes." },
          { title: "Notes", value: "/notes", detail: "Manage published driving, packing, and safety notes." },
          { title: "Checklists", value: "/checklists", detail: "Update shopping, packing, car, and document lists." },
          { title: "Weather", value: "/weather", detail: "Refresh weather caches and review alert data." },
        ]}
      />
      <div className="button-row">
        <Link className="primary-button" to="/admin/trip">
          Open Trip Admin
        </Link>
        <Link className="secondary-button" to="/weather">
          Open Weather
        </Link>
      </div>
    </>
  );
}
