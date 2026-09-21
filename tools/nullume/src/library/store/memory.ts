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

export class MemoryStore implements LibraryStore {
  private references = new Map<string, Reference>();
  private families = new Map<string, Family>();
  private familyMembers = new Map<string, FamilyMember[]>();
  private embeddings = new Map<string, Map<string, Float32Array>>();
  private tags = new Map<string, Set<string>>();
  private palettes = new Map<string, PaletteEntry[]>();
  private imports = new Map<string, ImportRun>();
  private decisions: Decision[] = [];
  private meta = new Map<string, unknown>();
  private familySlugs = new Map<string, string>();

  // References
  insertReference(ref: NewReference): Reference {
    const id = generateId();
    const createdAt = Date.now();
    const full: Reference = { ...ref, id, createdAt };

    // Check uniqueness
    for (const existing of this.references.values()) {
      if (existing.sha256 === ref.sha256) {
        throw new Error(`Reference with sha256 ${ref.sha256} already exists`);
      }
      if (existing.source === ref.source && existing.sourceRef === ref.sourceRef) {
        throw new Error(
          `Reference with source=${ref.source} sourceRef=${ref.sourceRef} already exists`
        );
      }
    }

    this.references.set(id, full);
    return full;
  }

  getReference(id: string): Reference | undefined {
    return this.references.get(id);
  }

  findBySha256(sha: string): Reference | undefined {
    for (const ref of this.references.values()) {
      if (ref.sha256 === sha) {
        return ref;
      }
    }
    return undefined;
  }

  findByDhash(dhash: bigint, maxHamming = 6): Reference[] {
    const results: Reference[] = [];
    for (const ref of this.references.values()) {
      if (ref.dhash !== undefined && ref.dhash !== null) {
        if (hammingDistance(dhash, ref.dhash) <= maxHamming) {
          results.push(ref);
        }
      }
    }
    return results;
  }

  findBySourceRef(source: string, ref: string): Reference | undefined {
    for (const r of this.references.values()) {
      if (r.source === source && r.sourceRef === ref) {
        return r;
      }
    }
    return undefined;
  }

  listReferences(opts?: {
    status?: "active" | "discarded";
    familyId?: string;
    source?: string;
    limit?: number;
    offset?: number;
  }): Reference[] {
    let results = Array.from(this.references.values());

    if (opts?.status) {
      results = results.filter((r) => r.status === opts.status);
    }

    if (opts?.source) {
      results = results.filter((r) => r.source === opts.source);
    }

    if (opts?.familyId) {
      const members = this.familyMembers.get(opts.familyId) || [];
      const refIds = new Set(members.map((m) => m.refId));
      results = results.filter((r) => refIds.has(r.id));
    }

    results.sort((a, b) => a.createdAt - b.createdAt);

    const offset = opts?.offset || 0;
    const limit = opts?.limit || Infinity;
    return results.slice(offset, offset + limit);
  }

  setReferenceStatus(id: string, status: "active" | "discarded"): void {
    const ref = this.references.get(id);
    if (!ref) throw new Error(`Reference ${id} not found`);
    ref.status = status;
  }

  countReferences(): number {
    return this.references.size;
  }

  // Embeddings
  putEmbedding(refId: string, model: string, vec: Float32Array): void {
    if (!this.references.has(refId)) {
      throw new Error(`Reference ${refId} not found`);
    }
    if (!this.embeddings.has(refId)) {
      this.embeddings.set(refId, new Map());
    }
    this.embeddings.get(refId)!.set(model, new Float32Array(vec));
  }

  getEmbedding(refId: string, model = "default"): Float32Array | undefined {
    return this.embeddings.get(refId)?.get(model);
  }

  listEmbeddings(model: string): Array<{ refId: string; vec: Float32Array }> {
    const results: Array<{ refId: string; vec: Float32Array }> = [];
    for (const [refId, models] of this.embeddings) {
      if (models.has(model)) {
        results.push({ refId, vec: models.get(model)! });
      }
    }
    return results;
  }

  refsWithoutEmbedding(model: string): string[] {
    const results: string[] = [];
    for (const refId of this.references.keys()) {
      const vec = this.embeddings.get(refId)?.get(model);
      if (!vec) {
        results.push(refId);
      }
    }
    return results;
  }

  // Tags and palettes
  addTags(refId: string, tags: string[], origin: string): void {
    if (!this.references.has(refId)) {
      throw new Error(`Reference ${refId} not found`);
    }
    if (!this.tags.has(refId)) {
      this.tags.set(refId, new Set());
    }
    for (const tag of tags) {
      this.tags.get(refId)!.add(tag);
    }
  }

  getTags(refId: string): string[] {
    const tagSet = this.tags.get(refId);
    return tagSet ? Array.from(tagSet) : [];
  }

  putPalette(refId: string, entries: PaletteEntry[]): void {
    if (!this.references.has(refId)) {
      throw new Error(`Reference ${refId} not found`);
    }
    this.palettes.set(refId, entries);
  }

  getPalette(refId: string): PaletteEntry[] | undefined {
    return this.palettes.get(refId);
  }

  // Families
  createFamily(family: Omit<Family, "id" | "createdAt" | "updatedAt">): Family {
    const id = generateId();
    const now = Date.now();
    const full: Family = { ...family, id, createdAt: now, updatedAt: now };

    if (family.slug && this.familySlugs.has(family.slug)) {
      throw new Error(`Family slug ${family.slug} already exists`);
    }

    this.families.set(id, full);
    if (family.slug) {
      this.familySlugs.set(family.slug, id);
    }
    return full;
  }

  updateFamily(id: string, patch: Partial<Omit<Family, "id" | "createdAt">>): void {
    const family = this.families.get(id);
    if (!family) throw new Error(`Family ${id} not found`);

    const oldSlug = family.slug;
    const newSlug = patch.slug;

    if (newSlug && newSlug !== oldSlug && this.familySlugs.has(newSlug)) {
      throw new Error(`Family slug ${newSlug} already exists`);
    }

    Object.assign(family, patch, { updatedAt: Date.now() });

    if (oldSlug) {
      this.familySlugs.delete(oldSlug);
    }
    if (newSlug) {
      this.familySlugs.set(newSlug, id);
    }
  }

  getFamily(id: string): Family | undefined {
    return this.families.get(id);
  }

  getFamilyBySlug(slug: string): Family | undefined {
    const id = this.familySlugs.get(slug);
    return id ? this.families.get(id) : undefined;
  }

  listFamilies(status?: Family["status"]): Family[] {
    let results = Array.from(this.families.values());
    if (status) {
      results = results.filter((f) => f.status === status);
    }
    return results;
  }

  setMembers(familyId: string, members: FamilyMember[]): void {
    if (!this.families.has(familyId)) {
      throw new Error(`Family ${familyId} not found`);
    }
    for (const member of members) {
      if (!this.references.has(member.refId)) {
        throw new Error(`Reference ${member.refId} not found`);
      }
    }
    this.familyMembers.set(familyId, members);
  }

  getMembers(familyId: string): FamilyMember[] {
    return this.familyMembers.get(familyId) || [];
  }

  deleteProposedFamilies(opts?: { clusterRunId?: string; proposedBy?: "cluster" | "claude" }): void {
    const toDelete: string[] = [];
    const proposedByFilter = opts?.proposedBy || "cluster";

    for (const [id, family] of this.families) {
      if (family.status === "proposed" && family.proposedBy === proposedByFilter) {
        if (!opts?.clusterRunId || family.clusterRunId === opts.clusterRunId) {
          toDelete.push(id);
        }
      }
    }

    for (const id of toDelete) {
      const family = this.families.get(id);
      if (family?.slug) {
        this.familySlugs.delete(family.slug);
      }
      this.families.delete(id);
      this.familyMembers.delete(id);
    }
  }

  // Imports and decisions
  beginImport(importer: string, kind: string, query: string): string {
    const id = generateId();
    const run: ImportRun = {
      id,
      importer,
      kind,
      query,
      startedAt: Date.now(),
    };
    this.imports.set(id, run);
    return id;
  }

  finishImport(id: string, stats: ImportRun["stats"]): void {
    const run = this.imports.get(id);
    if (!run) throw new Error(`Import ${id} not found`);
    run.stats = stats;
    run.completedAt = Date.now();
  }

  listImports(limit = 100): ImportRun[] {
    return Array.from(this.imports.values())
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  }

  recordDecision(decision: Omit<Decision, "id" | "createdAt">): Decision {
    const id = generateId();
    const full: Decision = { ...decision, id, createdAt: Date.now() };
    this.decisions.push(full);
    return full;
  }

  listDecisions(familyId?: string): Decision[] {
    if (familyId) {
      return this.decisions.filter((d) => d.familyId === familyId);
    }
    return this.decisions;
  }

  // Metadata
  getMeta(key: string): unknown {
    return this.meta.get(key);
  }

  setMeta(key: string, value: unknown): void {
    this.meta.set(key, value);
  }

  // Transactions
  transaction<T>(fn: () => T): T {
    // In-memory store doesn't need actual transactions, just execute
    return fn();
  }

  close(): void {
    // No-op for in-memory
  }
}

export function openMemoryStore(): MemoryStore {
  return new MemoryStore();
}
