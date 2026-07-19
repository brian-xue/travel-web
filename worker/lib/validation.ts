import type { AppSettings } from "@/lib/api";

export function validateLoginBody(payload: unknown) {
  if (!payload || typeof payload !== "object" || typeof (payload as { password?: unknown }).password !== "string") {
    return false;
  }
  return (payload as { password: string }).password.trim().length >= 6;
}

export function validateSettings(payload: unknown): payload is AppSettings {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  const value = payload as AppSettings;
  return (
    typeof value.weatherRefreshMinutes === "number" &&
    value.weatherRefreshMinutes >= 5 &&
    typeof value.roadMonitoringMode === "string" &&
    typeof value.releaseVersion === "string" &&
    typeof value.lastDataRefreshAt === "string" &&
    typeof value.uiPreferences?.compactCards === "boolean"
  );
}
