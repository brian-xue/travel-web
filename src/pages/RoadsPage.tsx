import { useEffect, useState } from "react";
import { ErrorState, LoadingState, UnauthorizedState } from "@/components/States";
import { PageHeader } from "@/components/PageElements";
import { useAuth } from "@/features/auth/useAuth";
import {
  api,
  type RoadMonitor,
  type RoadMonitorDetail,
  type RoadMonitorInput,
  type RoadStatus,
  type RoadUpdateMode,
} from "@/lib/api";

const ROAD_STATUSES: RoadStatus[] = ["open", "open_with_caution", "delayed", "restricted", "partially_closed", "closed", "seasonal_closure", "unknown", "fetch_failed", "manual_review_required"];
const ROAD_MODES: RoadUpdateMode[] = ["paused", "daily", "hourly"];

const emptyDraft: RoadMonitorInput = {
  name: "Example Mountain Road",
  description: "Fictional placeholder monitor for a public road status page.",
  officialUrl: "https://example.com/road-status",
  sourceType: "manual",
  parserType: "manual_only",
  parserConfigJson: "{}",
  updateMode: "daily",
  minimumIntervalMinutes: 1_440,
  enabled: true,
  manualNote: "",
};

function label(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : "Never";
}

function statusClass(road: RoadMonitor) {
  const status = road.manualStatusOverride ?? road.currentSnapshot?.normalizedStatus ?? "unknown";
  return `road-status road-status-${status}`;
}

function draftFromRoad(road: RoadMonitor): RoadMonitorInput {
  return {
    name: road.name,
    description: road.description,
    officialUrl: road.officialUrl,
    sourceType: road.sourceType,
    parserType: road.parserType,
    parserConfigJson: road.parserConfigJson,
    updateMode: road.updateMode,
    minimumIntervalMinutes: road.minimumIntervalMinutes,
    enabled: road.enabled,
    manualNote: road.manualNote,
  };
}

export function RoadsPage() {
  const { session } = useAuth();
  const canEdit = session.user?.role === "editor" || session.user?.role === "admin";
  const [roads, setRoads] = useState<RoadMonitor[]>([]);
  const [selected, setSelected] = useState<RoadMonitorDetail | null>(null);
  const [draft, setDraft] = useState<RoadMonitorInput>(emptyDraft);
  const [selectedId, setSelectedId] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [manualConfirmStatus, setManualConfirmStatus] = useState<RoadStatus>("manual_review_required");
  const [confirmNote, setConfirmNote] = useState("");
  const [confirmExpiry, setConfirmExpiry] = useState("");
  const [linkDayId, setLinkDayId] = useState("");
  const [linkDayNote, setLinkDayNote] = useState("");

  async function load(nextId = selectedId) {
    setLoading(true);
    try {
      const nextRoads = await api.listRoadMonitors();
      setRoads(nextRoads);
      const id = nextId || nextRoads[0]?.id || "";
      setSelectedId(id);
      if (id) setSelected(await api.getRoadMonitor(id));
      else setSelected(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load road monitors");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (loading) return <LoadingState label="Loading road monitors" />;
  if (error) return <ErrorState label="Unable to load road monitors" detail={error} />;

  async function saveRoad() {
    if (!session.csrfToken) return;
    try {
      const saved = selectedId ? await api.updateRoadMonitor(selectedId, draft, session.csrfToken) : await api.createRoadMonitor(draft, session.csrfToken);
      setStatus("Road monitor saved.");
      setSelectedId(saved.id);
      await load(saved.id);
    } catch (saveError) {
      setStatus(saveError instanceof Error ? saveError.message : "Failed to save road monitor");
    }
  }

  async function refreshRoad(id: string) {
    if (!session.csrfToken) return;
    try {
      await api.refreshRoadMonitor(id, session.csrfToken);
      setStatus("Road monitor refreshed.");
      await load(id);
    } catch (refreshError) {
      setStatus(refreshError instanceof Error ? refreshError.message : "Failed to refresh road monitor");
      await load(id);
    }
  }

  async function deleteRoad(id: string) {
    if (!session.csrfToken || !window.confirm("Delete this road monitor and its history?")) return;
    try {
      await api.deleteRoadMonitor(id, session.csrfToken);
      setStatus("Road monitor deleted.");
      await load("");
    } catch (deleteError) {
      setStatus(deleteError instanceof Error ? deleteError.message : "Failed to delete road monitor");
    }
  }

  async function changeMode(id: string, mode: RoadUpdateMode) {
    if (!session.csrfToken) return;
    try {
      await api.updateRoadMode(id, mode, session.csrfToken);
      setStatus(`Road monitor set to ${mode}.`);
      await load(id);
    } catch (modeError) {
      setStatus(modeError instanceof Error ? modeError.message : "Failed to update road mode");
    }
  }

  async function saveConfirmation() {
    if (!session.csrfToken || !selected) return;
    try {
      await api.confirmRoadStatus(selected.id, manualConfirmStatus, confirmNote, confirmExpiry ? new Date(confirmExpiry).toISOString() : null, session.csrfToken);
      setStatus("Manual status confirmation saved.");
      await load(selected.id);
    } catch (confirmError) {
      setStatus(confirmError instanceof Error ? confirmError.message : "Failed to save confirmation");
    }
  }

  async function clearConfirmation() {
    if (!session.csrfToken || !selected) return;
    await api.clearRoadConfirmation(selected.id, session.csrfToken);
    setStatus("Manual confirmation cleared.");
    await load(selected.id);
  }

  async function linkDay() {
    if (!session.csrfToken || !selected || !linkDayId.trim()) return;
    await api.linkRoadDay(selected.id, linkDayId.trim(), linkDayNote, session.csrfToken);
    setStatus("Road monitor linked to the trip day.");
    setLinkDayId("");
    setLinkDayNote("");
    await load(selected.id);
  }

  async function unlinkDay(tripDayId: string) {
    if (!session.csrfToken || !selected) return;
    await api.unlinkRoadDay(selected.id, tripDayId, session.csrfToken);
    setStatus("Road monitor link removed.");
    await load(selected.id);
  }

  return (
    <>
      <PageHeader
        title="Road Monitoring"
        description="Small, configured road-status checks with visible source freshness. Automated results are advisory and may require manual review."
        action={
          canEdit ? (
            <div className="button-row">
              <button className="primary-button" onClick={() => void load()} type="button">Reload</button>
              <button className="secondary-button" onClick={() => { setSelectedId(""); setSelected(null); setDraft(emptyDraft); }} type="button">New Monitor</button>
            </div>
          ) : null
        }
      />
      {!canEdit ? <UnauthorizedState label="Viewer mode" detail="Viewer mode can read road status, history, source links, and stale warnings. Editing and refresh require editor or admin access." /> : null}
      {status ? <p className={status.toLowerCase().includes("failed") || status.toLowerCase().includes("invalid") ? "error-text" : "save-status saved"}>{status}</p> : null}
      {canEdit && roads.length > 0 ? (
        <div className="button-row">
          <span className="muted">Set all automatic monitors:</span>
          {ROAD_MODES.map((mode) => <button className="secondary-button" key={mode} onClick={() => session.csrfToken && void api.updateAllRoadModes(mode, session.csrfToken).then(() => load())} type="button">{label(mode)}</button>)}
        </div>
      ) : null}
      <div className="road-layout">
        <section className="stacked-grid">
          {roads.length === 0 ? <div className="state-card"><h2>No road monitors configured</h2><p>Create a fictional monitor first, then replace its public official URL with an approved source.</p></div> : null}
          {roads.map((road) => (
            <article className="panel-card road-card" key={road.id}>
              <div className="title-row">
                <div>
                  <p className="eyebrow">{label(road.updateMode)}</p>
                  <h3>{road.name}</h3>
                </div>
                <span className={statusClass(road)}>{label(road.manualStatusOverride ?? road.currentSnapshot?.normalizedStatus ?? "unknown")}</span>
              </div>
              <p>{road.currentSnapshot?.summary || road.manualNote || "No status has been checked yet."}</p>
              <p className="muted">Last success: {formatDate(road.lastSuccessAt)} · Last attempt: {formatDate(road.lastAttemptAt)}</p>
              {road.lastErrorMessage ? <p className="error-text">Fetch failed: {road.lastErrorMessage}</p> : null}
              {road.currentSnapshot?.stale || road.lastErrorMessage ? <p className="warning">Stale or failed data: verify the official source before relying on it.</p> : null}
              <div className="button-row">
                <button className="secondary-button" onClick={() => { setSelectedId(road.id); setSelected(road as RoadMonitorDetail); setDraft(draftFromRoad(road)); void api.getRoadMonitor(road.id).then(setSelected); }} type="button">View Details</button>
                <a className="secondary-button" href={road.officialUrl} rel="noreferrer" target="_blank">Official Source</a>
                {canEdit ? <select aria-label={`Update mode for ${road.name}`} onChange={(event) => void changeMode(road.id, event.target.value as RoadUpdateMode)} value={road.updateMode}>{ROAD_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select> : null}
                {canEdit ? <button className="primary-button" onClick={() => void refreshRoad(road.id)} type="button">Check Now</button> : null}
                {canEdit ? <button className="secondary-button" onClick={() => session.csrfToken && void api.testRoadParser(road.id, session.csrfToken).then(() => setStatus("Parser test completed without saving a snapshot.")).catch((testError: unknown) => setStatus(testError instanceof Error ? testError.message : "Parser test failed"))} type="button">Test Parser</button> : null}
                {canEdit ? <button className="danger-button" onClick={() => void deleteRoad(road.id)} type="button">Delete</button> : null}
              </div>
            </article>
          ))}
        </section>
        {canEdit ? (
          <section className="panel-card road-editor">
            <p className="eyebrow">{selectedId ? "Edit Monitor" : "New Monitor"}</p>
            <div className="stacked-grid">
              <label>Name<input onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} value={draft.name} /></label>
              <label>Description<textarea onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} rows={3} value={draft.description} /></label>
              <label>Official HTTPS URL<input onChange={(event) => setDraft((current) => ({ ...current, officialUrl: event.target.value }))} type="url" value={draft.officialUrl} /></label>
              <div className="two-column-grid">
                <label>Source type<select onChange={(event) => setDraft((current) => ({ ...current, sourceType: event.target.value as RoadMonitorInput["sourceType"] }))} value={draft.sourceType}><option value="manual">manual</option><option value="json">json</option><option value="api">api</option><option value="rss">rss</option><option value="html">html</option></select></label>
                <label>Parser<select onChange={(event) => setDraft((current) => ({ ...current, parserType: event.target.value as RoadMonitorInput["parserType"] }))} value={draft.parserType}><option value="manual_only">manual_only</option><option value="generic_json">generic_json</option><option value="generic_rss">generic_rss</option><option value="keyword_html">keyword_html</option></select></label>
              </div>
              <label>Update mode<select onChange={(event) => setDraft((current) => ({ ...current, updateMode: event.target.value as RoadUpdateMode }))} value={draft.updateMode}>{ROAD_MODES.map((mode) => <option key={mode} value={mode}>{mode}</option>)}</select></label>
              <label>Minimum interval (minutes)<input min="1" onChange={(event) => setDraft((current) => ({ ...current, minimumIntervalMinutes: Number(event.target.value) || 1 }))} type="number" value={draft.minimumIntervalMinutes} /></label>
              <label>Parser config JSON<textarea onChange={(event) => setDraft((current) => ({ ...current, parserConfigJson: event.target.value }))} rows={4} value={draft.parserConfigJson} /></label>
              <label className="checkbox-row"><input checked={draft.enabled} onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))} type="checkbox" />Enabled</label>
              <button className="primary-button" onClick={() => void saveRoad()} type="button">Save Monitor</button>
            </div>
            {selected ? (
              <div className="stacked-grid">
                <p className="eyebrow">Manual Confirmation</p>
                <label>Status<select onChange={(event) => setManualConfirmStatus(event.target.value as RoadStatus)} value={manualConfirmStatus}>{ROAD_STATUSES.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label>
                <label>Note<textarea onChange={(event) => setConfirmNote(event.target.value)} rows={2} value={confirmNote} /></label>
                <label>Expires at<input onChange={(event) => setConfirmExpiry(event.target.value)} type="datetime-local" value={confirmExpiry} /></label>
                <div className="button-row"><button className="secondary-button" onClick={() => void saveConfirmation()} type="button">Confirm Status</button><button className="danger-button" onClick={() => void clearConfirmation()} type="button">Clear Confirmation</button></div>
                <p className="eyebrow">Recent History</p>
                {selected.history.map((item) => <div className="mini-card" key={item.id}><strong>{label(item.normalizedStatus)}</strong><p>{item.summary}</p><p className="muted">{formatDate(item.fetchedAt)} · {item.isManual ? "Manual" : "Automatic"}</p></div>)}
                <p className="eyebrow">Trip Day Links</p>
                {selected.dayLinks.map((link) => <div className="mini-card" key={link.id}><strong>{link.tripDayId}</strong><p>{link.note || "No note"}</p><button className="danger-button" onClick={() => void unlinkDay(link.tripDayId)} type="button">Unlink Day</button></div>)}
                <label>Trip day ID<input onChange={(event) => setLinkDayId(event.target.value)} placeholder="Paste a trip day ID" value={linkDayId} /></label>
                <label>Link note<input onChange={(event) => setLinkDayNote(event.target.value)} value={linkDayNote} /></label>
                <button className="secondary-button" onClick={() => void linkDay()} type="button">Link Trip Day</button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>
    </>
  );
}
