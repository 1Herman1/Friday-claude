import fs from "node:fs";
import * as pathModule from "node:path";
import { getJobsDir, ensureDir } from "../paths.js";
import type { Job } from "./model.js";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateJobId(id: string): void {
  if (!UUID_REGEX.test(id)) {
    throw new Error(`Invalid job ID (must be UUID): ${id}`);
  }
}

function validateJobPath(jobPath: string): void {
  const jobsDir = getJobsDir();
  const resolvedPath = pathModule.resolve(jobPath);
  const resolvedDir = pathModule.resolve(jobsDir);
  if (!resolvedPath.startsWith(resolvedDir + pathModule.sep)) {
    throw new Error(`Path traversal not allowed: ${jobPath}`);
  }
}

export async function saveJob(job: Job): Promise<void> {
  validateJobId(job.id);
  await ensureDir(getJobsDir());
  const jobPath = pathModule.join(getJobsDir(), `${job.id}.json`);
  validateJobPath(jobPath);
  await fs.promises.writeFile(jobPath, JSON.stringify(job, null, 2));
}

export async function loadJob(id: string): Promise<Job> {
  validateJobId(id);
  const jobPath = pathModule.join(getJobsDir(), `${id}.json`);
  validateJobPath(jobPath);
  const content = await fs.promises.readFile(jobPath, "utf-8");
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
