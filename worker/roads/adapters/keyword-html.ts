import { fetchPublicSource } from "./safe-fetch";
import { cleanExcerpt, parseConfig, severityForStatus, statusFromText, type NormalizedRoadStatus, type RoadSourceAdapter } from "../types";

export const keywordHtmlAdapter: RoadSourceAdapter = {
  canHandle: (config) => config.parserType === "keyword_html" && config.sourceType === "html",
  fetch: (config, context) => fetchPublicSource(config.officialUrl, context),
  async normalize(result, config): Promise<NormalizedRoadStatus> {
    const text = cleanExcerpt(result.body.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "), 2_000);
    const options = parseConfig(config);
    const statusMap = (options.statusMap && typeof options.statusMap === "object" ? options.statusMap : {}) as Record<string, import("@/lib/api").RoadStatus>;
    const normalizedStatus = statusFromText(text, statusMap);
    return { normalizedStatus, severity: severityForStatus(normalizedStatus), summary: text || "No readable source text was found.", sourceUpdatedAt: result.sourceUpdatedAt, rawExcerpt: text.slice(0, 500), rawPayloadJson: JSON.stringify({ excerpt: text.slice(0, 500) }), confidence: normalizedStatus === "manual_review_required" ? "low" : "medium" };
  },
};
