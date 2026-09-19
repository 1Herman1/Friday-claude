import { z } from "zod";
import { loadJob, saveJob } from "../../core/jobs/store.js";
import { getProviderInstance } from "../provider.js";
import { downloadFile } from "../../core/download.js";
import { getDownloadsDir, ensureDir } from "../../core/paths.js";
import path from "node:path";
import { formatError } from "../utils.js";

export const schema = z.object({
  job_id: z.string().describe("ID задачи для проверки"),
});

function getExtFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const lastPart = pathname.split("/").pop() || "";
    const dotIdx = lastPart.lastIndexOf(".");
    if (dotIdx > 0) return lastPart.slice(dotIdx);
  } catch {
    // Invalid URL
  }

  if (url.includes("mp3") || url.includes("audio")) return ".mp3";
  if (url.includes("mp4") || url.includes("video")) return ".mp4";
  if (url.includes("wav")) return ".wav";
  if (url.includes("webm")) return ".webm";
  return ".png";
}

export async function handler(args: { job_id: string }) {
  try {
    const job = await loadJob(args.job_id);

    // If pending, check status once
    if (job.state === "pending") {
      try {
        const provider = await getProviderInstance();
        const status = await provider.status(job.taskId);
        job.state = status.state as any;
        if (status.urls) job.resultUrls = status.urls;
        if (status.failMsg) job.failMsg = status.failMsg;
        job.updatedAt = new Date().toISOString();

        // Download if success
        if (status.state === "success" && status.urls.length > 0) {
          await ensureDir(getDownloadsDir());

          for (let i = 0; i < status.urls.length; i++) {
            const url = status.urls[i];
            if (url.startsWith("data:")) continue;

            const ext = getExtFromUrl(url);
            const name = `${job.model.replace(/\//g, "-")}-${job.id.slice(0, 8)}-${i}${ext}`;
            const dest = path.join(getDownloadsDir(), name);

            try {
              await downloadFile(url, dest);
              if (!job.localPaths.includes(dest)) {
                job.localPaths.push(dest);
              }
            } catch (e) {
              // Continue on download error
            }
          }
        }

        await saveJob(job);
      } catch (e) {
        // Continue with stale job data
      }
    }

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify(
            {
              job_id: job.id,
              state: job.state,
              model: job.model,
              result_urls: job.resultUrls,
              local_paths: job.localPaths,
              fail_msg: job.failMsg,
              created_at: job.createdAt,
              updated_at: job.updatedAt,
            },
            null,
            2
          ),
        },
      ],
    };
  } catch (error) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ error: formatError(error) }) }],
      isError: true,
    };
  }
}
