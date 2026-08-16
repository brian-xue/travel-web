import { fetchPublicSource } from "./safe-fetch";
import { cleanExcerpt, severityForStatus, statusFromText, type NormalizedRoadStatus, type RoadSourceAdapter } from "../types";

function tags(body: string, tag: string) {
  return [...body.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi"))].map((match) => match[1].replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, ""));
}

export const genericRssAdapter: RoadSourceAdapter = {
  canHandle: (config) => config.parserType === "generic_rss" && config.sourceType === "rss",
  fetch: (config, context) => fetchPublicSource(config.officialUrl, context),
  async normalize(result): Promise<NormalizedRoadStatus> {
    const titles = tags(result.body, "title");
    const descriptions = tags(result.body, "description");
    const summary = cleanExcerpt([titles[1] ?? titles[0], descriptions[0]].filter(Boolean).join(" - "));
    const normalizedStatus = statusFromText(summary);
    return { normalizedStatus, severity: severityForStatus(normalizedStatus), summary: summary || "No RSS item summary was found.", sourceUpdatedAt: result.sourceUpdatedAt, rawExcerpt: summary, rawPayloadJson: JSON.stringify({ title: titles[1] ?? titles[0] ?? "", description: descriptions[0] ?? "" }), confidence: summary ? "medium" : "low" };
  },
};
