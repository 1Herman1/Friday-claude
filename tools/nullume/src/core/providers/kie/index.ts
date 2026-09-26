import { ProviderError } from "../../errors.js";
import type { Provider, ModelInfo, CostEstimate, NormalizedStatus } from "../types.js";
import { KieClient, CASCADE_ORDER, TaskNotFound } from "./client.js";
import { normalizeStatus } from "./status.js";
import { priceForModel } from "./pricing.js";
import type { PricingRecord } from "./pricing.js";

export class KieProvider implements Provider {
  name = "kie";
  private client: KieClient;
  private modelList: ModelInfo[] = [];
  private pricing: PricingRecord[] = [];

  constructor(apiKey: string, models: ModelInfo[] = [], pricing: PricingRecord[] = []) {
    this.client = new KieClient(apiKey);
    this.modelList = models;
    this.pricing = pricing;
  }

  setModels(models: ModelInfo[]): void {
    this.modelList = models;
  }

  setPricing(pricing: PricingRecord[]): void {
    this.pricing = pricing;
  }

  async balance(): Promise<{ total: number; used: number }> {
    const resp = (await this.client.credits()) as {
      code?: number;
      msg?: string;
      message?: string;
      data?: { total?: unknown; used?: unknown };
    };

    // Код ответа игнорировать нельзя: при 401 тело пустое, и «0 кредитов»
    // выглядит как честный ответ, хотя это проглоченная ошибка доступа.
    if (resp.code !== undefined && resp.code !== 200) {
      throw new ProviderError(
        `kie.ai не отдал баланс: код ${resp.code}${resp.msg || resp.message ? ` — ${resp.msg ?? resp.message}` : ""}`
      );
    }

    const total = Number(resp.data?.total);
    const used = Number(resp.data?.used);
    if (!Number.isFinite(total)) {
      throw new ProviderError("kie.ai вернул ответ без поля total — баланс неизвестен");
    }

    return { total, used: Number.isFinite(used) ? used : 0 };
  }

  async models(): Promise<ModelInfo[]> {
    return this.modelList;
  }

  async model(id: string): Promise<ModelInfo> {
    const m = this.modelList.find((x) => x.id === id);
    if (!m) throw new Error(`Model not found: ${id}`);
    return m;
  }

  estimate(modelId: string, input: Record<string, unknown>): Promise<CostEstimate | null> {
    const price = priceForModel(this.pricing, modelId);
    if (!price) {
      return Promise.resolve(null);
    }

    // Determine source: if pricing is empty, it's vendored (from model.price)
    const source = this.pricing.length === 0 ? "vendored" : (price.approximate ? "fuzzy" : "pricing-api");

    return Promise.resolve({
      creditsMin: price.creditsMin,
      creditsMax: price.creditsMax,
      usdMin: price.usdMin,
      usdMax: price.usdMax,
      approximate: price.approximate,
      source,
    });
  }

  async create(modelId: string, input: Record<string, unknown>): Promise<{ taskId: string; api: string }> {
    const m = await this.model(modelId);
    const taskId = await this.client.create(m.api as any, modelId, input);
    return { taskId, api: m.api };
  }

  async status(ref: string): Promise<NormalizedStatus> {
    // Try each API type in CASCADE_ORDER
    let lastError: unknown;

    for (const api of CASCADE_ORDER) {
      try {
        const data = (await this.client.status(api as any, ref)) as any;
        return normalizeStatus(api, data);
      } catch (e) {
        // If TaskNotFound, continue; else save error
        if (!(e instanceof TaskNotFound)) {
          lastError = e;
        }
      }
    }

    // If we have a non-NotFound error, throw it; else generic
    if (lastError) throw lastError;
    throw new Error(`Task not found with any API: ${ref}`);
  }

  async upload(filePath: string): Promise<string> {
    return this.client.upload(filePath);
  }
}
