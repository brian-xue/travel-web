import { UnauthorizedState } from "@/components/States";
import { PageHeader } from "@/components/PageElements";
import { useAuth } from "@/features/auth/useAuth";

export function AdminPage() {
  const { session } = useAuth();

  return (
    <>
      <PageHeader description="Administrative editing tools will expand here in later phases." title="Admin" />
      {session.user?.role === "admin" ? (
        <div className="panel-card">
          <p className="eyebrow">Access Level</p>
          <strong>Admin</strong>
          <p>Administrative controls are reserved for future iterations.</p>
        </div>
      ) : (
        <UnauthorizedState
          detail="Viewer and editor accounts can sign in, but only admin users will get elevated controls here."
          label="Admin tools restricted"
        />
      )}
    </>
  );
}
