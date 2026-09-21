import { IncomingMessage, ServerResponse } from "node:http";
import { createReadStream, existsSync } from "node:fs";
import type { LibraryStore, Family, Decision } from "../store/types.js";

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
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}

function buildFamilyDto(
  family: Family,
  store: LibraryStore,
  token: string
): DashboardFamilyDto {
  const members = store.getMembers(family.id);
  const exemplars = members
    .filter((m) => m.isExemplar)
    .slice(0, 8)
    .map((m) => ({
      refId: m.refId,
      previewUrl: `/t/${token}/preview/${m.refId}`,
    }));

  // Aggregate palette from members
  const paletteHexes: string[] = [];
  if (family.descriptor && typeof family.descriptor === "object") {
    const descriptor = family.descriptor as Record<string, unknown>;
    if (Array.isArray(descriptor.palette)) {
      descriptor.palette.forEach((entry: any) => {
        if (entry && typeof entry === "object" && "r" in entry && "g" in entry && "b" in entry) {
          const hex = rgbToHex(entry.r, entry.g, entry.b);
          paletteHexes.push(hex);
        }
      });
    }
  }

  const summary =
    family.descriptor && typeof family.descriptor === "object"
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

async function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

export async function handleApi(
  store: LibraryStore,
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  pageHtml: string,
  nonce: string,
  doneResolve: (decisions: any[]) => void,
  token: string
): Promise<void> {
  if (path === "/" && req.method === "GET") {
    // Serve page with CSP
    const htmlWithNonce = pageHtml
      .replace(/nonce="[^"]*"/g, `nonce="${nonce}"`)
      .replace(/<script>/g, `<script nonce="${nonce}">`);

    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": `default-src 'none'; img-src 'self'; script-src 'nonce-${nonce}'; style-src 'nonce-${nonce}'; connect-src 'self'`,
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

    const state: DashboardState = {
      families: familyDtos,
      stats,
    };

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(state));
    return;
  }

  if (path === "/decide" && req.method === "POST") {
    const body = await readBody(req);
    const payload = parseJson(body);

    if (
      !payload ||
      !payload.familyId ||
      !["approve", "rename", "merge", "discard"].includes(payload.action)
    ) {
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
        res.end(JSON.stringify({ error: "name and slug required for rename" }));
        return;
      }
      store.updateFamily(payload.familyId, { name: payload.name, slug: payload.slug });
    } else if (payload.action === "merge") {
      if (!payload.mergeInto) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "mergeInto required for merge" }));
        return;
      }
      const targetFamily = store.getFamily(payload.mergeInto);
      if (!targetFamily) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Target family not found" }));
        return;
      }
      // Move members to target family
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

    // Security: previewPath is from store, not user input
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

    // Close server after response sent
    setTimeout(() => {
      res.socket?.destroy();
    }, 100);
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
}
