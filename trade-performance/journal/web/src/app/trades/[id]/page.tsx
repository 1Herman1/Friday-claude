import Link from "next/link";
import { notFound } from "next/navigation";
import { tradeCard, candles, excursions, EMOTIONS } from "@/server/trade";
import { usd, px, dt, num, pnlClass } from "@/lib/fmt";
import TradeChart from "@/components/TradeChart";
import { saveTrade, uploadShots, removeShot } from "./actions";

export const dynamic = "force-dynamic";
const STEP: Record<string, number> = { Min5: 300, Min15: 900, Min60: 3600, Hour4: 14400 };
const IV: Record<string, string> = { Min5: "5м", Min15: "15м", Min60: "1ч", Hour4: "4ч" };

function Row({ k, v, cls }: { k: string; v: React.ReactNode; cls?: string }) {
  return <div className="flex justify-between gap-4 py-1 text-sm"><span className="text-zinc-400">{k}</span><span className={`tabular-nums ${cls ?? ""}`}>{v}</span></div>;
}

export default async function TradePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const card = await tradeCard(id);
  if (!card) notFound();
  const { t, fills, notes, tags, playbooks, rules, shots, reviews, signal } = card;
  const c = await candles(t.symbol, new Date(t.opened_at), t.closed_at ? new Date(t.closed_at) : null);
  const ex = excursions(c.data, t.side, Number(t.entry_avg), new Date(t.opened_at), t.closed_at ? new Date(t.closed_at) : null);
  const durH = ((t.closed_at ? new Date(t.closed_at).getTime() : Date.now()) - new Date(t.opened_at).getTime()) / 3600e3;
  const notional = Number(t.entry_avg) * Number(t.max_qty);
  const stopPct = t.planned_stop ? (Math.abs(Number(t.entry_avg) - Number(t.planned_stop)) / Number(t.entry_avg)) * 100 : null;
  const action = saveTrade.bind(null, t.id);
  const inp = "w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/trades" className="text-sm text-zinc-400 hover:text-zinc-200">← сделки</Link>
        <h1 className="text-xl font-semibold">#{t.n} · {t.base} <span className={t.side === "LONG" ? "text-emerald-400" : "text-rose-400"}>{t.side === "LONG" ? "Лонг" : "Шорт"}</span></h1>
        <span className={`text-xl font-semibold tabular-nums ${pnlClass(t.net_pnl)}`}>{usd(t.net_pnl)}</span>
        {t.liq && <span className="rounded bg-rose-900/60 px-2 py-0.5 text-xs text-rose-200">💀 ликвидация</span>}
        {t.status === "OPEN" && <span className="rounded bg-sky-900/60 px-2 py-0.5 text-xs text-sky-200">открыта</span>}
        <div className="ml-auto flex gap-3 text-sm">
          {t.prev_id && <Link href={`/trades/${t.prev_id}`} className="text-zinc-400 hover:text-zinc-200">← пред.</Link>}
          {t.next_id && <Link href={`/trades/${t.next_id}`} className="text-zinc-400 hover:text-zinc-200">след. →</Link>}
        </div>
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
        <div className="mb-1 text-xs text-zinc-500">{t.symbol} · MEXC · {IV[c.interval]} · время МСК</div>
        <TradeChart candles={c.data} step={STEP[c.interval]} entry={Number(t.entry_avg)} exit={t.exit_avg ? Number(t.exit_avg) : null}
          stop={t.planned_stop ? Number(t.planned_stop) : null}
          fills={fills.map((f) => ({ t: Math.floor(new Date(f.executed_at).getTime() / 1000), price: Number(f.price), qty: Number(f.qty),
            open: (f.side === "BUY") === (f.position_side === "long"), side: f.position_side, liq: f.liq }))} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
        <div className="space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h3 className="mb-2 text-sm font-medium text-zinc-300">Факт</h3>
            <Row k="Открыта" v={dt(t.opened_at)} />
            <Row k="Закрыта" v={dt(t.closed_at)} />
            <Row k="Длительность" v={`${num(durH, 1)} ч`} />
            <Row k="Вход / выход" v={`${px(t.entry_avg)} → ${t.exit_avg ? px(t.exit_avg) : "—"}`} />
            <Row k="Объём" v={`${num(t.max_qty, 4)} ${t.base} ≈ $${num(notional, 0)}`} />
            <Row k="Gross" v={usd(t.gross_pnl)} cls={pnlClass(t.gross_pnl)} />
            <Row k="Комиссии" v={usd(-Number(t.fees))} cls="text-zinc-400" />
            <Row k="Фандинг" v={usd(t.funding, 3)} cls={pnlClass(t.funding)} />
            <Row k="Net" v={usd(t.net_pnl)} cls={`font-semibold ${pnlClass(t.net_pnl)}`} />
            {ex && <Row k="MFE / MAE (по свечам)" v={<><span className="text-emerald-400">+{num(ex.mfe, 2)}%</span> / <span className="text-rose-400">−{num(ex.mae, 2)}%</span></>} />}
            {stopPct !== null && <Row k="Стоп от входа" v={`${num(stopPct, 2)}%`} />}
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <h3 className="mb-2 text-sm font-medium text-zinc-300">Исполнения ({fills.length})</h3>
            <div className="space-y-1 text-xs tabular-nums">
              {fills.map((f, i) => {
                const open = (f.side === "BUY") === (f.position_side === "long");
                return (
                  <div key={i} className="grid grid-cols-[96px_44px_1fr_auto] gap-2">
                    <span className="text-zinc-500">{dt(f.executed_at)}</span>
                    <span className={open ? "text-sky-400" : "text-zinc-300"}>{f.liq ? "💀" : open ? "вход" : "выход"}</span>
                    <span>{px(f.price)} × {num(f.qty, 4)}</span>
                    <span className={pnlClass(f.pnl)}>{f.pnl ? usd(f.pnl) : ""}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <form action={action} className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <h3 className="text-sm font-medium text-zinc-300">Разбор (заполняешь ты)</h3>
          <label className="block text-xs text-zinc-400">Причина входа / сетап словами
            <textarea name="entry_reason" defaultValue={t.entry_reason ?? ""} rows={3} className={inp} placeholder="Что увидел, почему вошёл, где был стоп" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs text-zinc-400">Стратегия (плейбук)
              <select name="playbook" defaultValue={t.playbook ?? ""} className={inp}>
                <option value="">—</option>{playbooks.map((p) => <option key={p}>{p}</option>)}
              </select>
              <input name="playbook_new" placeholder="или новая: «SMC 15m», «Шорт пампа»" className={`${inp} mt-1`} />
            </label>
            <label className="block text-xs text-zinc-400">Теги (через запятую)
              <input name="tags" defaultValue={tags.join(", ")} className={inp} placeholder="усреднение, без стопа, вечер" />
            </label>
            <label className="block text-xs text-zinc-400">Эмоция до входа
              <select name="emotion_before" defaultValue={t.emotion_before ?? ""} className={inp}><option value="">—</option>{EMOTIONS.map((e) => <option key={e}>{e}</option>)}</select>
            </label>
            <label className="block text-xs text-zinc-400">Эмоция после выхода
              <select name="emotion_after" defaultValue={t.emotion_after ?? ""} className={inp}><option value="">—</option>{EMOTIONS.map((e) => <option key={e}>{e}</option>)}</select>
            </label>
            <label className="block text-xs text-zinc-400">Уверенность 1–10
              <input name="confidence" type="number" min={1} max={10} defaultValue={t.confidence ?? ""} className={inp} />
            </label>
            <label className="block text-xs text-zinc-400">По плану?
              <select name="followed_plan" defaultValue={t.followed_plan === null ? "" : t.followed_plan ? "yes" : "no"} className={inp}>
                <option value="">—</option><option value="yes">да</option><option value="no">нет</option>
              </select>
            </label>
            <label className="block text-xs text-zinc-400">Плановый стоп (цена)
              <input name="planned_stop" defaultValue={t.planned_stop ? px(t.planned_stop) : ""} className={inp} />
            </label>
          </div>
          <fieldset className="text-xs text-zinc-400">
            <legend className="mb-1">Нарушенные правила</legend>
            <div className="grid gap-1 sm:grid-cols-2">
              {rules.map((r) => (
                <label key={r.id} className="flex items-start gap-2 text-sm text-zinc-300">
                  <input type="checkbox" name="violated" value={r.id} defaultChecked={r.violated} className="mt-1 accent-rose-500" />
                  <span>{r.text}{r.comment?.startsWith("auto:") && <span className="block text-xs text-amber-400">🧯 детектор: {r.comment.slice(5).trim()}</span>}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="block text-xs text-zinc-400">Добавить заметку
            <textarea name="note" rows={2} className={inp} placeholder="Мысль по сделке — сохранится в ленту ниже" />
          </label>
          <button className="rounded-md bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900">Сохранить</button>

          {notes.length > 0 && (
            <div className="space-y-2 border-t border-zinc-800 pt-3">
              {notes.map((n) => (
                <div key={n.id} className="text-sm">
                  <div className="text-xs text-zinc-500">{dt(n.created_at)} · {n.channel === "TELEGRAM" ? (n.kind === "VOICE" ? "🎙 Telegram" : "Telegram") : "веб"}</div>
                  <div className="whitespace-pre-wrap">{n.text ?? n.transcript}</div>
                </div>
              ))}
            </div>
          )}
        </form>
      </div>

      {signal && (
        <div className="rounded-xl border border-sky-900/60 bg-sky-950/20 p-4 text-sm">
          <h3 className="mb-1 font-medium text-sky-200">📡 Сигнал: {signal.source} ({signal.kind === "DETECTOR" ? "наш детектор" : signal.kind === "TELEGRAM_CHANNEL" ? "канал" : signal.kind})</h3>
          <div className="text-zinc-300">
            {signal.side === "LONG" ? "лонг" : "шорт"} · сетап {new Date(signal.setup_time).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })} ·
            вход {px(signal.entry)} · стоп {px(signal.stop_loss)} · тейк {signal.take_profits.map(px).join(" / ")} ·
            итог сигнала: {signal.status}{signal.simulated_r != null && ` (${Number(signal.simulated_r).toFixed(1)}R)`}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-violet-900/60 bg-violet-950/20 p-4">
        <h3 className="mb-2 text-sm font-medium text-violet-200">🧠 ИИ-разбор (Opus)</h3>
        {reviews.length === 0 ? (
          <p className="text-sm text-zinc-500">Разбора ещё нет. В Telegram (Т6): «разбери #{t.n}».</p>
        ) : (
          reviews.map((r) => (
            <div key={r.id} className="mb-3 last:mb-0">
              <div className="mb-1 flex flex-wrap gap-1.5 text-xs text-zinc-500">
                <span>{new Date(r.created_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" })}</span>
                {r.findings?.tilt_risk != null && <span className="rounded bg-rose-950 px-1.5 text-rose-300">тильт-риск {r.findings.tilt_risk}/3</span>}
                {(r.findings?.tags ?? []).map((g) => <span key={g} className="rounded bg-zinc-800 px-1.5 text-zinc-300">{g}</span>)}
              </div>
              <div className="space-y-1 text-sm leading-relaxed text-zinc-200">
                {r.content_md.split("\n").filter(Boolean).map((line, i) => (
                  <p key={i} className={line.startsWith("- ") ? "pl-3" : ""}
                     dangerouslySetInnerHTML={{ __html: line.replace(/&/g, "&amp;").replace(/</g, "&lt;")
                       .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/`(.+?)`/g, "<code class='text-violet-300'>$1</code>").replace(/^- /, "• ") }} />
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
        <h3 className="mb-2 text-sm font-medium text-zinc-300">Скриншоты ({shots.length})</h3>
        {shots.length > 0 && (
          <div className="mb-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shots.map((a) => (
              <div key={a.id} className="group relative">
                <a href={`/att/${a.id}`} target="_blank"><img src={`/att/${a.id}`} alt="" className="w-full rounded-lg border border-zinc-800" /></a>
                <form action={removeShot.bind(null, t.id, a.id)} className="absolute right-2 top-2 hidden group-hover:block">
                  <button className="rounded bg-zinc-900/90 px-2 py-0.5 text-xs text-zinc-300">убрать</button>
                </form>
              </div>
            ))}
          </div>
        )}
        <form action={uploadShots.bind(null, t.id)} className="flex flex-wrap items-center gap-3 text-sm">
          <input type="file" name="shots" accept="image/*" multiple className="text-zinc-400 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1 file:text-zinc-200" />
          <button className="rounded-md bg-zinc-100 px-3 py-1 font-medium text-zinc-900">Загрузить</button>
          <span className="text-xs text-zinc-500">или пришли фото в топик «Дневник» — привяжу к сделке</span>
        </form>
      </div>
    </div>
  );
}
