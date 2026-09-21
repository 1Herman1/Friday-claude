/**
 * Интерфейсы зависимостей для ingestion pipeline
 */

export interface IngestStore {
  findBySha(sha256: string): Promise<{ id: string } | null>;
  findBySourceRef(source: string, sourceRef: string): Promise<{ id: string } | null>;
  findByDhash(dhash: bigint, threshold: number): Promise<{ id: string }[]>;
  insertReference(data: {
    sha256: string;
    dhash: bigint;
    source: string;
    sourceRef: string;
    originalPath: string;
    previewPath?: string;
    width: number;
    height: number;
  }): Promise<{ id: string }>;
  putPalette(refId: string, palette: Array<[number, number, number, number]>): Promise<void>;
  addTags(refId: string, tags: string[]): Promise<void>;
  putEmbedding(refId: string, embedding: Float32Array): Promise<void>;
  listEmbeddings(): Promise<Array<{ refId: string; embedding: Float32Array }>>;
  transaction<T>(fn: (store: IngestStore) => Promise<T>): Promise<T>;
}

export interface EmbedderDeps {
  embedImage(path: string): Promise<Float32Array>;
}

export interface IngestDeps {
  store: IngestStore;
  embedder?: EmbedderDeps;
  fetchImpl?: typeof fetch;
  log: (msg: string) => void;
  allowedRoots?: string[];
}
