import Link from "next/link";
import { q } from "@/server/db";
import { createTrade } from "./actions";

export const dynamic = "force-dynamic";

export default async function NewTrade() {
  const accounts = await q<{ id: string; name: string }>(`SELECT id, name FROM accounts WHERE deleted_at IS NULL AND active ORDER BY created_at`);
  const inp = "w-full rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1.5 text-sm";
  const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="block text-xs text-zinc-400">{t}{children}</label>;
  return (
    <div className="max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/trades" className="text-sm text-zinc-400 hover:text-zinc-200">← сделки</Link>
        <h1 className="text-xl font-semibold">Новая сделка вручную</h1>
      </div>
      <p className="text-sm text-zinc-500">Для сделок, которых нет в API (другая площадка, проп, старые). Сделки MEXC подтягиваются сами — их сюда не вносить, будет дубль.</p>
      <form action={createTrade} className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 sm:grid-cols-3">
        <L t="Счёт"><select name="account" className={inp}>{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></L>
        <L t="Монета"><input name="base" required placeholder="BTC" className={inp} /></L>
        <L t="Сторона"><select name="side" className={inp}><option value="LONG">Лонг</option><option value="SHORT">Шорт</option></select></L>
        <L t="Вход (МСК)"><input type="datetime-local" name="opened_at" required className={inp} /></L>
        <L t="Выход (МСК, пусто = открыта)"><input type="datetime-local" name="closed_at" className={inp} /></L>
        <L t="Объём (в монетах)"><input name="qty" required inputMode="decimal" className={inp} /></L>
        <L t="Цена входа"><input name="entry" required inputMode="decimal" className={inp} /></L>
        <L t="Цена выхода"><input name="exit" inputMode="decimal" className={inp} /></L>
        <L t="Плановый стоп"><input name="planned_stop" inputMode="decimal" className={inp} /></L>
        <L t="Комиссии, $"><input name="fees" inputMode="decimal" defaultValue="0" className={inp} /></L>
        <L t="Фандинг, $ (+ получил / − заплатил)"><input name="funding" inputMode="decimal" defaultValue="0" className={inp} /></L>
        <label className="flex items-center gap-2 pt-5 text-sm text-zinc-300"><input type="checkbox" name="liq" className="accent-rose-500" />ликвидация</label>
        <div className="sm:col-span-3"><L t="Причина входа"><textarea name="entry_reason" rows={2} className={inp} /></L></div>
        <div className="sm:col-span-3"><button className="rounded-md bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-900">Создать и открыть карточку</button></div>
      </form>
    </div>
  );
}
