import type { SessionState } from "@/features/auth/types";

export interface ApiEnvelope<T> {
  ok: boolean;
  data: T | null;
  error: {
    code: string;
    message: string;
  } | null;
}

export interface AppSettings {
  weatherRefreshMinutes: number;
  roadMonitoringMode: string;
  releaseVersion: string;
  lastDataRefreshAt: string;
  uiPreferences: {
    compactCards: boolean;
  };
}

const API_BASE_URL =
  (import.meta as ImportMeta & {
    env?: {
      VITE_API_BASE_URL?: string;
    };
  }).env?.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!payload.ok || !payload.data) {
    throw new Error(payload.error?.message ?? "Request failed");
  }
  return payload.data;
}

export const api = {
  getSession: () => request<SessionState>("/api/auth/session"),
  login: (password: string) =>
    request<SessionState>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
  logout: (csrfToken: string) =>
    request<{ success: true }>("/api/auth/logout", {
      method: "POST",
      headers: { "X-CSRF-Token": csrfToken },
    }),
  getSettings: () => request<AppSettings>("/api/settings"),
  updateSettings: (settings: AppSettings, csrfToken: string) =>
    request<AppSettings>("/api/settings", {
      method: "PUT",
      headers: { "X-CSRF-Token": csrfToken },
      body: JSON.stringify(settings),
    }),
};
