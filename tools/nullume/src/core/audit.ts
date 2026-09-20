import type { ModelInfo } from "./providers/types.js";
import type { PricingRecord } from "./providers/kie/pricing.js";

export interface AuditDiscrepancy {
  modelId: string;
  type: "model_missing" | "model_new" | "required_changed" | "prompt_field_changed" | "image_field_changed" | "price_changed";
  description: string;
  vendored?: string;
  live?: string;
}

export interface AuditReport {
  timestamp: string;
  vendoredCount: number;
  liveCount: number;
  discrepancies: AuditDiscrepancy[];
  summary: {
    missing: number;
    new: number;
    metaChanged: number;
    priceChanged: number;
  };
}

export function auditCatalog(
  vendored: ModelInfo[],
  live: ModelInfo[],
  vendoredPrices: PricingRecord[],
  livePrices: PricingRecord[]
): AuditReport {
  const discrepancies: AuditDiscrepancy[] = [];
  const vendoredMap = new Map(vendored.map((m) => [m.id, m]));
  const liveMap = new Map(live.map((m) => [m.id, m]));

  // Track summary
  const summary = {
    missing: 0,
    new: 0,
    metaChanged: 0,
    priceChanged: 0,
  };

  // Check for missing models (in vendored but not in live)
  for (const [modelId, vendoredModel] of vendoredMap.entries()) {
    // Семейства со своим API (veo, suno…) в market-документации не значатся —
    // их отсутствие там не «пропажа».
    if (vendoredModel.schemaSource === "seed" && vendoredModel.api !== "jobs") continue;
    if (!liveMap.has(modelId)) {
      discrepancies.push({
        modelId,
        type: "model_missing",
        description: `Model removed from live documentation`,
        vendored: modelId,
      });
      summary.missing++;
    }
  }

  // Check for new models and metadata changes
  for (const [modelId, liveModel] of liveMap.entries()) {
    const vendoredModel = vendoredMap.get(modelId);

    if (!vendoredModel) {
      discrepancies.push({
        modelId,
        type: "model_new",
        description: `New model in live documentation`,
        live: modelId,
      });
      summary.new++;
      continue;
    }

    // Check required fields
    const vendoredReq = vendoredModel.meta.required.sort();
    const liveReq = liveModel.meta.required.sort();
    if (JSON.stringify(vendoredReq) !== JSON.stringify(liveReq)) {
      discrepancies.push({
        modelId,
        type: "required_changed",
        description: `Required fields changed`,
        vendored: vendoredReq.join(", "),
        live: liveReq.join(", "),
      });
      summary.metaChanged++;
    }

    // Check prompt field
    if (vendoredModel.meta.promptField !== liveModel.meta.promptField) {
      discrepancies.push({
        modelId,
        type: "prompt_field_changed",
        description: `Prompt field name changed`,
        vendored: vendoredModel.meta.promptField || "undefined",
        live: liveModel.meta.promptField || "undefined",
      });
      summary.metaChanged++;
    }

    // Check image field
    if (vendoredModel.meta.imageField !== liveModel.meta.imageField) {
      discrepancies.push({
        modelId,
        type: "image_field_changed",
        description: `Image field name changed`,
        vendored: vendoredModel.meta.imageField || "undefined",
        live: liveModel.meta.imageField || "undefined",
      });
      summary.metaChanged++;
    }

    // Check price (if available in both)
    if (vendoredModel.price && liveModel.price) {
      if (
        vendoredModel.price.creditsMin !== liveModel.price.creditsMin ||
        vendoredModel.price.creditsMax !== liveModel.price.creditsMax
      ) {
        discrepancies.push({
          modelId,
          type: "price_changed",
          description: `Price changed`,
          vendored: `${vendoredModel.price.creditsMin}-${vendoredModel.price.creditsMax}`,
          live: `${liveModel.price.creditsMin}-${liveModel.price.creditsMax}`,
        });
        summary.priceChanged++;
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    vendoredCount: vendored.length,
    liveCount: live.length,
    discrepancies,
    summary,
  };
}
