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
  user: null,
  expiresAt: null,
  csrfToken: null,
};

export const AuthContext = createContext<AuthContextValue | null>(null);
