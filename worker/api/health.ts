import { jsonSuccess } from "../lib/response";

export function handleHealthCheck() {
  return jsonSuccess({
    name: "travel-web",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}
