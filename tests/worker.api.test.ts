import { beforeAll, describe, expect, it } from "vitest";
import { hashPassword } from "@worker/lib/password";
import { getSessionTokenFromCookie, hashSessionToken } from "@worker/lib/session";
import { handleRequest } from "@worker/index";
import type { WorkerEnv } from "@worker/types";
import { createMemoryRepositories, sampleSettings } from "./fakes";

const salt = "00112233445566778899aabbccddeeff";
let editorHash = "";
let adminHash = "";

beforeAll(async () => {
  editorHash = `pbkdf2_sha256$1000$${salt}$${await hashPassword("editor-password", salt, 1000)}`;
  adminHash = `pbkdf2_sha256$1000$${salt}$${await hashPassword("admin-password", salt, 1000)}`;
});

function createEnv(): WorkerEnv {
  return {
    DB: {} as WorkerEnv["DB"],
    SESSION_SECRET: "session-secret",
    EDITOR_PASSWORD_HASH: editorHash,
    AUTH_PASSWORD_HASH: adminHash,
  };
}

describe("worker api", () => {
  it("returns health check", async () => {
    const response = await handleRequest(new Request("https://example.com/api/health"), createEnv(), createMemoryRepositories());
    expect(response.status).toBe(200);
  });

  it("returns viewer mode when no session cookie exists", async () => {
    const response = await handleRequest(
      new Request("https://example.com/api/auth/session"),
      createEnv(),
      createMemoryRepositories(),
    );
    const body = (await response.json()) as {
      data: { isAuthenticated: boolean; user: { role: string; displayName: string } };
    };
    expect(response.status).toBe(200);
    expect(body.data.isAuthenticated).toBe(false);
    expect(body.data.user.role).toBe("viewer");
  });

  it("handles successful OPTIONS preflight", async () => {
    const response = await handleRequest(
      new Request("https://example.com/api/settings", {
        method: "OPTIONS",
        headers: {
          Origin: "http://localhost:5173",
        },
      }),
      createEnv(),
      createMemoryRepositories(),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, PUT, DELETE, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-CSRF-Token");
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("allows both configured local origins", async () => {
    const response = await handleRequest(
      new Request("https://example.com/api/health", {
        headers: {
          Origin: "http://127.0.0.1:5173",
        },
      }),
      createEnv(),
      createMemoryRepositories(),
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://127.0.0.1:5173");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
  });

  it("does not allow disallowed origins", async () => {
    const response = await handleRequest(
      new Request("https://example.com/api/health", {
        headers: {
          Origin: "https://example.invalid",
        },
      }),
      createEnv(),
      createMemoryRepositories(),
    );

    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, PUT, DELETE, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-CSRF-Token");
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("adds CORS headers to normal API responses", async () => {
    const response = await handleRequest(
      new Request("https://example.com/api/health", {
        headers: {
          Origin: "http://localhost:5173",
        },
      }),
      createEnv(),
      createMemoryRepositories(),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("http://localhost:5173");
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe("true");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, POST, PUT, DELETE, OPTIONS");
    expect(response.headers.get("Access-Control-Allow-Headers")).toBe("Content-Type, X-CSRF-Token");
    expect(response.headers.get("Vary")).toBe("Origin");
  });

  it("logs in successfully", async () => {
    const repositories = createMemoryRepositories();
    const response = await handleRequest(
      new Request("https://example.com/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password: "editor-password" }),
      }),
      createEnv(),
      repositories,
    );
    const body = (await response.json()) as {
      ok: boolean;
      data: { user: { role: string } };
    };
    expect(body.ok).toBe(true);
    expect(body.data.user.role).toBe("editor");
    expect(response.headers.get("Set-Cookie")).toContain("HttpOnly");
  });

  it("rejects invalid login", async () => {
    const response = await handleRequest(
      new Request("https://example.com/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ password: "wrong-password" }),
      }),
      createEnv(),
      createMemoryRepositories(),
    );
    expect(response.status).toBe(401);
  });

  it("allows settings reads in viewer mode without login", async () => {
    const response = await handleRequest(new Request("https://example.com/api/settings"), createEnv(), createMemoryRepositories());
    expect(response.status).toBe(200);
  });

  it("requires editor or admin auth for settings updates", async () => {
    const response = await handleRequest(
      new Request("https://example.com/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(sampleSettings),
      }),
      createEnv(),
      createMemoryRepositories(),
    );
    expect(response.status).toBe(401);
  });

  it("allows editor updates", async () => {
    const repositories = createMemoryRepositories();
    const { sessionToken, csrfToken } = await loginAndExtractTokens("editor-password", repositories);
    const response = await handleRequest(
      new Request("https://example.com/api/settings", {
        method: "PUT",
        headers: {
          Cookie: `travel_web_session=${sessionToken}`,
          "X-CSRF-Token": csrfToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...sampleSettings,
          weatherRefreshMinutes: 45,
        }),
      }),
      createEnv(),
      repositories,
    );
    const body = (await response.json()) as {
      data: { weatherRefreshMinutes: number };
    };
    expect(response.status).toBe(200);
    expect(body.data.weatherRefreshMinutes).toBe(45);
  });

  it("logs out and invalidates the session", async () => {
    const repositories = createMemoryRepositories();
    const { sessionToken, csrfToken } = await loginAndExtractTokens("admin-password", repositories);
    const logoutResponse = await handleRequest(
      new Request("https://example.com/api/auth/logout", {
        method: "POST",
        headers: {
          Cookie: `travel_web_session=${sessionToken}`,
          "X-CSRF-Token": csrfToken,
        },
      }),
      createEnv(),
      repositories,
    );
    expect(logoutResponse.status).toBe(200);

    const tokenHash = await hashSessionToken(sessionToken, "session-secret");
    expect(await repositories.sessions.findByTokenHash(tokenHash)).toBeNull();
  });
});

async function loginAndExtractTokens(password: string, repositories: ReturnType<typeof createMemoryRepositories>) {
  const response = await handleRequest(
    new Request("https://example.com/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password }),
    }),
    createEnv(),
    repositories,
  );
  const body = (await response.json()) as {
    data: { csrfToken: string };
  };
  const cookie = response.headers.get("Set-Cookie");
  if (!cookie) {
    throw new Error("Missing session cookie");
  }
  const sessionToken = getSessionTokenFromCookie(cookie);
  if (!sessionToken) {
    throw new Error("Missing session token");
  }
  return { sessionToken, csrfToken: body.data.csrfToken as string };
}
