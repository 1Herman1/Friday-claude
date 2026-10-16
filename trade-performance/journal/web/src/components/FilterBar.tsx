import Link from "next/link";
export default function FilterBar({ f, symbols, action }: { f: Record<string, string | undefined>; symbols: string[]; action: string }) {
  const cls = "rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm";
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 text-sm">
      <label className="flex flex-col gap-1 text-xs text-zinc-400">с<input type="date" name="from" defaultValue={f.from} className={cls} /></label>
      <label className="flex flex-col gap-1 text-xs text-zinc-400">по<input type="date" name="to" defaultValue={f.to} className={cls} /></label>
      <label className="flex flex-col gap-1 text-xs text-zinc-400">сторона
        <select name="side" defaultValue={f.side ?? ""} className={cls}><option value="">все</option><option value="LONG">лонг</option><option value="SHORT">шорт</option></select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-400">монета
        <select name="symbol" defaultValue={f.symbol ?? ""} className={cls}><option value="">все</option>{symbols.map((s) => <option key={s}>{s}</option>)}</select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-zinc-400">ликвидации
        <select name="liq" defaultValue={f.liq ?? ""} className={cls}><option value="">все</option><option value="exclude">без ликвидаций</option><option value="only">только ликвидации</option></select>
      </label>
      <button className="rounded-md bg-zinc-100 px-3 py-1 font-medium text-zinc-900">Применить</button>
      <Link href={action} className="px-2 py-1 text-zinc-400 hover:text-zinc-200">сброс</Link>
    </form>
  );
}
