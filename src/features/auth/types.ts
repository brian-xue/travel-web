export type UserRole = "viewer" | "editor" | "admin";

export interface SessionUser {
  id: string;
  displayName: string;
  role: UserRole;
}

export interface SessionState {
  isAuthenticated: boolean;
  user: SessionUser | null;
  expiresAt: string | null;
  csrfToken: string | null;
}
