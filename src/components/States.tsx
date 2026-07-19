interface StateProps {
  label: string;
  detail?: string;
}

export function LoadingState({ label, detail }: StateProps) {
  return (
    <div className="state-card" role="status">
      <h2>{label}</h2>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}

export function EmptyState({ label, detail }: StateProps) {
  return (
    <div className="state-card">
      <h2>{label}</h2>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}

export function ErrorState({ label, detail }: StateProps) {
  return (
    <div className="state-card danger">
      <h2>{label}</h2>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}

export function UnauthorizedState({ label, detail }: StateProps) {
  return (
    <div className="state-card warning">
      <h2>{label}</h2>
      {detail ? <p>{detail}</p> : null}
    </div>
  );
}

export function SaveStatus({ saved }: { saved: boolean }) {
  return <p className={`save-status ${saved ? "saved" : "pending"}`}>{saved ? "Saved" : "Unsaved changes"}</p>;
}

export function LastUpdated({ value }: { value: string }) {
  return <p className="last-updated">Last updated: {new Date(value).toLocaleString()}</p>;
}
