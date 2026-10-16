import path from "node:path";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// секреты лежат в trade-performance/.env (не коммитится)
config({ path: path.resolve(import.meta.dirname, "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL! },
});
