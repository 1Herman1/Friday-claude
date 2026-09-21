import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import type {
  LibraryStore,
  Reference,
  NewReference,
  Family,
  FamilyMember,
  ImportRun,
  Decision,
  PaletteEntry,
} from "./types";
import { applyMigrations } from "./schema";

function generateId(): string {
  return randomUUID();
}

function hammingDistance(a: bigint, b: bigint): number {
  const xor = a ^ b;
  let count = 0;
  for (let i = 0; i < 64; i++) {
    if ((xor & (1n << BigInt(i))) !== 0n) {
      count++;
    }
  }
  return count;
}

function bigintToHex(n: bigint): string {
  return n.toString(16).padStart(16, "0");
}

function hexToBigint(hex: string): bigint {
  return BigInt("0x" + hex);
}

function float32ToBlob(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

function blobToFloat32(buf: Buffer): Float32Array {
  return new Float32Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
}

export class SqliteStore implements LibraryStore {
  private db: DatabaseSync;

  constructor(db: DatabaseSync) {
    this.db = db;
    applyMigrations(db);
  }

  // References
  insertReference(ref: NewReference): Reference {
    const id = generateId();
    const createdAt = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO "references" (
        id, sha256, dhash, source, sourceRef, pageUrl, imageUrl, author, license,
        originalPath, previewPath, width, height, bytes, meta, status, importId, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      stmt.run(
        id,
        ref.sha256,
        ref.dhash !== null && ref.dhash !== undefined ? bigintToHex(ref.dhash) : null,
        ref.source,
        ref.sourceRef,
        ref.pageUrl || null,
        ref.imageUrl || null,
        ref.author || null,
        ref.license || null,
        ref.originalPath,
        ref.previewPath || null,
        ref.width,
        ref.height,
        ref.bytes,
        JSON.stringify(ref.meta),
        ref.status,
        ref.importId || null,
        createdAt
      );
    } catch (e) {
      if ((e as any).message?.includes("UNIQUE")) {
        throw new Error("Reference with same sha256 or (source, sourceRef) already exists");
      }
      throw e;
    }

    return { ...ref, id, createdAt };
  }

  getReference(id: string): Reference | undefined {
    const stmt = this.db.prepare('SELECT * FROM "references" WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.rowToReference(row) : undefined;
  }

  findBySha256(sha: string): Reference | undefined {
    const stmt = this.db.prepare('SELECT * FROM "references" WHERE sha256 = ?');
    const row = stmt.get(sha) as any;
    return row ? this.rowToReference(row) : undefined;
  }

  findByDhash(dhash: bigint, maxHamming = 6): Reference[] {
    const stmt = this.db.prepare('SELECT * FROM "references" WHERE dhash IS NOT NULL');
    const rows = stmt.all() as any[];
    const results: Reference[] = [];

    for (const row of rows) {
      const rowDhash = hexToBigint(row.dhash);
      if (hammingDistance(dhash, rowDhash) <= maxHamming) {
        results.push(this.rowToReference(row));
      }
    }

    return results;
  }

  findBySourceRef(source: string, ref: string): Reference | undefined {
    const stmt = this.db.prepare(
      'SELECT * FROM "references" WHERE source = ? AND sourceRef = ?'
    );
    const row = stmt.get(source, ref) as any;
    return row ? this.rowToReference(row) : undefined;
  }

  listReferences(opts?: {
    status?: "active" | "discarded";
    familyId?: string;
    source?: string;
    limit?: number;
    offset?: number;
  }): Reference[] {
    let query = 'SELECT r.* FROM "references" r';
    const params: any[] = [];

    if (opts?.familyId) {
      query += ' INNER JOIN "family_members" fm ON r.id = fm.refId WHERE fm.familyId = ?';
      params.push(opts.familyId);
    } else {
      query += " WHERE 1=1";
    }

    if (opts?.status) {
      query += " AND r.status = ?";
      params.push(opts.status);
    }

    if (opts?.source) {
      query += " AND r.source = ?";
      params.push(opts.source);
    }

    query += " ORDER BY r.createdAt ASC";

    if (opts?.limit) {
      query += " LIMIT ?";
      params.push(opts.limit);
    }

    if (opts?.offset) {
      query += " OFFSET ?";
      params.push(opts.offset);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map((row) => this.rowToReference(row));
  }

  setReferenceStatus(id: string, status: "active" | "discarded"): void {
    const stmt = this.db.prepare('UPDATE "references" SET status = ? WHERE id = ?');
    const result = stmt.run(status, id);
    if ((result as any).changes === 0) {
      throw new Error(`Reference ${id} not found`);
    }
  }

  countReferences(): number {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM "references"');
    const row = stmt.get() as { count: number };
    return row.count;
  }

  // Embeddings
  putEmbedding(refId: string, model: string, vec: Float32Array): void {
    const refExists = this.db
      .prepare('SELECT 1 FROM "references" WHERE id = ?')
      .get(refId);
    if (!refExists) {
      throw new Error(`Reference ${refId} not found`);
    }

    const blob = float32ToBlob(vec);
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO "embeddings" (refId, model, vec) VALUES (?, ?, ?)'
    );
    stmt.run(refId, model, blob);
  }

  getEmbedding(refId: string, model = "default"): Float32Array | undefined {
    const stmt = this.db.prepare('SELECT vec FROM "embeddings" WHERE refId = ? AND model = ?');
    const row = stmt.get(refId, model) as { vec: Buffer } | undefined;
    return row ? blobToFloat32(row.vec) : undefined;
  }

  listEmbeddings(model: string): Array<{ refId: string; vec: Float32Array }> {
    const stmt = this.db.prepare('SELECT refId, vec FROM "embeddings" WHERE model = ?');
    const rows = stmt.all(model) as Array<{ refId: string; vec: Buffer }>;
    return rows.map((row) => ({
      refId: row.refId,
      vec: blobToFloat32(row.vec),
    }));
  }

  refsWithoutEmbedding(model: string): string[] {
    const stmt = this.db.prepare(`
      SELECT id FROM "references"
      WHERE id NOT IN (SELECT refId FROM "embeddings" WHERE model = ?)
    `);
    const rows = stmt.all(model) as Array<{ id: string }>;
    return rows.map((row) => row.id);
  }

  // Tags and palettes
  addTags(refId: string, tags: string[], origin: string): void {
    const refExists = this.db
      .prepare('SELECT 1 FROM "references" WHERE id = ?')
      .get(refId);
    if (!refExists) {
      throw new Error(`Reference ${refId} not found`);
    }

    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO "tags" (refId, tag, origin) VALUES (?, ?, ?)'
    );
    for (const tag of tags) {
      stmt.run(refId, tag, origin);
    }
  }

  getTags(refId: string): string[] {
    const stmt = this.db.prepare('SELECT tag FROM "tags" WHERE refId = ? ORDER BY tag');
    const rows = stmt.all(refId) as Array<{ tag: string }>;
    return rows.map((row) => row.tag);
  }

  putPalette(refId: string, entries: PaletteEntry[]): void {
    const refExists = this.db
      .prepare('SELECT 1 FROM "references" WHERE id = ?')
      .get(refId);
    if (!refExists) {
      throw new Error(`Reference ${refId} not found`);
    }

    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO "palettes" (refId, entries) VALUES (?, ?)'
    );
    stmt.run(refId, JSON.stringify(entries));
  }

  getPalette(refId: string): PaletteEntry[] | undefined {
    const stmt = this.db.prepare('SELECT entries FROM "palettes" WHERE refId = ?');
    const row = stmt.get(refId) as { entries: string } | undefined;
    return row ? JSON.parse(row.entries) : undefined;
  }

  // Families
  createFamily(family: Omit<Family, "id" | "createdAt" | "updatedAt">): Family {
    const id = generateId();
    const now = Date.now();

    const stmt = this.db.prepare(`
      INSERT INTO "families" (
        id, slug, name, status, mergedInto, descriptor, centroid, clusterRunId,
        proposedBy, createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const centroidBlob = family.centroid ? float32ToBlob(family.centroid) : null;
      stmt.run(
        id,
        family.slug || null,
        family.name,
        family.status,
        family.mergedInto || null,
        family.descriptor ? JSON.stringify(family.descriptor) : null,
        centroidBlob,
        family.clusterRunId || null,
        family.proposedBy,
        now,
        now
      );
    } catch (e) {
      if ((e as any).message?.includes("UNIQUE")) {
        throw new Error("Family slug already exists");
      }
      throw e;
    }

    return { ...family, id, createdAt: now, updatedAt: now };
  }

  updateFamily(id: string, patch: Partial<Omit<Family, "id" | "createdAt">>): void {
    const updates: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(patch)) {
      if (key === "id" || key === "createdAt") continue;

      if (key === "centroid") {
        updates.push("centroid = ?");
        params.push(value ? float32ToBlob(value as Float32Array) : null);
      } else if (key === "descriptor") {
        updates.push("descriptor = ?");
        params.push(value ? JSON.stringify(value) : null);
      } else {
        updates.push(`${key} = ?`);
        params.push(value ?? null);
      }
    }

    updates.push("updatedAt = ?");
    params.push(Date.now());
    params.push(id);

    try {
      const stmt = this.db.prepare(
        `UPDATE "families" SET ${updates.join(", ")} WHERE id = ?`
      );
      const result = stmt.run(...params);
      if ((result as any).changes === 0) {
        throw new Error(`Family ${id} not found`);
      }
    } catch (e) {
      if ((e as any).message?.includes("UNIQUE")) {
        throw new Error("Family slug already exists");
      }
      throw e;
    }
  }

  getFamily(id: string): Family | undefined {
    const stmt = this.db.prepare('SELECT * FROM "families" WHERE id = ?');
    const row = stmt.get(id) as any;
    return row ? this.rowToFamily(row) : undefined;
  }

  getFamilyBySlug(slug: string): Family | undefined {
    const stmt = this.db.prepare('SELECT * FROM "families" WHERE slug = ?');
    const row = stmt.get(slug) as any;
    return row ? this.rowToFamily(row) : undefined;
  }

  listFamilies(status?: Family["status"]): Family[] {
    let query = 'SELECT * FROM "families"';
    const params: any[] = [];

    if (status) {
      query += " WHERE status = ?";
      params.push(status);
    }

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map((row) => this.rowToFamily(row));
  }

  setMembers(familyId: string, members: FamilyMember[]): void {
    const familyExists = this.db
      .prepare('SELECT 1 FROM "families" WHERE id = ?')
      .get(familyId);
    if (!familyExists) {
      throw new Error(`Family ${familyId} not found`);
    }

    // Check all references exist
    for (const member of members) {
      const refExists = this.db
        .prepare('SELECT 1 FROM "references" WHERE id = ?')
        .get(member.refId);
      if (!refExists) {
        throw new Error(`Reference ${member.refId} not found`);
      }
    }

    this.transaction(() => {
      const delStmt = this.db.prepare('DELETE FROM "family_members" WHERE familyId = ?');
      delStmt.run(familyId);

      const insStmt = this.db.prepare(
        'INSERT INTO "family_members" (familyId, refId, distance, isExemplar) VALUES (?, ?, ?, ?)'
      );
      for (const member of members) {
        insStmt.run(familyId, member.refId, member.distance, member.isExemplar ? 1 : 0);
      }
    });
  }

  getMembers(familyId: string): FamilyMember[] {
    const stmt = this.db.prepare(
      'SELECT familyId, refId, distance, isExemplar FROM "family_members" WHERE familyId = ?'
    );
    const rows = stmt.all(familyId) as any[];
    return rows.map((row) => ({
      familyId: row.familyId,
      refId: row.refId,
      distance: row.distance,
      isExemplar: Boolean(row.isExemplar),
    }));
  }

  deleteProposedFamilies(clusterRunId?: string): void {
    let query = 'DELETE FROM "families" WHERE status = ?';
    const params: any[] = ["proposed"];

    if (clusterRunId) {
      query += " AND clusterRunId = ?";
      params.push(clusterRunId);
    }

    const stmt = this.db.prepare(query);
    stmt.run(...params);
  }

  // Imports and decisions
  beginImport(importer: string, kind: string, query: string): string {
    const id = generateId();
    const stmt = this.db.prepare(
      'INSERT INTO "imports" (id, importer, kind, query, startedAt) VALUES (?, ?, ?, ?, ?)'
    );
    stmt.run(id, importer, kind, query, Date.now());
    return id;
  }

  finishImport(id: string, stats: ImportRun["stats"]): void {
    const stmt = this.db.prepare(
      'UPDATE "imports" SET stats = ?, completedAt = ? WHERE id = ?'
    );
    const result = stmt.run(stats ? JSON.stringify(stats) : null, Date.now(), id);
    if ((result as any).changes === 0) {
      throw new Error(`Import ${id} not found`);
    }
  }

  listImports(limit = 100): ImportRun[] {
    const stmt = this.db.prepare(
      'SELECT * FROM "imports" ORDER BY startedAt DESC LIMIT ?'
    );
    const rows = stmt.all(limit) as any[];
    return rows.map((row) => this.rowToImport(row));
  }

  recordDecision(decision: Omit<Decision, "id" | "createdAt">): Decision {
    const id = generateId();
    const createdAt = Date.now();

    const stmt = this.db.prepare(
      'INSERT INTO "decisions" (id, familyId, action, payload, actor, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
    );
    stmt.run(
      id,
      decision.familyId,
      decision.action,
      JSON.stringify(decision.payload),
      decision.actor,
      createdAt
    );

    return { ...decision, id, createdAt };
  }

  listDecisions(familyId?: string): Decision[] {
    let query = 'SELECT * FROM "decisions"';
    const params: any[] = [];

    if (familyId) {
      query += " WHERE familyId = ?";
      params.push(familyId);
    }

    query += " ORDER BY createdAt DESC";

    const stmt = this.db.prepare(query);
    const rows = stmt.all(...params) as any[];
    return rows.map((row) => ({
      id: row.id,
      familyId: row.familyId,
      action: row.action,
      payload: JSON.parse(row.payload),
      actor: row.actor,
      createdAt: row.createdAt,
    }));
  }

  // Metadata
  getMeta(key: string): unknown {
    const stmt = this.db.prepare('SELECT value FROM "meta" WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row ? JSON.parse(row.value) : undefined;
  }

  setMeta(key: string, value: unknown): void {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO "meta" (key, value) VALUES (?, ?)'
    );
    stmt.run(key, JSON.stringify(value));
  }

  // Transactions
  transaction<T>(fn: () => T): T {
    try {
      this.db.exec("BEGIN");
      const result = fn();
      this.db.exec("COMMIT");
      return result;
    } catch (e) {
      this.db.exec("ROLLBACK");
      throw e;
    }
  }

  close(): void {
    this.db.close();
  }

  // Helpers
  private rowToReference(row: any): Reference {
    return {
      id: row.id,
      sha256: row.sha256,
      dhash: row.dhash !== null && row.dhash !== undefined ? hexToBigint(row.dhash) : null,
      source: row.source,
      sourceRef: row.sourceRef,
      pageUrl: row.pageUrl,
      imageUrl: row.imageUrl,
      author: row.author,
      license: row.license,
      originalPath: row.originalPath,
      previewPath: row.previewPath,
      width: row.width,
      height: row.height,
      bytes: row.bytes,
      meta: JSON.parse(row.meta),
      status: row.status,
      importId: row.importId,
      createdAt: row.createdAt,
    };
  }

  private rowToFamily(row: any): Family {
    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      status: row.status,
      mergedInto: row.mergedInto,
      descriptor: row.descriptor ? JSON.parse(row.descriptor) : undefined,
      centroid: row.centroid ? blobToFloat32(row.centroid) : undefined,
      clusterRunId: row.clusterRunId,
      proposedBy: row.proposedBy,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  private rowToImport(row: any): ImportRun {
    return {
      id: row.id,
      importer: row.importer,
      kind: row.kind,
      query: row.query,
      stats: row.stats ? JSON.parse(row.stats) : undefined,
      startedAt: row.startedAt,
      completedAt: row.completedAt,
    };
  }
}

export function openStore(path?: string): SqliteStore {
  const finalPath = path || (() => {
    try {
      const { getLibraryDbPath } = require("../core/paths");
      return getLibraryDbPath();
    } catch {
      throw new Error("Must provide path or call from nullume package");
    }
  })();

  const db = new DatabaseSync(finalPath);

  // Set file permissions to 0600 (owner read/write only)
  try {
    fs.chmodSync(finalPath, 0o600);
  } catch {
    // Ignore if already set or other permissions issues
  }

  return new SqliteStore(db);
}

export function openMemoryStore(): SqliteStore {
  const db = new DatabaseSync(":memory:");
  return new SqliteStore(db);
}
