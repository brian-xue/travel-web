import { severityForStatus, type NormalizedRoadStatus, type RoadSourceAdapter } from "../types";

export const manualOnlyAdapter: RoadSourceAdapter = {
  canHandle: (config) => config.parserType === "manual_only" || config.sourceType === "manual",
  async fetch() {
    return { status: 200, contentType: "manual", body: "", sourceUpdatedAt: null, sourceUrl: "" };
  },
  async normalize(): Promise<NormalizedRoadStatus> {
    return { normalizedStatus: "manual_review_required", severity: severityForStatus("manual_review_required"), summary: "This monitor requires manual confirmation.", sourceUpdatedAt: null, rawExcerpt: "", rawPayloadJson: "{}", confidence: "low" };
  },
};
