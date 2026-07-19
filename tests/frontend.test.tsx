import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/States";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { AuthProvider } from "@/features/auth/AuthContext";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";

describe("frontend shell", () => {
  it("renders the login page", async () => {
    mockSessionResponse({
      isAuthenticated: false,
      user: null,
      expiresAt: null,
      csrfToken: null,
    });
    render(
      <MemoryRouter>
        <AuthProvider>
          <LoginPage />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "travel-web" })).toBeInTheDocument();
  });

  it("renders navigation when authenticated", async () => {
    mockSessionResponse({
      isAuthenticated: true,
      user: { id: "user-editor", displayName: "Sample Editor", role: "editor" },
      expiresAt: "2026-07-19T00:00:00.000Z",
      csrfToken: "csrf-token",
    });
    render(
      <MemoryRouter>
        <AuthProvider>
          <AppLayout>
            <DashboardPage />
          </AppLayout>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("redirects anonymous users to login", async () => {
    mockSessionResponse({
      isAuthenticated: false,
      user: null,
      expiresAt: null,
      csrfToken: null,
    });
    render(
      <MemoryRouter initialEntries={["/"]}>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <div>Protected</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("heading", { name: "travel-web" })).toBeInTheDocument();
  });

  it("shows an empty state component", () => {
    render(<EmptyState label="No data yet" detail="Sample placeholder only." />);
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("keeps a mobile menu control available", async () => {
    Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
    mockSessionResponse({
      isAuthenticated: true,
      user: { id: "user-viewer", displayName: "Sample Viewer", role: "viewer" },
      expiresAt: "2026-07-19T00:00:00.000Z",
      csrfToken: "csrf-token",
    });
    render(
      <MemoryRouter>
        <AuthProvider>
          <AppLayout>
            <DashboardPage />
          </AppLayout>
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(await screen.findByRole("button", { name: "Toggle navigation" })).toBeInTheDocument();
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mockSessionResponse(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        data,
        error: null,
      }),
    }),
  );
}
