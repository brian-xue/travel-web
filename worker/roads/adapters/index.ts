import { genericJsonAdapter } from "./generic-json";
import { genericRssAdapter } from "./generic-rss";
import { keywordHtmlAdapter } from "./keyword-html";
import { manualOnlyAdapter } from "./manual-only";
import type { RoadMonitorConfig, RoadSourceAdapter } from "../types";

const adapters: RoadSourceAdapter[] = [genericJsonAdapter, genericRssAdapter, keywordHtmlAdapter, manualOnlyAdapter];

export function findRoadAdapter(config: RoadMonitorConfig) {
  return adapters.find((adapter) => adapter.canHandle(config)) ?? null;
}
