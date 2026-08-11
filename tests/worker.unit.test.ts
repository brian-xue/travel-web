import { describe, expect, it } from "vitest";
import { jsonError, jsonSuccess } from "@worker/lib/response";
import { buildSessionCookie } from "@worker/lib/session";
import { isExpired } from "@worker/lib/time";
import { validateLoginBody, validateSettings } from "@worker/lib/validation";
import { sampleSettings } from "./fakes";

describe("worker helper utilities", () => {
  it("wraps successful responses", async () => {
    const response = jsonSuccess({ name: "travel-web" });
    const body = (await response.json()) as {
      ok: boolean;
      data: { name: string };
      error: null;
    };
    expect(body).toEqual({
      ok: true,
      data: { name: "travel-web" },
      error: null,
    });
  });

  it("wraps error responses", async () => {
    const response = jsonError(401, { code: "UNAUTHORIZED", message: "Authentication required" });
    const body = (await response.json()) as {
      ok: boolean;
      data: null;
      error: { code: string; message: string };
    };
    expect(response.status).toBe(401);
    expect(body.ok).toBe(false);
  });

  it("detects session expiration", () => {
    expect(isExpired("2020-01-01T00:00:00.000Z", new Date("2026-07-18T00:00:00.000Z"))).toBe(true);
    expect(isExpired("2027-01-01T00:00:00.000Z", new Date("2026-07-18T00:00:00.000Z"))).toBe(false);
  });

  it("validates login input", () => {
    expect(validateLoginBody({ password: "sample-password" })).toBe(true);
    expect(validateLoginBody({ password: "123" })).toBe(false);
  });

  it("validates settings input", () => {
    expect(validateSettings(sampleSettings)).toBe(true);
    expect(validateSettings({ releaseVersion: "0.1.0" })).toBe(false);
  });

  it("uses non-secure cookies for local loopback development", () => {
    expect(buildSessionCookie("token", "2026-07-27T00:00:00.000Z", "http://127.0.0.1:8787/api/auth/login")).not.toContain(
      "Secure",
    );
    expect(buildSessionCookie("token", "2026-07-27T00:00:00.000Z", "https://example.com/api/auth/login")).toContain("Secure");
  });
});
