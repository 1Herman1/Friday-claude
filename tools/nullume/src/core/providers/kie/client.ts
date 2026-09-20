import fs from "node:fs";
import path from "node:path";
import { ProviderError, TaskNotFound } from "../../errors.js";
import { FetchImpl } from "../../net.js";
import { assertUploadable } from "../../files.js";
import { getDownloadsDir } from "../../../core/paths.js";

export { TaskNotFound } from "../../errors.js";

export const BASE_URL = "https://api.kie.ai";
export const UPLOAD_URL = "https://kieai.redpandaai.co/api/file-stream-upload";

export const CREATE_ENDPOINTS = {
  jobs: "/api/v1/jobs/createTask",
  veo: "/api/v1/veo/generate",
  runway: "/api/v1/runway/generate",
  gpt4o: "/api/v1/gpt4o-image/generate",
  flux: "/api/v1/flux/kontext/generate",
  suno: "/api/v1/generate",
} as const;

export const STATUS_ENDPOINTS = {
  jobs: "/api/v1/jobs/recordInfo",
  veo: "/api/v1/veo/record-info",
  runway: "/api/v1/runway/record-detail",
  gpt4o: "/api/v1/gpt4o-image/record-info",
  flux: "/api/v1/flux/kontext/record-info",
  suno: "/api/v1/generate/record-info",
} as const;

export const CASCADE_ORDER: Array<keyof typeof CREATE_ENDPOINTS> = ["jobs", "veo", "suno", "gpt4o", "flux", "runway"];

const NOT_FOUND_MARKERS = ["not found", "not exist", "no such", "does not exist", "не найден"];
const AUDIO_EXT = new Set([".mp3", ".wav", ".ogg", ".flac", ".m4a", ".aac"]);
const VIDEO_EXT = new Set([".mp4", ".mov", ".webm", ".mkv", ".avi"]);

function guessUploadPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (AUDIO_EXT.has(ext)) return "audio";
  if (VIDEO_EXT.has(ext)) return "videos";
  return "images";
}

export function extractFileUrl(data: unknown, depth = 0): string | null {
  if (!data || typeof data !== "object" || depth > 3) return null;
  const obj = data as Record<string, any>;

  for (const key of ["downloadUrl", "fileUrl", "url", "fileURL", "download_url", "file_url"]) {
    const value = obj[key];
    if (typeof value === "string" && /^https?:\/\//.test(value)) return value;
  }

  for (const key of ["data", "result", "file", "fileInfo"]) {
    const nested = extractFileUrl(obj[key], depth + 1);
    if (nested) return nested;
  }

  return null;
}

export interface ApiResponse {
  code?: number;
  msg?: string;
  data?: unknown;
  [key: string]: unknown;
}

export class KieClient {
  constructor(
    private apiKey: string,
    private baseUrl: string = BASE_URL,
    private fetchImpl: FetchImpl = fetch as FetchImpl
  ) {}

  private _headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.apiKey}`,
      "Content-Type": "application/json",
    };
  }

  private async _handle(resp: Response): Promise<unknown> {
    let payload: any;
    try {
      payload = await resp.json();
    } catch {
      const text = await resp.text().catch(() => "");
      throw new ProviderError(`HTTP ${resp.status}: ${text.slice(0, 300)}`);
    }

    if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
      throw new ProviderError(`Неожиданный ответ API: ${String(payload).slice(0, 300)}`);
    }

    const code = payload.code;

    // Ошибка 401 приходит с HTTP 200, смотрим payload.code
    if (code === 200 || (code === undefined && payload.success === true && resp.ok)) {
      return payload.data || payload;
    }

    const msg = String(payload.msg || payload.message || "");

    if (code === 404 || NOT_FOUND_MARKERS.some((m) => msg.toLowerCase().includes(m))) {
      throw new TaskNotFound(msg || "задача не найдена", code);
    }

    throw new ProviderError(msg || `HTTP ${resp.status}`, code);
  }

  private async _post(urlPath: string, body: unknown): Promise<unknown> {
    let resp: Response;
    try {
      resp = await this.fetchImpl(this.baseUrl + urlPath, {
        method: "POST",
        headers: this._headers(),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
      });
    } catch (exc) {
      throw new ProviderError(`Сетевая ошибка: ${(exc as Error).message}`);
    }
    return this._handle(resp);
  }

  private async _get(urlPath: string, params: Record<string, string> = {}): Promise<unknown> {
    const qs = new URLSearchParams(params).toString();
    let resp: Response;
    try {
      resp = await this.fetchImpl(this.baseUrl + urlPath + (qs ? `?${qs}` : ""), {
        headers: this._headers(),
        signal: AbortSignal.timeout(60000),
      });
    } catch (exc) {
      throw new ProviderError(`Сетевая ошибка: ${(exc as Error).message}`);
    }
    return this._handle(resp);
  }

  async credits(): Promise<{ code: number; data?: unknown }> {
    return (await this._get("/api/v1/chat/credit")) as any;
  }

  async upload(filePath: string, uploadPath?: string): Promise<string> {
    // Validate file before upload
    const allowedRoots = [process.cwd(), getDownloadsDir()];
    await assertUploadable(filePath, allowedRoots);

    if (!uploadPath) uploadPath = guessUploadPath(filePath);

    const name = path.basename(filePath);
    const form = new FormData();
    form.append("file", new Blob([fs.readFileSync(filePath)]), name);
    form.append("uploadPath", uploadPath);
    form.append("fileName", name);

    let resp: Response;
    try {
      resp = await this.fetchImpl(UPLOAD_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}` },
        body: form,
        signal: AbortSignal.timeout(300000),
      });
    } catch (exc) {
      throw new ProviderError(`Сетевая ошибка при загрузке: ${(exc as Error).message}`);
    }

    const data = await this._handle(resp);
    const url = extractFileUrl(data);
    if (url) return url;

    throw new ProviderError(`Загрузка файла: неожиданный ответ: ${JSON.stringify(data)}`);
  }

  async create(
    api: keyof typeof CREATE_ENDPOINTS,
    modelId: string,
    inputData: Record<string, unknown>,
    callbackUrl?: string
  ): Promise<string> {
    if (!(api in CREATE_ENDPOINTS)) throw new ProviderError(`Неизвестный тип API: ${api}`);

    let body: Record<string, unknown>;
    if (api === "jobs") {
      body = { model: modelId, input: { ...inputData } };
    } else if (api === "veo" || api === "flux") {
      body = { ...inputData, model: modelId };
    } else {
      body = { ...inputData };
    }
    if (callbackUrl) body.callBackUrl = callbackUrl;

    const data = (await this._post(CREATE_ENDPOINTS[api], body)) as any;
    if (data && typeof data === "object") {
      const taskId = data.taskId || data.task_id || data.id;
      if (taskId) return String(taskId);
    }

    throw new ProviderError(`Создание задачи: неожиданный ответ: ${JSON.stringify(data)}`);
  }

  async status(api: keyof typeof STATUS_ENDPOINTS, taskId: string): Promise<unknown> {
    if (!(api in STATUS_ENDPOINTS)) throw new ProviderError(`Неизвестный тип API: ${api}`);
    const data = await this._get(STATUS_ENDPOINTS[api], { taskId });
    return data && typeof data === "object" ? data : {};
  }
}
