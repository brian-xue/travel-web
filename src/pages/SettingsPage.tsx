import { useEffect, useState } from "react";
import { ErrorState, LastUpdated, LoadingState, SaveStatus, UnauthorizedState } from "@/components/States";
import { PageHeader } from "@/components/PageElements";
import { useAuth } from "@/features/auth/useAuth";
import { api, type AppSettings } from "@/lib/api";

const defaultSettings: AppSettings = {
  weatherRefreshMinutes: 30,
  roadMonitoringMode: "manual",
  releaseVersion: "0.1.0",
  lastDataRefreshAt: "2026-07-18T00:00:00.000Z",
  uiPreferences: {
    compactCards: false,
  },
};

export function SettingsPage() {
  const { session } = useAuth();
  const canEdit = session.user?.role === "editor" || session.user?.role === "admin";
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const nextSettings = await api.getSettings();
        setSettings(nextSettings);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  if (loading) {
    return <LoadingState label="Loading settings" />;
  }

  if (error) {
    return <ErrorState label="Unable to load settings" detail={error} />;
  }

  async function handleSave() {
    if (!session.csrfToken || !canEdit) {
      return;
    }
    const nextSettings = await api.updateSettings(settings, session.csrfToken);
    setSettings(nextSettings);
    setSaved(true);
  }

  return (
    <>
      <PageHeader
        description="Application settings are stored server-side and protected by role checks."
        title="Settings"
        action={<SaveStatus saved={saved} />}
      />
      <div className="settings-form">
        <label>
          Weather refresh minutes
          <input
            min={5}
            onChange={(event) => {
              setSaved(false);
              setSettings((current) => ({
                ...current,
                weatherRefreshMinutes: Number(event.target.value),
              }));
            }}
            type="number"
            value={settings.weatherRefreshMinutes}
          />
        </label>
        <label>
          Road monitoring mode
          <select
            onChange={(event) => {
              setSaved(false);
              setSettings((current) => ({
                ...current,
                roadMonitoringMode: event.target.value,
              }));
            }}
            value={settings.roadMonitoringMode}
          >
            <option value="manual">Manual</option>
            <option value="scheduled">Scheduled</option>
          </select>
        </label>
        <label className="checkbox-row">
          <input
            checked={settings.uiPreferences.compactCards}
            onChange={(event) => {
              setSaved(false);
              setSettings((current) => ({
                ...current,
                uiPreferences: {
                  compactCards: event.target.checked,
                },
              }));
            }}
            type="checkbox"
          />
          Compact dashboard cards
        </label>
        {!canEdit ? (
          <UnauthorizedState
            detail="Viewer access can inspect settings but cannot save changes."
            label="Read-only mode"
          />
        ) : (
          <button className="primary-button" onClick={() => void handleSave()} type="button">
            Save settings
          </button>
        )}
      </div>
      <LastUpdated value={settings.lastDataRefreshAt} />
    </>
  );
}
