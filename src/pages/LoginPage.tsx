import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/features/auth/useAuth";

export function LoginPage() {
  const { session, login } = useAuth();
  const location = useLocation();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const destination = (location.state as { from?: string } | null)?.from ?? "/";

  if (session.isAuthenticated) {
    return <Navigate replace to={destination} />;
  }

  return (
    <div className="login-shell">
      <form
        className="login-card"
        onSubmit={async (event) => {
          event.preventDefault();
          setError(null);
          try {
            await login(password);
          } catch (loginError) {
            setError(loginError instanceof Error ? loginError.message : "Login failed");
          }
        }}
        >
        <p className="eyebrow">Secure Access</p>
        <h1>travel-web</h1>
        <p>Viewer mode is open without a password. Use an editor or admin password here for write access.</p>
        <label>
          Password
          <input
            autoComplete="current-password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button className="primary-button" type="submit">
          Sign In as Editor or Admin
        </button>
      </form>
    </div>
  );
}
