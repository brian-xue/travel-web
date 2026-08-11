import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { PageHeader } from "@/components/PageElements";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { useAuth } from "@/features/auth/useAuth";
import { api, type NoteInput, type NoteItem } from "@/lib/api";

function buildNoteDraft(tripId: string, order: number): NoteInput {
  return {
    tripId,
    category: "safety",
    title: `Example note ${order}`,
    contentMarkdown: "## Reminder\n- Example content only\n- No real trip details",
    sortOrder: order,
    enabled: true,
  };
}

export function NotesPage() {
  const { session } = useAuth();
  const [tripId, setTripId] = useState<string>("");
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<NoteInput | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const canEdit = session.user?.role === "editor" || session.user?.role === "admin";

  async function load(nextTripId?: string) {
    const targetTripId = nextTripId || tripId;
    if (!targetTripId) return;
    setNotes(await api.listNotes(targetTripId));
  }

  useEffect(() => {
    async function initialize() {
      const dashboard = await api.getDashboard();
      if (dashboard.featuredTripId) {
        setTripId(dashboard.featuredTripId);
        await load(dashboard.featuredTripId);
        setDraft(buildNoteDraft(dashboard.featuredTripId, 1));
      }
      setLoaded(true);
    }
    void initialize().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load notes"));
  }, []);

  if (error) return <ErrorState label="Unable to load notes" detail={error} />;
  if (!loaded) return <LoadingState label="Loading notes" />;
  if (!tripId) {
    return <EmptyState label="No trip available yet" detail="Create a trip first in /admin/trip before adding notes." />;
  }

  const currentDraft = draft ?? buildNoteDraft(tripId, notes.length + 1);

  return (
    <>
      <PageHeader title="Notes" description="Markdown-backed driving, safety, weather, and packing notes shared across devices." />
      {canEdit ? (
        <section className="panel-card">
          <p className="eyebrow">Create Note</p>
          <div className="two-column-grid">
            <label>
              Category
              <select
                onChange={(event) => setDraft((value) => ({ ...(value ?? currentDraft), category: event.target.value as NoteInput["category"] }))}
                value={currentDraft.category}
              >
                <option value="driving">driving</option>
                <option value="altitude">altitude</option>
                <option value="weather">weather</option>
                <option value="park">park</option>
                <option value="safety">safety</option>
                <option value="packing">packing</option>
                <option value="custom">custom</option>
              </select>
            </label>
            <label>
              Sort Order
              <input
                min="1"
                onChange={(event) => setDraft((value) => ({ ...(value ?? currentDraft), sortOrder: Number(event.target.value) || 1 }))}
                type="number"
                value={currentDraft.sortOrder}
              />
            </label>
          </div>
          <label>
            Title
            <input
              onChange={(event) => setDraft((value) => ({ ...(value ?? currentDraft), title: event.target.value }))}
              type="text"
              value={currentDraft.title}
            />
          </label>
          <label>
            Markdown
            <textarea
              onChange={(event) => setDraft((value) => ({ ...(value ?? currentDraft), contentMarkdown: event.target.value }))}
              rows={7}
              value={currentDraft.contentMarkdown}
            />
          </label>
          <label className="checkbox-row">
            <input
              checked={currentDraft.enabled}
              onChange={(event) => setDraft((value) => ({ ...(value ?? currentDraft), enabled: event.target.checked }))}
              type="checkbox"
            />
            Enabled
          </label>
          <div className="button-row">
            <button
              className="primary-button"
              onClick={async () => {
                if (!session.csrfToken) return;
                try {
                  await api.createNote(currentDraft, session.csrfToken);
                  await load();
                  setDraft(buildNoteDraft(tripId, notes.length + 2));
                  setStatus("Note created.");
                } catch (createError) {
                  setStatus(createError instanceof Error ? createError.message : "Failed to create note");
                }
              }}
              type="button"
            >
              Add Note
            </button>
          </div>
          {status ? <p className={status.includes("Failed") ? "error-text" : "save-status saved"}>{status}</p> : null}
        </section>
      ) : null}
      {notes.length === 0 ? (
        <EmptyState label="No notes yet" detail="Create a note to store planning reminders and safety guidance." />
      ) : (
        <div className="stacked-grid">
          {notes.map((note) => (
            <article className="panel-card" key={note.id}>
              <NoteEditorCard
                canEdit={canEdit}
                note={note}
                onChange={async (input) => {
                  if (!session.csrfToken) return;
                  await api.updateNote(note.id, input, session.csrfToken);
                  await load();
                }}
                onDelete={async () => {
                  if (!session.csrfToken) return;
                  await api.deleteNote(note.id, session.csrfToken);
                  await load();
                }}
              />
            </article>
          ))}
        </div>
      )}
    </>
  );
}

function NoteEditorCard({
  note,
  canEdit,
  onChange,
  onDelete,
}: {
  note: NoteItem;
  canEdit: boolean;
  onChange: (input: NoteInput) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<NoteInput>({
    tripId: note.tripId,
    category: note.category,
    title: note.title,
    contentMarkdown: note.contentMarkdown,
    sortOrder: note.sortOrder,
    enabled: note.enabled,
    expectedUpdatedAt: note.updatedAt,
  });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setDraft({
      tripId: note.tripId,
      category: note.category,
      title: note.title,
      contentMarkdown: note.contentMarkdown,
      sortOrder: note.sortOrder,
      enabled: note.enabled,
      expectedUpdatedAt: note.updatedAt,
    });
  }, [note]);

  return (
    <>
      <div className="title-row">
        <div>
          <p className="eyebrow">{note.category}</p>
          <h3>{note.title}</h3>
        </div>
        {canEdit ? (
          <div className="button-row">
            <button
              className="primary-button"
              onClick={() =>
                void onChange(draft)
                  .then(() => setStatus("Saved"))
                  .catch((saveError) => setStatus(saveError instanceof Error ? saveError.message : "Failed to save note"))
              }
              type="button"
            >
              Save Note
            </button>
            <button
              className="secondary-button"
              onClick={() =>
                void onDelete()
                  .then(() => setStatus("Deleted"))
                  .catch((deleteError) => setStatus(deleteError instanceof Error ? deleteError.message : "Failed to delete note"))
              }
              type="button"
            >
              Delete Note
            </button>
          </div>
        ) : null}
      </div>
      {canEdit ? (
        <>
          <div className="two-column-grid">
            <label>
              Category
              <select
                onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value as NoteInput["category"] }))}
                value={draft.category}
              >
                <option value="driving">driving</option>
                <option value="altitude">altitude</option>
                <option value="weather">weather</option>
                <option value="park">park</option>
                <option value="safety">safety</option>
                <option value="packing">packing</option>
                <option value="custom">custom</option>
              </select>
            </label>
            <label>
              Sort Order
              <input
                min="1"
                onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) || 1 }))}
                type="number"
                value={draft.sortOrder}
              />
            </label>
          </div>
          <label>
            Title
            <input onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} type="text" value={draft.title} />
          </label>
          <label>
            Markdown
            <textarea
              onChange={(event) => setDraft((current) => ({ ...current, contentMarkdown: event.target.value }))}
              rows={7}
              value={draft.contentMarkdown}
            />
          </label>
          <label className="checkbox-row">
            <input
              checked={draft.enabled}
              onChange={(event) => setDraft((current) => ({ ...current, enabled: event.target.checked }))}
              type="checkbox"
            />
            Enabled
          </label>
        </>
      ) : (
        <SafeMarkdown markdown={note.contentMarkdown} />
      )}
      {status ? <p className={status === "Saved" || status === "Deleted" ? "save-status saved" : "error-text"}>{status}</p> : null}
    </>
  );
}
