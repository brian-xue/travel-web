import type { AppSettings } from "@/lib/api";
import { jsonError, jsonSuccess } from "../lib/response";
import { validateSettings } from "../lib/validation";
import type { Repositories, SessionRecord, UserRecord } from "../types";

export async function getSettings(repositories: Repositories) {
  const settings = await repositories.settings.get();
  return jsonSuccess(settings);
}

export async function updateSettings(
  request: Request,
  repositories: Repositories,
  user: UserRecord,
  session: SessionRecord,
) {
  if (user.role === "viewer") {
    return jsonError(403, {
      code: "FORBIDDEN",
      message: "Viewer role cannot modify settings",
    });
  }

  const csrfHeader = request.headers.get("X-CSRF-Token");
  if (!csrfHeader || csrfHeader !== session.csrfToken) {
    return jsonError(403, {
      code: "CSRF_INVALID",
      message: "Missing or invalid CSRF header",
    });
  }

  const payload = (await request.json()) as AppSettings;
  if (!validateSettings(payload)) {
    return jsonError(400, {
      code: "BAD_REQUEST",
      message: "Invalid settings payload",
    });
  }

  const nextSettings = await repositories.settings.update(payload);
  await repositories.auditLog.insert({
    actorUserId: user.id,
    action: "settings.update",
    entityType: "app_settings",
    entityId: "app_settings",
    metadataJson: JSON.stringify({ role: user.role }),
    createdAt: new Date().toISOString(),
  });

  return jsonSuccess(nextSettings);
}
