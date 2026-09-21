import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";
import type { LibraryStore } from "../store/types.js";
import type { NullumeConfig } from "../../core/config.js";
import type { Embedder } from "../embed/index.js";
import { handleApi } from "./api.js";
import { UsageError } from "../../core/errors.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface DashboardOptions {
  host?: string;
  port?: number;
  idleMs?: number;
  onDone?: (decisions: any[]) => void;
  config?: NullumeConfig;
  embedder?: Embedder | null;
}

export interface DashboardServer {
  url: string;
  port: number;
  token: string;
  close(): Promise<void>;
  done: Promise<any[]>;
}

export async function startDashboard(
  store: LibraryStore,
  options: DashboardOptions = {}
): Promise<DashboardServer> {
  const host = options.host ?? "127.0.0.1";
  const idleMs = options.idleMs ?? 30 * 60 * 1000;
  const token = randomBytes(24).toString("base64url");

  // Load page.html
  let pageHtml: string;
  try {
    // Try dist first (production build)
    pageHtml = readFileSync(
      join(__dirname, "..", "..", "..", "..", "dist/library/dashboard/page.html"),
      "utf-8"
    );
  } catch {
    // Fall back to src (development)
    pageHtml = readFileSync(
      join(__dirname, "page.html"),
      "utf-8"
    );
  }

  let doneResolve: (decisions: any[]) => void;
  let doneReject: (err: Error) => void;
  const donePromise = new Promise<any[]>((resolve, reject) => {
    doneResolve = resolve;
    doneReject = reject;
  });

  let idleTimer: NodeJS.Timeout | null = null;

  function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      server.close();
    }, idleMs);
  }

  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    resetIdleTimer();

    const url = new URL(req.url || "/", `http://${req.headers.host}`);
    const pathname = url.pathname;

    // Check Host header
    const hostHeader = req.headers.host;
    const addr = server.address();
    const port = addr && typeof addr === "object" ? addr.port : 0;
    if (port === 0) {
      res.writeHead(500);
      res.end("Server not ready");
      return;
    }
    const expectedHost = `${host}:${port}`;
    if (hostHeader !== expectedHost && hostHeader !== `127.0.0.1:${port}`) {
      res.writeHead(403, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Forbidden: invalid Host" }));
      return;
    }

    // Token validation
    const tokenMatch = pathname.match(/^\/t\/([^/]+)\//);
    const presented = tokenMatch ? Buffer.from(tokenMatch[1]) : Buffer.alloc(0);
    const expected = Buffer.from(token);
    if (!tokenMatch || presented.length !== expected.length || !timingSafeEqual(presented, expected)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not Found" }));
      return;
    }

    const apiPath = pathname.slice(tokenMatch[0].length - 1); // /<rest>

    // CORS check for POST
    if (req.method === "POST") {
      const origin = req.headers.origin;
      const fetchSite = req.headers["sec-fetch-site"];
      const requestedWith = req.headers["x-requested-with"];

      // Same-origin check: origin must match or sec-fetch-site must be same-origin
      const isSameOrigin =
        !origin || origin === `http://${hostHeader}` || fetchSite === "same-origin";

      if (!isSameOrigin && !requestedWith) {
        res.writeHead(403, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Forbidden: CORS check failed" }));
        return;
      }
    }

    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cache-Control", "no-store");

    // Generate nonce for CSP
    const nonce = randomBytes(16).toString("base64");

    try {
      await handleApi(store, req, res, apiPath, pageHtml, nonce, doneResolve, token, options.config, options.embedder);
    } catch (err) {
      if (err instanceof UsageError) {
        const tooLarge = err.message.includes("1 МБ");
        res.writeHead(tooLarge ? 413 : 400, { "Content-Type": "application/json", Connection: "close" });
        res.end(JSON.stringify({ error: err.message }), () => {
          if (tooLarge) req.destroy();
        });
        return;
      }
      console.error("Dashboard error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal Server Error" }));
    }
  });

  return new Promise((resolve, reject) => {
    server.listen(options.port ?? 0, host, () => {
      const addr = server.address();
      if (!addr || typeof addr === "string") {
        reject(new Error("Failed to get server address"));
        return;
      }

      const port = addr.port;
      const url = `http://${host}:${port}/t/${token}/`;

      resolve({
        url,
        port,
        token,
        close: () =>
          new Promise<void>((res) => {
            if (idleTimer) clearTimeout(idleTimer);
            server.close(() => res());
          }),
        done: donePromise,
      });
    });

    server.on("error", reject);
  });
}
