import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppLayout } from "@/components/AppLayout";
import { EmptyState } from "@/components/States";
import { ProtectedRoute } from "@/features/auth/ProtectedRoute";
import { AuthProvider } from "@/features/auth/AuthContext";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PlaceGeocoder } from "@/components/PlaceGeocoder";
import { api, type GeocodingFeature } from "@/lib/api";

describe("frontend shell", () => {
  it("renders the login page", async () => {
    mockSessionResponse({
      isAuthenticated: false,
      user: { id: "user-viewer", displayName: "Viewer Mode", role: "viewer" },
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
    expect(screen.getByRole("button", { name: "Sign In as Editor or Admin" })).toBeInTheDocument();
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

  it("allows viewer mode through protected routes without login", async () => {
    mockSessionResponse({
      isAuthenticated: false,
      user: { id: "user-viewer", displayName: "Viewer Mode", role: "viewer" },
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
    expect(await screen.findByText("Protected")).toBeInTheDocument();
  });

  it("shows an empty state component", () => {
    render(<EmptyState label="No data yet" detail="Sample placeholder only." />);
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });

  it("keeps a mobile menu control available", async () => {
    Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
    mockSessionResponse({
      isAuthenticated: false,
      user: { id: "user-viewer", displayName: "Viewer Mode", role: "viewer" },
      expiresAt: null,
      csrfToken: null,
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
    expect(screen.getByRole("button", { name: "Editor/Admin Login" })).toBeInTheDocument();
  });

  it("does not search until the place query reaches three characters and the debounce completes", async () => {
    const search = vi.spyOn(api, "searchGeocoding").mockResolvedValue({ features: [] });
    const { rerender } = render(<PlaceGeocoder onChange={() => undefined} onSelect={() => undefined} value="Yo" />);

    await new Promise((resolve) => window.setTimeout(resolve, 450));
    expect(search).not.toHaveBeenCalled();

    rerender(<PlaceGeocoder onChange={() => undefined} onSelect={() => undefined} value="Yos" />);
    await waitFor(() => expect(search).toHaveBeenCalledWith("Yos", expect.any(AbortSignal)));
  });

  it("shows results and writes the selected place and coordinates in the correct order", async () => {
    const feature: GeocodingFeature = {
      id: "poi.1",
      place_name: "Yosemite Valley, California, United States",
      center: [-119.5383, 37.8651],
      place_type: ["park"],
    };
    vi.spyOn(api, "searchGeocoding").mockResolvedValue({ features: [feature] });
    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(<PlaceGeocoder onChange={onChange} onSelect={onSelect} value="Yos" />);

    const option = await screen.findByRole("option", { name: /Yosemite Valley/ });
    expect(option).toHaveTextContent("park");
    fireEvent.click(option);

    expect(onSelect).toHaveBeenCalledWith(feature);
    expect(feature.center).toEqual([-119.5383, 37.8651]);
  });

  it("supports keyboard selection and preserves manual name editing", async () => {
    const feature: GeocodingFeature = {
      id: "poi.2",
      place_name: "General Sherman Tree, California, United States",
      center: [-118.765, 36.5819],
      place_type: ["poi"],
    };
    vi.spyOn(api, "searchGeocoding").mockResolvedValue({ features: [feature] });
    const onChange = vi.fn();
    const onSelect = vi.fn();
    render(<PlaceGeocoder onChange={onChange} onSelect={onSelect} value="Gen" />);

    const input = await screen.findByRole("combobox");
    await screen.findByRole("option");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.change(input, { target: { value: "Manual place" } });

    expect(onSelect).toHaveBeenCalledWith(feature);
    expect(onChange).toHaveBeenCalledWith("Manual place");
  });

  it("shows empty and failed search states", async () => {
    const search = vi.spyOn(api, "searchGeocoding").mockResolvedValueOnce({ features: [] }).mockRejectedValueOnce(new Error("Search unavailable"));
    const { rerender } = render(<PlaceGeocoder onChange={() => undefined} onSelect={() => undefined} value="Now" />);
    expect(await screen.findByText("No places found.")).toBeInTheDocument();

    rerender(<PlaceGeocoder onChange={() => undefined} onSelect={() => undefined} value="New" />);
    expect(await screen.findByText("Search unavailable")).toBeInTheDocument();
    expect(search).toHaveBeenCalledTimes(2);
  });

  it("does not allow an older request to replace newer results", async () => {
    let resolveFirst: ((value: { features: GeocodingFeature[] }) => void) | undefined;
    const firstFeature: GeocodingFeature = { id: "old", place_name: "Old result", center: [1, 2] };
    const newFeature: GeocodingFeature = { id: "new", place_name: "New result", center: [3, 4] };
    vi.spyOn(api, "searchGeocoding").mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveFirst = resolve;
      }),
    ).mockResolvedValueOnce({ features: [newFeature] });
    const { rerender } = render(<PlaceGeocoder onChange={() => undefined} onSelect={() => undefined} value="Old" />);
    await waitFor(() => expect(api.searchGeocoding).toHaveBeenCalledWith("Old", expect.any(AbortSignal)));
    rerender(<PlaceGeocoder onChange={() => undefined} onSelect={() => undefined} value="New" />);
    expect(await screen.findByRole("option", { name: /New result/ })).toBeInTheDocument();
    resolveFirst?.({ features: [firstFeature] });
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(screen.queryByRole("option", { name: "Old result" })).not.toBeInTheDocument();
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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
