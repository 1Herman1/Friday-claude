import { NormalizedStatus } from "../types.js";

export function normalizeStatus(api: string, data: Record<string, any>): NormalizedStatus {
  const result: NormalizedStatus = {
    state: "pending",
    urls: [],
    failMsg: undefined,
    progress: undefined,
    raw: data,
  };

  if (!data) return result;

  if (api === "jobs" || (api === "gpt4o" && data.successFlag === undefined && "state" in data)) {
    const state = data.state;
    result.progress = data.progress ?? undefined;

    if (state === "success") {
      result.state = "success";
      if (data.resultJson) {
        try {
          const parsed = JSON.parse(data.resultJson);
          result.urls = parsed.resultUrls || [];
        } catch {
          result.urls = [];
        }
      }
    } else if (state === "fail") {
      result.state = "fail";
      const failMsg = data.failMsg || "генерация не удалась";
      result.failMsg = data.failCode ? `[${data.failCode}] ${failMsg}` : failMsg;
    }
    return result;
  }

  if (api === "veo" || api === "gpt4o" || api === "flux") {
    const flag = data.successFlag;
    if (flag === 1) {
      result.state = "success";
      if (api === "flux") {
        result.urls = data.resultImageUrl ? [data.resultImageUrl] : [];
      } else {
        result.urls = (data.response && data.response.resultUrls) || [];
      }
    } else if (flag === 2 || flag === 3) {
      result.state = "fail";
      result.failMsg = data.errorMessage || data.failMsg || "генерация не удалась";
    }
    return result;
  }

  if (api === "runway") {
    const state = data.state;
    if (state === "success") {
      result.state = "success";
      let url = data.videoInfo && data.videoInfo.videoUrl;
      if (!url) url = ((data.response && data.response.resultUrls) || [null])[0];
      result.urls = url ? [url] : [];
    } else if (state === "fail") {
      result.state = "fail";
      result.failMsg = data.failMsg || "генерация не удалась";
    }
    return result;
  }

  if (api === "suno") {
    const status = String(data.status || "");
    if (status === "SUCCESS") {
      result.state = "success";
      const tracks = (data.response && data.response.sunoData) || [];
      result.tracks = tracks?.map((t: any) => ({
        audioUrl: t.audioUrl ?? null,
        streamAudioUrl: t.streamAudioUrl ?? null,
        imageUrl: t.imageUrl ?? null,
        duration: t.duration ?? null,
        title: t.title ?? null,
      })) || [];
      result.urls = (result.tracks as any[]).filter((t: any) => t.audioUrl).map((t: any) => t.audioUrl);
    } else if (status.includes("FAILED") || status === "SENSITIVE_WORD_ERROR") {
      result.state = "fail";
      result.failMsg = data.errorMessage || status || "генерация не удалась";
    }
    return result;
  }

  return result;
}
