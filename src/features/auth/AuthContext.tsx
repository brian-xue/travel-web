import { startTransition, useEffect, useEffectEvent, useState, type PropsWithChildren } from "react";
import { api } from "@/lib/api";
import type { SessionState } from "./types";
import { anonymousSession, AuthContext } from "./auth-context";

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<SessionState>(anonymousSession);
  const [loading, setLoading] = useState(true);

  const applySession = useEffectEvent((nextSession: SessionState) => {
    startTransition(() => {
      setSession(nextSession);
    });
  });

  const refreshSession = useEffectEvent(async () => {
    try {
      const current = await api.getSession();
      applySession(current);
    } catch {
      applySession(anonymousSession);
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    void refreshSession();
  }, []);

  async function login(password: string) {
    const current = await api.login(password);
    applySession(current);
  }

  async function logout() {
    if (session.csrfToken) {
      await api.logout(session.csrfToken);
    }
    applySession(anonymousSession);
  }

  return (
    <AuthContext.Provider value={{ session, loading, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}
