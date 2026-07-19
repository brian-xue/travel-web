import { createContext } from "react";
import type { SessionState } from "./types";

export interface AuthContextValue {
  session: SessionState;
  loading: boolean;
  login: (password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

export const anonymousSession: SessionState = {
  isAuthenticated: false,
  user: {
    id: "user-viewer",
    displayName: "Viewer Mode",
    role: "viewer",
  },
  expiresAt: null,
  csrfToken: null,
};

export const AuthContext = createContext<AuthContextValue | null>(null);
