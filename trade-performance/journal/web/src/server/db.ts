import "server-only";
import path from "node:path";
import fs from "node:fs";
import { Pool } from "pg";

// DATABASE_URL берём из trade-performance/.env (не коммитится)
function databaseUrl(): string {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const envPath = path.resolve(process.cwd(), "../../.env");
  const line = fs.readFileSync(envPath, "utf8").split("\n").find((l) => l.startsWith("DATABASE_URL="));
  if (!line) throw new Error("DATABASE_URL не найден в trade-performance/.env");
  return line.slice("DATABASE_URL=".length).trim().replace(/^['"]|['"]$/g, "");
}

const g = globalThis as unknown as { __pool?: Pool };
export const pool = g.__pool ?? new Pool({ connectionString: databaseUrl(), max: 5 });
g.__pool = pool;

export async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const r = await pool.query(sql, params);
  return r.rows as T[];
}
