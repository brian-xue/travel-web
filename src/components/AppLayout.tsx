import type { PropsWithChildren } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/features/auth/useAuth";

const links = [
  { to: "/", label: "Dashboard" },
  { to: "/trip", label: "Trip" },
  { to: "/map", label: "Map" },
  { to: "/weather", label: "Weather" },
  { to: "/roads", label: "Roads" },
  { to: "/checklists", label: "Checklists" },
  { to: "/notes", label: "Notes" },
  { to: "/settings", label: "Settings" },
  { to: "/admin", label: "Admin" },
];

export function AppLayout({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand">
          <p className="eyebrow">Personal Planning Workspace</p>
          <h1>travel-web</h1>
          <p className="muted">Editable sample itinerary, weather, roads, and travel checklists.</p>
        </div>
        <nav className="nav" aria-label="Main navigation">
          {links.map((link) => (
            <NavLink
              key={link.to}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
              onClick={() => setOpen(false)}
              to={link.to}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <button
            aria-label="Toggle navigation"
            className="menu-button"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            Menu
          </button>
          <div>
            <p className="eyebrow">{session.isAuthenticated ? "Signed in as" : "Viewing as"}</p>
            <strong>{session.user?.displayName ?? "Guest"}</strong>
          </div>
          {session.isAuthenticated ? (
            <button
              className="secondary-button"
              onClick={async () => {
                await logout();
                navigate("/");
              }}
              type="button"
            >
              Logout
            </button>
          ) : (
            <button className="secondary-button" onClick={() => navigate("/login")} type="button">
              Editor/Admin Login
            </button>
          )}
        </header>
        <main className="main-content">{children}</main>
      </div>
    </div>
  );
}
