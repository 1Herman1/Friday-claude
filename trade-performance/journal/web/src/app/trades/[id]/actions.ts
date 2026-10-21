"use server";
import { revalidatePath } from "next/cache";
import { q } from "@/server/db";
import { saveImage } from "@/server/files";

const ORG = `(SELECT id FROM organizations WHERE slug = 'german')`;
const USER = `(SELECT id FROM users WHERE telegram_user_id = 7098788894)`;
const s = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : null);

export async function saveTrade(id: string, fd: FormData) {
  const conf = s(fd.get("confidence"));
  const plan = s(fd.get("followed_plan"));
  const stop = s(fd.get("planned_stop"));
  let playbookId: string | null = null;
  const pb = s(fd.get("playbook_new")) ?? s(fd.get("playbook"));
  if (pb) {
    const [p] = await q<{ id: string }>(`INSERT INTO playbooks (id, organization_id, user_id, name) VALUES (gen_random_uuid(), ${ORG}, ${USER}, $1)
      ON CONFLICT (organization_id, name) DO UPDATE SET deleted_at = NULL RETURNING id`, [pb]);
    playbookId = p.id;
  }
  await q(`UPDATE trades SET entry_reason = $2, emotion_before = $3, emotion_after = $4, confidence = $5,
             followed_plan = $6, planned_stop = $7, playbook_id = $8, updated_at = now() WHERE id = $1`,
    [id, s(fd.get("entry_reason")), s(fd.get("emotion_before")), s(fd.get("emotion_after")),
     conf ? Math.min(10, Math.max(1, Number(conf))) : null, plan === null ? null : plan === "yes",
     stop ? Number(stop.replace(",", ".")) : null, playbookId]);

  const tags = (s(fd.get("tags")) ?? "").split(",").map((x) => x.trim()).filter(Boolean);
  await q(`DELETE FROM trade_tags WHERE trade_id = $1`, [id]);
  for (const name of tags) {
    await q(`WITH g AS (INSERT INTO tags (id, organization_id, name) VALUES (gen_random_uuid(), ${ORG}, $2)
               ON CONFLICT (organization_id, name) DO UPDATE SET deleted_at = NULL RETURNING id)
             INSERT INTO trade_tags (trade_id, tag_id) SELECT $1, id FROM g ON CONFLICT DO NOTHING`, [id, name]);
  }
  // нарушенные правила
  // снятые галочки убираем, остальные не трогаем (сохраняется comment «auto: …» от детектора тильта)
  const checked = fd.getAll("violated").map(String).filter(Boolean);
  await q(`DELETE FROM trade_rule_violations WHERE trade_id = $1 AND NOT (rule_id = ANY($2::uuid[]))`, [id, checked]);
  for (const ruleId of checked) {
    await q(`INSERT INTO trade_rule_violations (trade_id, rule_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [id, ruleId]);
  }
  const note = s(fd.get("note"));
  if (note) {
    await q(`INSERT INTO notes (id, organization_id, user_id, trade_id, kind, channel, text, updated_at)
             VALUES (gen_random_uuid(), ${ORG}, ${USER}, $1, 'TEXT', 'WEB', $2, now())`, [id, note]);
  }
  revalidatePath(`/trades/${id}`);
}

export async function uploadShots(id: string, fd: FormData) {
  for (const f of fd.getAll("shots")) {
    if (f instanceof File && f.size > 0) await saveImage(f, id, ORG);
  }
  revalidatePath(`/trades/${id}`);
}

export async function removeShot(tradeId: string, attId: string) {
  await q(`UPDATE attachments SET deleted_at = now() WHERE id = $1 AND trade_id = $2`, [attId, tradeId]);
  revalidatePath(`/trades/${tradeId}`);
}
