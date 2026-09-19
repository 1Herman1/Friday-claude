import fs from "node:fs";
import { getJobsDir, ensureDir } from "../paths.js";
import type { Job } from "./model.js";

export async function saveJob(job: Job): Promise<void> {
  await ensureDir(getJobsDir());
  const path = `${getJobsDir()}/${job.id}.json`;
  await fs.promises.writeFile(path, JSON.stringify(job, null, 2));
}

export async function loadJob(id: string): Promise<Job> {
  const path = `${getJobsDir()}/${id}.json`;
  const content = await fs.promises.readFile(path, "utf-8");
  return JSON.parse(content);
}

export async function listJobs(limit: number = 50): Promise<Job[]> {
  await ensureDir(getJobsDir());
  const dir = getJobsDir();
  const files = await fs.promises.readdir(dir);
  const jobs: Job[] = [];

  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const job = await loadJob(file.slice(0, -5));
      jobs.push(job);
    } catch {
      // Skip
    }
  }

  jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return jobs.slice(0, limit);
}
