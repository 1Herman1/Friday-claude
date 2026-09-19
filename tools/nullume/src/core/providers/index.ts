import type { Provider, ModelInfo } from "./types.js";
import { KieProvider } from "./kie/index.js";
import type { PricingRecord } from "./kie/pricing.js";

export interface MockProviderOptions {
  models?: ModelInfo[];
}

export class MockProvider implements Provider {
  name = "mock";
  private modelList: ModelInfo[];
  private tasks = new Map<
    string,
    { state: "pending" | "success"; urls: string[]; tick: number }
  >();
  private tick = 0;

  constructor(options: MockProviderOptions = {}) {
    this.modelList = options.models || [
      {
        id: "mock/image",
        category: "image",
        api: "jobs",
        fields: {},
        meta: {
          promptField: "prompt",
          required: ["prompt"],
          defaults: {},
        },
        description: "Mock image provider",
        schemaSource: "seed",
        source: "seed",
      },
    ];
  }

  async balance(): Promise<{ total: number; used: number }> {
    return { total: 1000, used: 0 };
  }

  async models(): Promise<ModelInfo[]> {
    return this.modelList;
  }

  async model(id: string): Promise<ModelInfo> {
    const m = this.modelList.find((x: ModelInfo) => x.id === id);
    if (!m) throw new Error(`Model not found: ${id}`);
    return m;
  }

  async estimate(): Promise<null> {
    return null;
  }

  async create(): Promise<{ taskId: string; api: string }> {
    const id = Math.random().toString(36).slice(2, 10);
    this.tasks.set(id, { state: "pending", urls: [], tick: 0 });
    return { taskId: id, api: "jobs" };
  }

  async status(ref: string): Promise<any> {
    const task = this.tasks.get(ref);
    if (!task) return { state: "pending", urls: [], raw: {} };

    task.tick += 1;
    if (task.tick >= 2) {
      task.state = "success";
      task.urls = ["data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="];
    }

    return {
      state: task.state,
      urls: task.urls,
      raw: {},
    };
  }

  async upload(): Promise<string> {
    return "file:///tmp/mock-upload";
  }
}

export async function getProvider(
  name: string = "kie",
  apiKey?: string,
  models?: ModelInfo[],
  pricing?: PricingRecord[]
): Promise<Provider> {
  if (name === "mock") {
    return new MockProvider({ models });
  }

  if (name === "kie") {
    if (!apiKey) throw new Error("KIE_API_KEY required for kie provider");
    const provider = new KieProvider(apiKey, models || [], pricing || []);
    return provider;
  }

  throw new Error(`Unknown provider: ${name}`);
}
