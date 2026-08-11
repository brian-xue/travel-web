import { createBrowserRouter, Navigate } from "react-router-dom";
import { ProtectedLayout } from "./ProtectedLayout";
import { AdminPage } from "@/pages/AdminPage";
import { AdminTripPage } from "@/pages/AdminTripPage";
import { ChecklistsPage } from "@/pages/ChecklistsPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { LoginPage } from "@/pages/LoginPage";
import { MapPage } from "@/pages/MapPage";
import { NotesPage } from "@/pages/NotesPage";
import { RoadsPage } from "@/pages/RoadsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { TripPage } from "@/pages/TripPage";
import { WeatherPage } from "@/pages/WeatherPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/",
    element: <ProtectedLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "trip", element: <TripPage /> },
      { path: "map", element: <MapPage /> },
      { path: "weather", element: <WeatherPage /> },
      { path: "roads", element: <RoadsPage /> },
      { path: "checklists", element: <ChecklistsPage /> },
      { path: "notes", element: <NotesPage /> },
      { path: "settings", element: <SettingsPage /> },
      { path: "admin", element: <AdminPage /> },
      { path: "admin/trip", element: <AdminTripPage /> },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/" replace />,
  },
]);
