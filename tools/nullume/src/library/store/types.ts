/**
 * Domain types for the taste library storage layer
 */

export interface Reference {
  id: string;
  sha256: string;
  dhash?: bigint | null;
  source: string;
  sourceRef: string;
  pageUrl?: string;
  imageUrl?: string;
  author?: string;
  license?: string;
  originalPath: string;
  previewPath?: string;
  width: number;
  height: number;
  bytes: number;
  meta: Record<string, unknown>;
  status: "active" | "discarded";
  importId?: string;
  createdAt: number; // unix ms
}

export type NewReference = Omit<Reference, "id" | "createdAt">;

export interface Family {
  id: string;
  slug?: string;
  name: string;
  status: "proposed" | "approved" | "discarded" | "merged";
  mergedInto?: string;
  descriptor?: unknown;
  centroid?: Float32Array;
  clusterRunId?: string;
  proposedBy: "cluster" | "claude" | "owner";
  createdAt: number;
  updatedAt: number;
}

export interface FamilyMember {
  familyId: string;
  refId: string;
  distance: number;
  isExemplar: boolean;
}

export interface ImportRun {
  id: string;
  importer: string;
  kind: string;
  query: string;
  stats?: {
    count: number;
    skipped: number;
    errors: number;
  };
  startedAt: number;
  completedAt?: number;
}

export interface Decision {
  id: string;
  familyId: string;
  action: "approve" | "rename" | "merge" | "discard";
  payload: Record<string, unknown>;
  actor: "owner";
  createdAt: number;
}

export interface PaletteEntry {
  r: number;
  g: number;
  b: number;
  ratio: number;
}

export interface LibraryStore {
  // References
  insertReference(ref: NewReference): Reference;
  getReference(id: string): Reference | undefined;
  findBySha256(sha: string): Reference | undefined;
  findByDhash(dhash: bigint, maxHamming?: number): Reference[];
  findBySourceRef(source: string, ref: string): Reference | undefined;
  listReferences(opts?: {
    status?: "active" | "discarded";
    familyId?: string;
    source?: string;
    limit?: number;
    offset?: number;
  }): Reference[];
  setReferenceStatus(id: string, status: "active" | "discarded"): void;
  countReferences(): number;

  // Embeddings
  putEmbedding(refId: string, model: string, vec: Float32Array): void;
  getEmbedding(refId: string, model?: string): Float32Array | undefined;
  listEmbeddings(model: string): Array<{ refId: string; vec: Float32Array }>;
  refsWithoutEmbedding(model: string): string[];

  // Tags and palettes
  addTags(refId: string, tags: string[], origin: string): void;
  getTags(refId: string): string[];
  putPalette(refId: string, entries: PaletteEntry[]): void;
  getPalette(refId: string): PaletteEntry[] | undefined;

  // Families
  createFamily(family: Omit<Family, "id" | "createdAt" | "updatedAt">): Family;
  updateFamily(id: string, patch: Partial<Omit<Family, "id" | "createdAt">>): void;
  getFamily(id: string): Family | undefined;
  getFamilyBySlug(slug: string): Family | undefined;
  listFamilies(status?: Family["status"]): Family[];
  setMembers(familyId: string, members: FamilyMember[]): void;
  getMembers(familyId: string): FamilyMember[];
  deleteProposedFamilies(clusterRunId?: string): void;

  // Imports and decisions
  beginImport(importer: string, kind: string, query: string): string;
  finishImport(id: string, stats: ImportRun["stats"]): void;
  listImports(limit?: number): ImportRun[];
  recordDecision(decision: Omit<Decision, "id" | "createdAt">): Decision;
  listDecisions(familyId?: string): Decision[];

  // Metadata
  getMeta(key: string): unknown;
  setMeta(key: string, value: unknown): void;

  // Transactions
  transaction<T>(fn: () => T): T;

  // Close
  close(): void;
}
