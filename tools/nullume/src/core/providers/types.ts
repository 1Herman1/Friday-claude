export type ModelCategory = "image" | "video" | "audio" | "other";
export type NormalizedState = "pending" | "success" | "fail";
export type SchemaSource = "docs" | "seed" | "api";
export type CostSource = "pricing-api" | "fuzzy" | "vendored" | "unknown";

export interface FieldSpec {
  type?: string;
  required?: boolean;
  description?: string;
  enum?: string[];
  default?: unknown;
  constraints?: Record<string, unknown>;
}

export interface PriceInfo {
  creditsMin: number;
  creditsMax: number;
  usdMin: number;
  usdMax: number;
  unit?: string;
  approximate: boolean;
}

export interface CostEstimate {
  creditsMin: number;
  creditsMax: number;
  usdMin: number;
  usdMax: number;
  unit?: string;
  approximate: boolean;
  source: CostSource;
}

export interface ModelMeta {
  promptField?: string;
  imageField?: string;
  imageList?: boolean;
  required: string[];
  defaults: Record<string, unknown>;
}

export interface ModelInfo {
  id: string;
  category: ModelCategory;
  api: "jobs" | "veo" | "runway" | "gpt4o" | "flux" | "suno";
  docUrl?: string;
  fields: Record<string, FieldSpec>;
  meta: ModelMeta;
  description?: string;
  price?: PriceInfo;
  schemaSource: SchemaSource;
  stale?: boolean;
  source: "vendored" | "cache" | "live" | "seed";
}

export interface NormalizedStatus {
  state: NormalizedState;
  urls: string[];
  tracks?: unknown[];
  failMsg?: string;
  progress?: number;
  raw: unknown;
}

export interface Provider {
  name: string;
  balance(): Promise<{ total: number; used: number }>;
  models(): Promise<ModelInfo[]>;
  model(id: string): Promise<ModelInfo>;
  estimate(model: string, input: Record<string, unknown>): Promise<CostEstimate | null>;
  create(model: string, input: Record<string, unknown>): Promise<{ taskId: string; api: string }>;
  status(ref: string): Promise<NormalizedStatus>;
  upload(filePath: string): Promise<string>;
  setModels?(models: ModelInfo[]): void;
  setPricing?(pricing: any[]): void;
}
