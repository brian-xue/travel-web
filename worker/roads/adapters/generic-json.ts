import { fetchPublicSource } from "./safe-fetch";
import { cleanExcerpt, getPath, parseConfig, severityForStatus, statusFromText, type NormalizedRoadStatus, type RoadSourceAdapter } from "../types";

export const genericJsonAdapter: RoadSourceAdapter = {
  canHandle: (config) => config.parserType === "generic_json" && (config.sourceType === "api" || config.sourceType === "json"),
  fetch: (config, context) => fetchPublicSource(config.officialUrl, context),
  async normalize(result, config): Promise<NormalizedRoadStatus> {
    let payload: unknown;
    try {
      payload = JSON.parse(result.body) as unknown;
    } catch {
      return { normalizedStatus: "manual_review_required", severity: "unknown", summary: "The source did not return valid JSON.", sourceUpdatedAt: result.sourceUpdatedAt, rawExcerpt: cleanExcerpt(result.body), rawPayloadJson: "{}", confidence: "low" };
    }
    const options = parseConfig(config);
    const statusValue = getPath(payload, typeof options.statusPath === "string" ? options.statusPath : undefined);
    const summaryValue = getPath(payload, typeof options.summaryPath === "string" ? options.summaryPath : undefined);
    const updatedValue = getPath(payload, typeof options.updatedAtPath === "string" ? options.updatedAtPath : undefined);
    const statusMap = (options.statusMap && typeof options.statusMap === "object" ? options.statusMap : {}) as Record<string, import("@/lib/api").RoadStatus>;
    const sourceText = String(statusValue ?? summaryValue ?? "");
    const normalizedStatus = statusFromText(sourceText, statusMap);
    const summary = cleanExcerpt(String(summaryValue ?? statusValue ?? "No configured status field was found."));
    return { normalizedStatus, severity: severityForStatus(normalizedStatus), summary, sourceUpdatedAt: updatedValue ? String(updatedValue) : result.sourceUpdatedAt, rawExcerpt: summary, rawPayloadJson: JSON.stringify(payload).slice(0, 50_000), confidence: statusValue ? "high" : "low" };
  },
};
