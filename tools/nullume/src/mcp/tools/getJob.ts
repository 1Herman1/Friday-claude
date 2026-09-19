import { z } from "zod";
import { loadJob, saveJob } from "../../core/jobs/store.js";
import { getProviderInstance } from "../provider.js";
import { downloadFile } from "../../core/download.js";
import { getDownloadsDir, ensureDir } from "../../core/paths.js";
import { resultExtension } from "../../core/jobs/results.js";
import path from "node:path";
import { formatError } from "../utils.js";

export const schema = z.object({
  job_id: z.string().uuid().describe("ID задачи для проверки"),
});

export async function handler(args: { job_id: string }) {
  try {
    const job = await loadJob(args.job_id);
    const downloadsDir = getDownloadsDir();

    // If pending, check status once
    if (job.state === "pending") {
      try {
        const provider = await getProviderInstance();
        const status = await provider.status(job.taskId);
        job.state = status.state;
        if (status.urls) job.resultUrls = status.urls;
        if (status.failMsg) job.failMsg = status.failMsg;
        job.updatedAt = new Date().toISOString();

        // Download if success
        if (status.state === "success" && status.urls && status.urls.length > 0) {
          await ensureDir(downloadsDir);

          for (let i = 0; i < status.urls.length; i++) {
            const url = status.urls[i];
            if (url.startsWith("data:")) continue;

            const ext = resultExtension(url, undefined, job.model.split("/")[0]);
            const name = `${job.model.replace(/\//g, "-")}-${job.id.slice(0, 8)}-${i}${ext}`;
            const dest = path.join(downloadsDir, name);

            try {
              await downloadFile(url, dest, downloadsDir);
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
