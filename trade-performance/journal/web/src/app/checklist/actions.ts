"use server";
import { redirect } from "next/navigation";
import { q } from "@/server/db";
import { tiltState } from "@/server/tilt";

const ORG = `(SELECT id FROM organizations WHERE slug = 'german')`;

export async function saveChecklist(fd: FormData) {
  const items = await q<{ code: string }>(`SELECT code FROM rules WHERE organization_id = ${ORG} AND kind = 'checklist' AND active AND deleted_at IS NULL`);
  const checked = new Set(fd.getAll("ck").map(String));
  const answers = Object.fromEntries(items.map((i) => [i.code, checked.has(i.code)]));
  const allOk = items.every((i) => checked.has(i.code));
  const st = await tiltState();
  const verdict = fd.get("skip") ? "skip" : allOk && st.verdict === "go" ? "go" : "pause";
  const base = String(fd.get("base") ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/USDT$/, "") || null;
  const side = fd.get("side") === "SHORT" ? "SHORT" : fd.get("side") === "LONG" ? "LONG" : null;
  const [r] = await q<{ id: string }>(`
    INSERT INTO checklist_runs (id, organization_id, user_id, base_asset, side, answers, all_ok, verdict, tilt_state, note)
    VALUES (gen_random_uuid(), ${ORG}, (SELECT id FROM users WHERE telegram_user_id = 7098788894), $1, $2::"TradeSide", $3, $4, $5, $6, $7)
    RETURNING id`, [base, side, JSON.stringify(answers), allOk, verdict, JSON.stringify(st), String(fd.get("note") ?? "").trim() || null]);
  redirect(`/checklist?run=${r.id}`);
}
