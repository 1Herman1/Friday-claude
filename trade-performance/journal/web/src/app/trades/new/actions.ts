"use server";
import { redirect } from "next/navigation";
import { q } from "@/server/db";

const ORG = `(SELECT id FROM organizations WHERE slug = 'german')`;
const s = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() ? v.trim() : null);
const n = (v: FormDataEntryValue | null) => { const x = s(v); return x === null ? null : Number(x.replace(",", ".")); };
// datetime-local приходит без зоны — это время МСК
const msk = (v: string | null) => (v ? new Date(`${v}:00+03:00`) : null);

export async function createTrade(fd: FormData) {
  const account = s(fd.get("account"))!;
  const base = s(fd.get("base"))!.toUpperCase().replace(/[^A-Z0-9]/g, "").replace(/USDT$/, "");
  const side = s(fd.get("side")) === "SHORT" ? "SHORT" : "LONG";
  const entry = n(fd.get("entry"))!, exit = n(fd.get("exit")), qty = n(fd.get("qty"))!;
  const fees = n(fd.get("fees")) ?? 0, funding = n(fd.get("funding")) ?? 0;
  const opened = msk(s(fd.get("opened_at")))!, closed = msk(s(fd.get("closed_at")));
  if (!base || !entry || !qty || !opened) throw new Error("монета, вход, объём и время входа обязательны");
  const gross = exit === null ? 0 : (exit - entry) * qty * (side === "LONG" ? 1 : -1);
  const closedOk = exit !== null && closed !== null;

  // инструмент на площадке счёта (создаём, если такого ещё не было)
  const [inst] = await q<{ id: string }>(`
    WITH a AS (SELECT venue_id FROM accounts WHERE id = $1),
         k AS (SELECT coalesce((SELECT i.kind FROM instruments i, a WHERE i.venue_id = a.venue_id LIMIT 1), 'PERPETUAL'::"InstrumentKind") AS kind),
         ins AS (INSERT INTO instruments (id, venue_id, symbol, kind, base_asset, quote_asset, settle_asset, updated_at)
                 SELECT gen_random_uuid(), a.venue_id, $2 || 'USDT', k.kind, $2, 'USDT', 'USDT', now() FROM a, k
                 ON CONFLICT (venue_id, symbol, kind) DO NOTHING RETURNING id)
    SELECT id FROM ins UNION ALL SELECT i.id FROM instruments i, a WHERE i.venue_id = a.venue_id AND i.symbol = $2 || 'USDT' LIMIT 1`,
    [account, base]);
  const [t] = await q<{ id: string }>(`
    INSERT INTO trades (id, organization_id, account_id, instrument_id, executor, origin, status, side, opened_at, closed_at,
      stop_is_liquidation, max_qty, entry_avg, exit_avg, pnl_asset, gross_pnl, fees, funding, net_pnl, net_pnl_usd,
      planned_stop, entry_reason, external_position_id, updated_at)
    VALUES (gen_random_uuid(), ${ORG}, $1, $2, 'HUMAN', 'MANUAL', $3, $4, $5, $6, $7, $8, $9, $10, 'USDT', $11, $12, $13,
      $11::numeric - $12::numeric + $13::numeric, $11::numeric - $12::numeric + $13::numeric, $14, $15, 'manual:' || gen_random_uuid(), now()) RETURNING id`,
    [account, inst.id, closedOk ? "CLOSED" : "OPEN", side, opened, closedOk ? closed : null, fd.get("liq") === "on",
     qty, entry, exit, gross, fees, funding, n(fd.get("planned_stop")), s(fd.get("entry_reason"))]);
  redirect(`/trades/${t.id}`);
}
