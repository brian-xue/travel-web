import { useEffect, useState } from "react";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { PageHeader } from "@/components/PageElements";
import { useAuth } from "@/features/auth/useAuth";
import { api, type ChecklistInput, type ChecklistItem } from "@/lib/api";

function buildChecklistDraft(tripId: string, order: number): ChecklistInput {
  return {
    tripId,
    listType: "shopping",
    category: "sample",
    title: `Example item ${order}`,
    quantity: 1,
    priority: 1,
    status: "pending",
    note: "",
    sortOrder: order,
  };
}

export function ChecklistsPage() {
  const { session } = useAuth();
  const [tripId, setTripId] = useState<string>("");
  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<ChecklistInput | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const canEdit = session.user?.role === "editor" || session.user?.role === "admin";

  async function load(nextTripId?: string) {
    const targetTripId = nextTripId || tripId;
    if (!targetTripId) return;
    setItems(await api.listChecklists(targetTripId));
  }

  useEffect(() => {
    async function initialize() {
      const dashboard = await api.getDashboard();
      if (dashboard.featuredTripId) {
        setTripId(dashboard.featuredTripId);
        await load(dashboard.featuredTripId);
        setDraft(buildChecklistDraft(dashboard.featuredTripId, 1));
      }
      setLoaded(true);
    }
    void initialize().catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load checklist"));
  }, []);

  if (error) return <ErrorState label="Unable to load checklists" detail={error} />;
  if (!loaded) return <LoadingState label="Loading checklists" />;
  if (!tripId) {
    return <EmptyState label="No trip available yet" detail="Create a trip first in /admin/trip before adding checklist items." />;
  }

  const currentDraft = draft ?? buildChecklistDraft(tripId, items.length + 1);

  return (
    <>
      <PageHeader title="Checklists" description="Shared shopping, packing, vehicle, and document lists stored in D1." />
      {canEdit ? (
        <section className="panel-card">
          <p className="eyebrow">Create Checklist Item</p>
          <div className="two-column-grid">
            <label>
              List Type
              <select
                onChange={(event) => setDraft((value) => ({ ...(value ?? currentDraft), listType: event.target.value as ChecklistInput["listType"] }))}
                value={currentDraft.listType}
              >
                <option value="shopping">shopping</option>
                <option value="packing">packing</option>
                <option value="car">car</option>
                <option value="document">document</option>
                <option value="custom">custom</option>
              </select>
            </label>
            <label>
              Status
              <select
                onChange={(event) => setDraft((value) => ({ ...(value ?? currentDraft), status: event.target.value as ChecklistInput["status"] }))}
                value={currentDraft.status}
              >
                <option value="pending">pending</option>
                <option value="purchased">purchased</option>
                <option value="packed">packed</option>
                <option value="loaded">loaded</option>
                <option value="skipped">skipped</option>
              </select>
            </label>
          </div>
          <div className="two-column-grid">
            <label>
              Category
              <input onChange={(event) => setDraft((value) => ({ ...(value ?? currentDraft), category: event.target.value }))} type="text" value={currentDraft.category} />
            </label>
            <label>
              Title
              <input onChange={(event) => setDraft((value) => ({ ...(value ?? currentDraft), title: event.target.value }))} type="text" value={currentDraft.title} />
            </label>
          </div>
          <div className="two-column-grid">
            <label>
              Quantity
              <input
                min="0"
                onChange={(event) => setDraft((value) => ({ ...(value ?? currentDraft), quantity: Number(event.target.value) || 0 }))}
                type="number"
                value={currentDraft.quantity}
              />
            </label>
            <label>
              Priority
              <input
                min="0"
                onChange={(event) => setDraft((value) => ({ ...(value ?? currentDraft), priority: Number(event.target.value) || 0 }))}
                type="number"
                value={currentDraft.priority}
              />
            </label>
          </div>
          <label>
            Note
            <textarea onChange={(event) => setDraft((value) => ({ ...(value ?? currentDraft), note: event.target.value }))} rows={4} value={currentDraft.note} />
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
          <div className="button-row">
            <button
              className="primary-button"
              onClick={async () => {
                if (!session.csrfToken) return;
                try {
                  await api.createChecklistItem(currentDraft, session.csrfToken);
                  await load();
                  setDraft(buildChecklistDraft(tripId, items.length + 2));
                  setStatus("Checklist item created.");
                } catch (createError) {
                  setStatus(createError instanceof Error ? createError.message : "Failed to create checklist item");
                }
              }}
              type="button"
            >
              Add Checklist Item
            </button>
          </div>
          {status ? <p className={status.includes("Failed") ? "error-text" : "save-status saved"}>{status}</p> : null}
        </section>
      ) : null}
      {items.length === 0 ? (
        <EmptyState label="No checklist items yet" detail="Create a sample item to start syncing shopping and packing state." />
      ) : (
        <div className="stacked-grid">
          {items.map((item) => (
            <article className="panel-card" key={item.id}>
              <ChecklistEditorCard
                canEdit={canEdit}
                item={item}
                onChange={async (input) => {
                  if (!session.csrfToken) return;
                  await api.updateChecklistItem(item.id, input, session.csrfToken);
                  await load();
                }}
                onDelete={async () => {
                  if (!session.csrfToken) return;
                  await api.deleteChecklistItem(item.id, session.csrfToken);
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

function ChecklistEditorCard({
  item,
  canEdit,
  onChange,
  onDelete,
}: {
  item: ChecklistItem;
  canEdit: boolean;
  onChange: (input: ChecklistInput) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [draft, setDraft] = useState<ChecklistInput>({
    tripId: item.tripId,
    listType: item.listType,
    category: item.category,
    title: item.title,
    quantity: item.quantity,
    priority: item.priority,
    status: item.status,
    note: item.note,
    sortOrder: item.sortOrder,
    expectedUpdatedAt: item.updatedAt,
  });
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    setDraft({
      tripId: item.tripId,
      listType: item.listType,
      category: item.category,
      title: item.title,
      quantity: item.quantity,
      priority: item.priority,
      status: item.status,
      note: item.note,
      sortOrder: item.sortOrder,
      expectedUpdatedAt: item.updatedAt,
    });
  }, [item]);

  return (
    <>
      <div className="title-row">
        <div>
          <p className="eyebrow">{item.listType}</p>
          <h3>{item.title}</h3>
        </div>
        {canEdit ? (
          <div className="button-row">
            <button
              className="primary-button"
              onClick={() =>
                void onChange(draft)
                  .then(() => setStatus("Saved"))
                  .catch((saveError) => setStatus(saveError instanceof Error ? saveError.message : "Failed to save checklist item"))
              }
              type="button"
            >
              Save Item
            </button>
            <button
              className="secondary-button"
              onClick={() =>
                void onDelete()
                  .then(() => setStatus("Deleted"))
                  .catch((deleteError) => setStatus(deleteError instanceof Error ? deleteError.message : "Failed to delete checklist item"))
              }
              type="button"
            >
              Delete Item
            </button>
          </div>
        ) : null}
      </div>
      {canEdit ? (
        <>
          <div className="two-column-grid">
            <label>
              List Type
              <select
                onChange={(event) => setDraft((current) => ({ ...current, listType: event.target.value as ChecklistInput["listType"] }))}
                value={draft.listType}
              >
                <option value="shopping">shopping</option>
                <option value="packing">packing</option>
                <option value="car">car</option>
                <option value="document">document</option>
                <option value="custom">custom</option>
              </select>
            </label>
            <label>
              Status
              <select
                onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as ChecklistInput["status"] }))}
                value={draft.status}
              >
                <option value="pending">pending</option>
                <option value="purchased">purchased</option>
                <option value="packed">packed</option>
                <option value="loaded">loaded</option>
                <option value="skipped">skipped</option>
              </select>
            </label>
          </div>
          <div className="two-column-grid">
            <label>
              Category
              <input onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} type="text" value={draft.category} />
            </label>
            <label>
              Title
              <input onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} type="text" value={draft.title} />
            </label>
          </div>
          <div className="two-column-grid">
            <label>
              Quantity
              <input
                min="0"
                onChange={(event) => setDraft((current) => ({ ...current, quantity: Number(event.target.value) || 0 }))}
                type="number"
                value={draft.quantity}
              />
            </label>
            <label>
              Priority
              <input
                min="0"
                onChange={(event) => setDraft((current) => ({ ...current, priority: Number(event.target.value) || 0 }))}
                type="number"
                value={draft.priority}
              />
            </label>
          </div>
          <label>
            Note
            <textarea onChange={(event) => setDraft((current) => ({ ...current, note: event.target.value }))} rows={4} value={draft.note} />
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
        </>
      ) : (
        <>
          <p>{item.category}</p>
          <p className="muted">{item.status}</p>
        </>
      )}
      {status ? <p className={status === "Saved" || status === "Deleted" ? "save-status saved" : "error-text"}>{status}</p> : null}
    </>
  );
}
