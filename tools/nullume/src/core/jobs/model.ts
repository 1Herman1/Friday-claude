export interface Job {
  id: string;
  provider: string;
  api: string;
  taskId: string;
  model: string;
  input: Record<string, unknown>;
  state: "pending" | "success" | "fail";
  estimate?: {
    creditsMin: number;
    creditsMax: number;
    usdMin: number;
    usdMax: number;
  };
  cost?: number;
  styleFamily?: string;
  resultUrls: string[];
  localPaths: string[];
  failMsg?: string;
  rerunOf?: string;
  createdAt: string;
  updatedAt: string;
}

export function createJob(
  id: string,
  provider: string,
  api: string,
  taskId: string,
  model: string,
  input: Record<string, unknown>,
  estimate?: any
): Job {
  const now = new Date().toISOString();
  return {
    id,
    provider,
    api,
    taskId,
    model,
    input,
    state: "pending",
    estimate,
    resultUrls: [],
    localPaths: [],
    createdAt: now,
    updatedAt: now,
  };
}
