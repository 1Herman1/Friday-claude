import { IncomingMessage, ServerResponse } from "node:http";
import { z } from "zod";
import { createReadStream, existsSync, statSync } from "node:fs";
import { resolve as resolvePath, isAbsolute } from "node:path";
import type { LibraryStore, Family, Decision, Reference } from "../store/types.js";
import type { NullumeConfig } from "../../core/config.js";
import type { Embedder } from "../embed/index.js";
import { searchLibrary } from "../search.js";
import { getEmbedder } from "../embed/index.js";
import { clusterLibrary } from "../cluster/index.js";
import { buildProposalContext, validateDescriptor } from "../families/index.js";
import { listImporters, getImporter } from "../importers/registry.js";
import { assertLocalOnlyAllowed, LOCAL_ONLY_WARNING } from "../importers/gate.js";
import { createIngestStore } from "../ingest/adapter.js";
import { ingest } from "../ingest/ingest.js";
import { UsageError } from "../../core/errors.js";
import { descriptorToPrompt } from "../families/descriptor.js";

interface DashboardFamilyDto {
  id: string;
  slug?: string;
  name: string;
  status: Family["status"];
  size: number;
  summary?: string;
  palette: string[];
  exemplars: Array<{ refId: string; previewUrl: string }>;
}

interface DashboardState {
  families: DashboardFamilyDto[];
  stats: {
    totalFamilies: number;
    totalReferences: number;
    byStatus: Record<string, number>;
  };
}

function parseJson(body: string): any {
  try { return JSON.parse(body); } catch { return null; }
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function buildFamilyDto(family: Family, store: LibraryStore, token: string): DashboardFamilyDto {
  const members = store.getMembers(family.id);
  const exemplars = members.filter((m) => m.isExemplar).slice(0, 8).map((m) => ({
    refId: m.refId,
    previewUrl: `/t/${token}/preview/${m.refId}`,
  }));

  const paletteHexes: string[] = [];
  if (family.descriptor && typeof family.descriptor === "object") {
    const descriptor = family.descriptor as Record<string, unknown>;
    if (Array.isArray(descriptor.palette)) {
      descriptor.palette.forEach((entry: any) => {
        if (entry && typeof entry === "object" && "r" in entry && "g" in entry && "b" in entry) {
          paletteHexes.push(rgbToHex(entry.r, entry.g, entry.b));
        }
      });
    }
  }

  const summary = family.descriptor && typeof family.descriptor === "object"
    ? (family.descriptor as Record<string, unknown>).summary
    : undefined;

  return {
    id: family.id,
    slug: family.slug,
    name: family.name,
    status: family.status,
    size: members.length,
    summary: summary ? String(summary) : undefined,
    palette: paletteHexes.slice(0, 8),
    exemplars,
  };
}

const MAX_BODY_BYTES = 1024 * 1024;

const dial = z.number().min(0).max(1);
/** Поля дескриптора, которые владелец правит из дашборда; остальное заполняет Claude */
const DescriptorPatchSchema = z
  .object({
    name: z.string().min(1).max(200),
    summary: z.string().max(300),
    mood: z.array(z.string().max(40)).max(20),
    dials: z.object({ visualDensity: dial, designVariance: dial, decorLevel: dial, symmetry: dial }).partial(),
    motion: z.object({ character: z.enum(["static", "calm", "snappy", "expressive"]) }).partial().passthrough(),
    spacing: z.object({ density: z.enum(["airy", "balanced", "dense"]) }).partial().passthrough(),
    prompt_fragment: z.string().max(600),
    negative_fragment: z.string().max(600),
  })
  .partial()
  .passthrough();

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        req.pause();
        reject(new UsageError("Тело запроса больше 1 МБ"));
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    req.on("error", reject);
  });
}

function shellQuote(value: string): string {
  return "'" + value.replace(/'/g, "'\\''") + "'";
}

function positiveInt(raw: unknown, fallback: number, max: number): number {
  const n = typeof raw === "string" ? Number(raw) : raw;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0) return fallback;
  return Math.min(n, max);
}

let importRunning = false;

export async function handleApi(
  store: LibraryStore,
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  pageHtml: string,
  nonce: string,
  doneResolve: (decisions: any[]) => void,
  token: string,
  config?: NullumeConfig,
  embedder?: Embedder | null
): Promise<void> {
  if (path === "/" && req.method === "GET") {
    const htmlWithNonce = pageHtml
      .replace(/nonce="[^"]*"/g, `nonce="${nonce}"`)
      .replace(/<script>/g, `<script nonce="${nonce}">`);

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; img-src 'self' data:; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'`,
    });
    res.end(htmlWithNonce);
    return;
  }

  if (path === "/state" && req.method === "GET") {
    const families = store.listFamilies();
    const familyDtos = families.map((f) => buildFamilyDto(f, store, token));
    const stats = {
      totalFamilies: families.length,
      totalReferences: store.countReferences(),
      byStatus: {
        proposed: families.filter((f) => f.status === "proposed").length,
        approved: families.filter((f) => f.status === "approved").length,
        discarded: families.filter((f) => f.status === "discarded").length,
        merged: families.filter((f) => f.status === "merged").length,
      },
    };
    const state: DashboardState = { families: familyDtos, stats };
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(state));
    return;
  }

  // POST /import
  if (path === "/import" && req.method === "POST") {
    if (importRunning) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Импорт уже выполняется" }));
      return;
    }
    importRunning = true;

    try {
    const body = await readBody(req);
    const payload = parseJson(body);

    if (!payload || typeof payload.source !== "string") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "source required" }));
      return;
    }

    const limit = Math.max(1, positiveInt(payload.limit, 30, 100));

      // Get importer (try clean first, then local-only)
      let importer;
      let kind: "clean" | "local-only" = "clean";
      try {
        importer = await getImporter(payload.source, "clean");
      } catch {
        kind = "local-only";
        importer = await getImporter(payload.source, kind);
        {
          try {
            assertLocalOnlyAllowed(config ?? { acknowledgedRiskyImporters: false }, process.env);
          } catch (e) {
            res.writeHead(403, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: (e as Error).message }));
            return;
          }
        }
      }

      // Configure importer
      if (config) {
        await importer.configure(config, process.env);
      }

      // Create ingest adapter
      const embedModelId = embedder?.model || (store.getMeta("embed_model") as string | undefined) || "default";
      const storeAdapter = createIngestStore(store, {
        embedModel: embedModelId,
        tagOrigin: "source",
      });

      let ingested = 0, dedup = 0, failed = 0;
      const results: Array<{ url?: string; status: string; reason?: string }> = [];

      // Run importer
      for await (const candidate of importer.run({
        query: payload.query as string | undefined,
        collection: payload.collection as string | undefined,
        limit,
        log: () => {},
        config: config || { acknowledgedRiskyImporters: false },
        env: process.env,
      })) {
        const ingestDeps = {
          store: storeAdapter,
          embedder: embedder ? { embedImage: (p: string) => embedder.embedImage(p) } : undefined,
          log: () => {},
        };

        const result = await ingest(candidate, ingestDeps);

        if (result.status === "ingested") ingested++;
        else if (result.status === "dedup") dedup++;
        else failed++;

        results.push({
          url: candidate.url,
          status: result.status,
          reason: result.reason,
        });
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ingested, dedup, failed, results }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    } finally {
      importRunning = false;
    }
    return;
  }

  // POST /add - ingest local files
  if (path === "/add" && req.method === "POST") {
    if (importRunning) {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Импорт уже выполняется" }));
      return;
    }
    importRunning = true;
    try {
    const body = await readBody(req);
    const payload = parseJson(body);

    if (!payload || !Array.isArray(payload.paths) || payload.paths.length > 200 || !payload.paths.every((x: unknown) => typeof x === "string")) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "paths: массив строк, не больше 200" }));
      return;
    }
    const allowedRoots = config?.library?.importDirs ?? [];

    const validExtensions = ["png", "jpg", "jpeg", "webp", "gif"];
    const results: Array<{ path: string; status: string; reason?: string; refId?: string }> = [];
    let ingested = 0, dedup = 0, failed = 0;

    try {
      const embedModelId = embedder?.model || (store.getMeta("embed_model") as string | undefined) || "default";
      const storeAdapter = createIngestStore(store, {
        embedModel: embedModelId,
        tagOrigin: "owner",
      });

      for (const p of payload.paths) {
        try {
          // Validate path is absolute
          if (!isAbsolute(p)) {
            results.push({ path: p, status: "failed", reason: "Path must be absolute" });
            failed++;
            continue;
          }

          // Validate file exists
          if (!existsSync(p)) {
            results.push({ path: p, status: "failed", reason: "File not found" });
            failed++;
            continue;
          }

          // Validate is regular file
          const stat = statSync(p);
          if (!stat.isFile()) {
            results.push({ path: p, status: "failed", reason: "Not a regular file" });
            failed++;
            continue;
          }

          // Validate extension
          const ext = p.split(".").pop()?.toLowerCase() || "";
          if (!validExtensions.includes(ext)) {
            results.push({ path: p, status: "failed", reason: `Invalid extension: ${ext}` });
            failed++;
            continue;
          }

          // Ingest
          const candidate = {
            filePath: p,
            source: "manual",
            sourceRef: p,
            meta: {},
            tags: [],
          };

          const ingestDeps = {
            store: storeAdapter,
            embedder: embedder ? { embedImage: (p: string) => embedder.embedImage(p) } : undefined,
            log: () => {},
            allowedRoots,
          };

          const result = await ingest(candidate, ingestDeps);

          if (result.status === "ingested") ingested++;
          else if (result.status === "dedup") dedup++;
          else failed++;

          results.push({
            path: p,
            status: result.status,
            reason: result.reason,
            refId: result.refId,
          });
        } catch (e) {
          results.push({
            path: p,
            status: "failed",
            reason: (e as Error).message,
          });
          failed++;
        }
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ingested, dedup, failed, results }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
    } finally {
      importRunning = false;
    }
    return;
  }

  // POST /cluster
  if (path === "/cluster" && req.method === "POST") {
    const body = await readBody(req);
    const payload = parseJson(body);

    try {
      const embedderToUse = embedder || await getEmbedder().catch(() => null);
      if (!embedderToUse) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Сначала nullume lib embed" }));
        return;
      }

      const result = clusterLibrary(store, {
        k: payload.k,
        model: embedderToUse.model,
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("Сначала")) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Сначала nullume lib embed" }));
      } else {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: msg }));
      }
    }
    return;
  }

  // GET /propose
  if (path === "/propose" && req.method === "GET") {
    try {
      const contexts = buildProposalContext(store);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(contexts));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
    return;
  }

  // GET /sources
  if (path === "/sources" && req.method === "GET") {
    try {
      const cfg = config ?? { acknowledgedRiskyImporters: false };
      const probe = async (kind: "clean" | "local-only") => {
        const list = await listImporters(kind);
        const out = [];
        for (const i of list) {
          let readiness: "ready" | "needs-config" = "ready";
          let reason: string | undefined;
          try {
            await i.configure(cfg, process.env);
          } catch (e) {
            readiness = "needs-config";
            reason = (e as Error).message;
          }
          out.push({ id: i.id, name: i.title, description: i.description, kind, readiness, reason });
        }
        return out;
      };
      const cleanImporters = await probe("clean");
      let gateReason: string | undefined;
      try {
        assertLocalOnlyAllowed(cfg, process.env);
      } catch (e) {
        gateReason = (e as Error).message;
      }
      const localImporters = (await probe("local-only")).map((i) =>
        gateReason ? { ...i, readiness: "gated" as const, reason: gateReason } : i
      );

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ cleanImporters, localImporters }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
    return;
  }

  if (path === "/decide" && req.method === "POST") {
    const body = await readBody(req);
    const payload = parseJson(body);

    if (!payload || !payload.familyId || !["approve", "rename", "merge", "discard"].includes(payload.action)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid request" }));
      return;
    }

    const family = store.getFamily(payload.familyId);
    if (!family) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Family not found" }));
      return;
    }

    const decision: Omit<Decision, "id" | "createdAt"> = {
      familyId: payload.familyId,
      action: payload.action,
      actor: "owner",
      payload: payload,
    };

    if (payload.action === "approve") {
      store.updateFamily(payload.familyId, { status: "approved" });
    } else if (payload.action === "rename") {
      if (!payload.name || !payload.slug) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "name and slug required" }));
        return;
      }
      store.updateFamily(payload.familyId, { name: payload.name, slug: payload.slug });
    } else if (payload.action === "merge") {
      if (!payload.mergeInto) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "mergeInto required" }));
        return;
      }
      const targetFamily = store.getFamily(payload.mergeInto);
      if (!targetFamily) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Target not found" }));
        return;
      }
      const members = store.getMembers(payload.familyId);
      const targetMembers = store.getMembers(payload.mergeInto);
      store.setMembers(payload.mergeInto, [...targetMembers, ...members]);
      store.updateFamily(payload.familyId, { status: "merged", mergedInto: payload.mergeInto });
    } else if (payload.action === "discard") {
      store.updateFamily(payload.familyId, { status: "discarded" });
    }

    store.recordDecision(decision);
    const updatedFamily = store.getFamily(payload.familyId)!;
    const dto = buildFamilyDto(updatedFamily, store, token);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(dto));
    return;
  }

  if (path.startsWith("/preview/") && req.method === "GET") {
    const refId = path.slice("/preview/".length);
    const ref = store.getReference(refId);

    if (!ref || !ref.previewPath) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    if (!existsSync(ref.previewPath)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "File not found" }));
      return;
    }

    res.writeHead(200, {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    });

    const stream = createReadStream(ref.previewPath);
    stream.pipe(res);
    return;
  }

  if (path === "/done" && req.method === "POST") {
    const decisions = store.listDecisions();
    doneResolve(decisions);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));

    setTimeout(() => {
      res.socket?.destroy();
    }, 100);
    return;
  }

  // GET /refs - list references with filters
  if (path === "/refs" && req.method === "GET") {
    try {
      const url = new URL(req.url || "/", "http://x");
      const source = url.searchParams.get("source") || undefined;
      const family = url.searchParams.get("family") || undefined;
      const q = url.searchParams.get("q") || undefined;
      const limit = Math.max(1, positiveInt(url.searchParams.get("limit") ?? "20", 20, 100));
      const offset = positiveInt(url.searchParams.get("offset") ?? "0", 0, 1_000_000);

      let items: Reference[] = [];
      if (q) {
        const hits = await searchLibrary(store, embedder ?? null, { text: q, limit: limit + offset });
        items = hits
          .slice(offset, offset + limit)
          .map((h) => store.getReference(h.refId))
          .filter((r) => !!r) as Reference[];
      } else {
        items = store.listReferences({
          status: "active",
          source: source || undefined,
          limit: limit + offset,
          offset: 0,
        });
        items = items.slice(offset, offset + limit);
      }

      if (family) {
        const fam = store.getFamilyBySlug(family);
        if (fam) {
          const memberIds = store.getMembers(fam.id).map((m) => m.refId);
          items = items.filter((r) => memberIds.includes(r.id));
        }
      }

      const allCount = store.countReferences();

      const responseItems = items.map((ref) => {
        const palette = store.getPalette(ref.id);
        const paletteHexes = palette
          ? palette.map((p) => rgbToHex(p.r, p.g, p.b))
          : [];
        const tags = store.getTags(ref.id);

        // Find families this ref belongs to
        const families = store
          .listFamilies()
          .filter((f) => store.getMembers(f.id).some((m) => m.refId === ref.id));

        return {
          id: ref.id,
          source: ref.source,
          sourceRef: ref.sourceRef,
          pageUrl: ref.pageUrl,
          author: ref.author,
          license: ref.license,
          width: ref.width,
          height: ref.height,
          previewUrl: `/t/${token}/preview/${ref.id}`,
          palette: paletteHexes,
          tags,
          familySlug: families.length > 0 ? families[0].slug : undefined,
        };
      });

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ items: responseItems, total: allCount }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
    return;
  }

  // GET /ref/:id - get single reference
  if (path.startsWith("/ref/") && !path.includes("/discard") && !path.includes("/tags") && req.method === "GET") {
    const refId = path.slice("/ref/".length);
    const ref = store.getReference(refId);

    if (!ref) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Reference not found" }));
      return;
    }

    const palette = store.getPalette(ref.id);
    const tags = store.getTags(ref.id);
    const families = store
      .listFamilies()
      .filter((f) => store.getMembers(f.id).some((m) => m.refId === ref.id));

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        id: ref.id,
        source: ref.source,
        sourceRef: ref.sourceRef,
        pageUrl: ref.pageUrl,
        author: ref.author,
        license: ref.license,
        width: ref.width,
        height: ref.height,
        bytes: ref.bytes,
        previewUrl: `/t/${token}/preview/${ref.id}`,
        palette,
        tags,
        families: families.map((f) => ({ id: f.id, name: f.name, slug: f.slug })),
      })
    );
    return;
  }

  // POST /ref/:id/discard
  if (path.startsWith("/ref/") && path.endsWith("/discard") && req.method === "POST") {
    const refId = path.replace("/ref/", "").replace("/discard", "");
    const ref = store.getReference(refId);

    if (!ref) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Reference not found" }));
      return;
    }

    store.setReferenceStatus(refId, "discarded");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // POST /ref/:id/tags
  if (path.startsWith("/ref/") && path.endsWith("/tags") && req.method === "POST") {
    const refId = path.replace("/ref/", "").replace("/tags", "");
    const body = await readBody(req);
    const payload = parseJson(body);

    if (!payload || !Array.isArray(payload.tags)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "tags array required" }));
      return;
    }

    const ref = store.getReference(refId);
    if (!ref) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Reference not found" }));
      return;
    }

    store.addTags(refId, (payload.tags as unknown[]).filter((t) => typeof t === "string").map((t) => (t as string).trim().slice(0, 40)).filter(Boolean).slice(0, 50), "owner");

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // GET /family/:id - get family with members
  if (path.startsWith("/family/") && !path.includes("/descriptor") && !path.includes("/exemplar") && req.method === "GET") {
    const familyId = path.slice("/family/".length);
    const family = store.getFamily(familyId);

    if (!family) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Family not found" }));
      return;
    }

    const members = store.getMembers(familyId);
    const membersInfo = members.map((m) => {
      const ref = store.getReference(m.refId);
      return {
        refId: m.refId,
        isExemplar: m.isExemplar,
        distance: m.distance,
        previewUrl: `/t/${token}/preview/${m.refId}`,
        sourceRef: ref?.sourceRef,
      };
    });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        id: family.id,
        name: family.name,
        slug: family.slug,
        status: family.status,
        descriptor: family.descriptor,
        members: membersInfo,
      })
    );
    return;
  }

  // POST /family/:id/descriptor - merge partial descriptor
  if (path.startsWith("/family/") && path.endsWith("/descriptor") && req.method === "POST") {
    const familyId = path.replace("/family/", "").replace("/descriptor", "");
    const body = await readBody(req);
    const payload = parseJson(body);

    const family = store.getFamily(familyId);
    if (!family) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Family not found" }));
      return;
    }

    // Merge with existing descriptor: only known fields
    if (!payload || typeof payload !== "object") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid request" }));
      return;
    }
    const ALLOWED = ["summary", "mood", "dials", "motion", "spacing", "prompt_fragment", "negative_fragment", "name"];
    const existing = (family.descriptor as Record<string, unknown>) || {};
    const merged: Record<string, unknown> = { ...existing };
    for (const key of ALLOWED) {
      if (!(key in payload)) continue;
      const value = payload[key];
      const prev = existing[key];
      merged[key] =
        value && typeof value === "object" && !Array.isArray(value) && prev && typeof prev === "object"
          ? { ...(prev as Record<string, unknown>), ...(value as Record<string, unknown>) }
          : value;
    }
    if (Array.isArray(merged.mood)) {
      merged.mood = (merged.mood as unknown[]).filter((m) => typeof m === "string").map((m) => (m as string).trim().slice(0, 40)).filter(Boolean).slice(0, 20);
    }
    const patchCheck = DescriptorPatchSchema.safeParse(merged);
    if (!patchCheck.success) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: patchCheck.error.issues.map((i) => `${i.path.join(".") || "root"}: ${i.message}`).join("; ") }));
      return;
    }

    // Only validate dials if they are provided (check range constraints)
    if (payload.dials) {
      const dials = payload.dials as Record<string, unknown>;
      for (const [key, value] of Object.entries(dials)) {
        if (typeof value === "number" && (value < 0 || value > 1)) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(
            JSON.stringify({
              error: `dials.${key} must be between 0 and 1, got ${value}`,
            })
          );
          return;
        }
      }
    }

    // Only validate spacing.density if provided
    if (payload.spacing?.density) {
      const density = payload.spacing.density;
      if (!["airy", "balanced", "dense"].includes(density)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: `spacing.density must be one of: airy, balanced, dense` }));
        return;
      }
    }

    // Only validate motion.character if provided
    if (payload.motion?.character) {
      const char = payload.motion.character;
      if (!["static", "calm", "snappy", "expressive"].includes(char)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({ error: `motion.character must be one of: static, calm, snappy, expressive` })
        );
        return;
      }
    }

    store.updateFamily(familyId, { descriptor: merged });

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // POST /family/:id/exemplar - update exemplar flag
  if (path.startsWith("/family/") && path.endsWith("/exemplar") && req.method === "POST") {
    const familyId = path.replace("/family/", "").replace("/exemplar", "");
    const body = await readBody(req);
    const payload = parseJson(body);

    if (!payload || typeof payload.refId !== "string" || typeof payload.isExemplar !== "boolean") {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "refId and isExemplar required" }));
      return;
    }

    const family = store.getFamily(familyId);
    if (!family) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Family not found" }));
      return;
    }

    const members = store.getMembers(familyId);
    const updated = members.map((m) =>
      m.refId === payload.refId ? { ...m, isExemplar: payload.isExemplar } : m
    );

    store.setMembers(familyId, updated);

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // GET /generate-command/:id - get generate command for family
  if (path.startsWith("/generate-command/") && req.method === "GET") {
    const familyId = path.slice("/generate-command/".length);
    const family = store.getFamily(familyId);

    if (!family) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Family not found" }));
      return;
    }

    if (!family.descriptor) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Family has no descriptor" }));
      return;
    }

    try {
      const descriptor = family.descriptor as any;
      const model = "nano-banana-2";

      // Build a simple prompt from descriptor fields, gracefully handling partial descriptors
      const promptFragment = descriptor.prompt_fragment || "";
      const moodText = descriptor.mood && descriptor.mood.length > 0
        ? `\nМасти: ${descriptor.mood.join(", ")}.`
        : "";
      const summary = descriptor.summary || family.name;
      const prompt = `${promptFragment}${moodText} Основное: ${summary}`.replace(/\s+/g, " ").trim();
      if (!family.slug || !/^[a-z0-9-]+$/.test(family.slug)) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "У семейства нет корректного slug (a-z, 0-9, дефис)" }));
        return;
      }

      const command = `nullume generate create ${model} --style ${family.slug} --prompt ${shellQuote(prompt)}`;

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ command }));
    } catch (e) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: (e as Error).message }));
    }
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}
