import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageHeader, PlaceholderGrid } from "@/components/PageElements";
import { ErrorState, UnauthorizedState } from "@/components/States";
import { useAuth } from "@/features/auth/useAuth";
import { api, type AuditLogItem } from "@/lib/api";

export function AdminPage() {
  const { session } = useAuth();
  const [audit, setAudit] = useState<AuditLogItem[]>([]);
  const [auditError, setAuditError] = useState<string | null>(null);
  const isAdmin = session.user?.role === "admin";

  useEffect(() => {
    if (!isAdmin || !session.csrfToken) return;
    void api.getAuditLog(session.csrfToken).then(setAudit).catch((error: unknown) => setAuditError(error instanceof Error ? error.message : "Failed to load audit log"));
  }, [isAdmin, session.csrfToken]);

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
      {isAdmin ? (
        <section className="panel-card stacked-grid">
          <PageHeader title="Recent Audit Log" description="Administrative actions are recorded without session tokens, secrets, or raw source pages." />
          {auditError ? <ErrorState label="Unable to load audit log" detail={auditError} /> : audit.length === 0 ? <p className="muted">No audit events yet.</p> : audit.map((entry) => <article className="mini-card" key={entry.id}><strong>{entry.action}</strong><p>{entry.entityType} · {entry.entityId}</p><p className="muted">{new Date(entry.createdAt).toLocaleString()}</p></article>)}
        </section>
      ) : <UnauthorizedState label="Admin audit log" detail="Only admin sessions can view recent audit events." />}
    </>
  );
}
