import { z } from "zod";
import { listJobs as listStoredJobs } from "../../core/jobs/store.js";
import { formatError } from "../utils.js";

export const schema = z.object({
  limit: z.number().optional().default(20).describe("Максимальное кол-во задач"),
});

export async function handler(args: { limit?: number }) {
  try {
    const jobs = await listStoredJobs(args.limit || 20);

    const compact = jobs.map((j) => ({
      job_id: j.id,
      state: j.state,
      model: j.model,
      created_at: j.createdAt,
      updated_at: j.updatedAt,
      has_results: j.localPaths.length > 0,
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: JSON.stringify({ total: compact.length, jobs: compact }, null, 2),
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
