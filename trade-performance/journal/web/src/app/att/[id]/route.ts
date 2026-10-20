import path from "node:path";
import fs from "node:fs/promises";
import { q } from "@/server/db";
import { ATT_DIR } from "@/server/files";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [a] = await q<{ storage_key: string; mime: string }>(`SELECT storage_key, mime FROM attachments WHERE id = $1 AND deleted_at IS NULL`, [id]);
  if (!a) return new Response("not found", { status: 404 });
  const file = path.join(ATT_DIR, a.storage_key.split("#")[0]);
  if (!file.startsWith(ATT_DIR)) return new Response("bad", { status: 400 });
  const buf = await fs.readFile(file);
  return new Response(new Uint8Array(buf), { headers: { "content-type": a.mime, "cache-control": "private, max-age=86400" } });
}
