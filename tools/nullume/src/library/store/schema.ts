import type { DatabaseSync } from "node:sqlite";
import type { ImportRun } from "./types";

export interface Migration {
  version: number;
  sql: string;
}

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE IF NOT EXISTS "meta" (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS "references" (
        id TEXT PRIMARY KEY,
        sha256 TEXT NOT NULL UNIQUE,
        dhash TEXT,
        source TEXT NOT NULL,
        sourceRef TEXT NOT NULL,
        pageUrl TEXT,
        imageUrl TEXT,
        author TEXT,
        license TEXT,
        originalPath TEXT NOT NULL,
        previewPath TEXT,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        bytes INTEGER NOT NULL,
        meta TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'discarded')),
        importId TEXT,
        createdAt INTEGER NOT NULL,
        UNIQUE (source, sourceRef)
      );

      CREATE INDEX IF NOT EXISTS idx_references_sha256 ON "references"(sha256);
      CREATE INDEX IF NOT EXISTS idx_references_dhash ON "references"(dhash);
      CREATE INDEX IF NOT EXISTS idx_references_status ON "references"(status);
      CREATE INDEX IF NOT EXISTS idx_references_source ON "references"(source);
      CREATE INDEX IF NOT EXISTS idx_references_created ON "references"(createdAt);

      CREATE TABLE IF NOT EXISTS "embeddings" (
        refId TEXT NOT NULL,
        model TEXT NOT NULL,
        vec BLOB NOT NULL,
        PRIMARY KEY (refId, model),
        FOREIGN KEY (refId) REFERENCES "references"(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_embeddings_model ON "embeddings"(model);

      CREATE TABLE IF NOT EXISTS "tags" (
        refId TEXT NOT NULL,
        tag TEXT NOT NULL,
        origin TEXT NOT NULL,
        PRIMARY KEY (refId, tag),
        FOREIGN KEY (refId) REFERENCES "references"(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_tags_tag ON "tags"(tag);

      CREATE TABLE IF NOT EXISTS "palettes" (
        refId TEXT PRIMARY KEY,
        entries TEXT NOT NULL,
        FOREIGN KEY (refId) REFERENCES "references"(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "families" (
        id TEXT PRIMARY KEY,
        slug TEXT UNIQUE,
        name TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('proposed', 'approved', 'discarded', 'merged')),
        mergedInto TEXT,
        descriptor TEXT,
        centroid BLOB,
        clusterRunId TEXT,
        proposedBy TEXT NOT NULL CHECK (proposedBy IN ('cluster', 'claude', 'owner')),
        createdAt INTEGER NOT NULL,
        updatedAt INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_families_status ON "families"(status);
      CREATE INDEX IF NOT EXISTS idx_families_clusterRunId ON "families"(clusterRunId);

      CREATE TABLE IF NOT EXISTS "family_members" (
        familyId TEXT NOT NULL,
        refId TEXT NOT NULL,
        distance REAL NOT NULL,
        isExemplar INTEGER NOT NULL,
        PRIMARY KEY (familyId, refId),
        FOREIGN KEY (familyId) REFERENCES "families"(id) ON DELETE CASCADE,
        FOREIGN KEY (refId) REFERENCES "references"(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_family_members_familyId ON "family_members"(familyId);
      CREATE INDEX IF NOT EXISTS idx_family_members_refId ON "family_members"(refId);

      CREATE TABLE IF NOT EXISTS "imports" (
        id TEXT PRIMARY KEY,
        importer TEXT NOT NULL,
        kind TEXT NOT NULL,
        query TEXT NOT NULL,
        stats TEXT,
        startedAt INTEGER NOT NULL,
        completedAt INTEGER
      );

      CREATE INDEX IF NOT EXISTS idx_imports_started ON "imports"(startedAt);

      CREATE TABLE IF NOT EXISTS "decisions" (
        id TEXT PRIMARY KEY,
        familyId TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('approve', 'rename', 'merge', 'discard')),
        payload TEXT NOT NULL,
        actor TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (familyId) REFERENCES "families"(id)
      );

      CREATE INDEX IF NOT EXISTS idx_decisions_familyId ON "decisions"(familyId);
    `,
  },
];

export function applyMigrations(db: DatabaseSync): void {
  let currentVersion = 0;

  // Try to get current version
  try {
    const getVersion = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'");
    const row = getVersion.get() as { value: string } | undefined;
    if (row) {
      currentVersion = parseInt(row.value, 10);
    }
  } catch {
    // Table doesn't exist yet, currentVersion stays 0
  }

  // Apply all migrations newer than current version
  for (const migration of MIGRATIONS) {
    if (migration.version > currentVersion) {
      // Split SQL by semicolons and execute each statement separately
      const statements = migration.sql
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0)
        .map((s) => s.replace(/\s+/g, " ")); // Normalize whitespace

      for (const stmt of statements) {
        try {
          db.exec(stmt);
        } catch (e) {
          // Ignore IF NOT EXISTS errors
          if ((e as any).message?.includes("already exists")) {
            continue;
          }
          throw e;
        }
      }

      const setVersion = db.prepare(
        "INSERT OR REPLACE INTO meta (key, value) VALUES ('schema_version', ?)"
      );
      setVersion.run(String(migration.version));
    }
  }

  // Ensure pragmas
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");
}
