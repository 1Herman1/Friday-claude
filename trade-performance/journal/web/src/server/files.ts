import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import crypto from "node:crypto";
import { q } from "./db";

// файлы лежат только на Mac: journal/data/attachments/<sha256[:2]>/<sha256>.<ext> (data/ в .gitignore)
export const ATT_DIR = path.resolve(process.cwd(), "../data/attachments");
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

export async function saveImage(file: File, tradeId: string, org: string) {
  if (!EXT[file.type]) throw new Error("только png/jpg/webp/gif");
  const buf = Buffer.from(await file.arrayBuffer());
  const sha = crypto.createHash("sha256").update(buf).digest("hex");
  const key = `${sha.slice(0, 2)}/${sha}.${EXT[file.type]}`;
  await fs.mkdir(path.join(ATT_DIR, sha.slice(0, 2)), { recursive: true });
  await fs.writeFile(path.join(ATT_DIR, key), buf);
  // один и тот же файл к одной сделке — один раз
  const [dup] = await q<{ id: string }>(`SELECT id FROM attachments WHERE sha256 = $1 AND trade_id = $2 AND deleted_at IS NULL`, [sha, tradeId]);
  if (dup) return dup.id;
  const [a] = await q<{ id: string }>(`INSERT INTO attachments (id, organization_id, kind, storage_key, mime, size_bytes, sha256, trade_id)
    VALUES (gen_random_uuid(), ${org}, 'SCREENSHOT', $1 || '#' || gen_random_uuid(), $2, $3, $4, $5) RETURNING id`,
    [key, file.type, buf.length, sha, tradeId]);
  return a.id;
}
