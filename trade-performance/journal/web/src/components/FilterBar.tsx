import Link from "next/link";
import { SEG_LABEL, SORTS } from "@/server/stats";

type P = { f: Record<string, string | undefined>; symbols: string[]; action: string; tags?: { name: string; n: number }[]; sort?: boolean };
export default function FilterBar({ f, symbols, action, tags, sort }: P) {
  const cls = "rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-sm";
  const L = ({ t, children }: { t: string; children: React.ReactNode }) => <label className="flex flex-col gap-1 text-xs text-zinc-400">{t}{children}</label>;
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 text-sm">
      {sort && (
        <L t="сортировка">
          <select name="sort" defaultValue={f.sort ?? "date_desc"} className={cls}>
            {Object.entries(SORTS).map(([k, [label]]) => <option key={k} value={k}>{label}</option>)}
          </select>
        </L>
      )}
      <L t="с"><input type="date" name="from" defaultValue={f.from} className={cls} /></L>
      <L t="по"><input type="date" name="to" defaultValue={f.to} className={cls} /></L>
      <L t="сторона">
        <select name="side" defaultValue={f.side ?? ""} className={cls}><option value="">все</option><option value="LONG">лонг</option><option value="SHORT">шорт</option></select>
      </L>
      <L t="монета">
        <select name="symbol" defaultValue={f.symbol ?? ""} className={cls}><option value="">все</option>{symbols.map((s) => <option key={s}>{s}</option>)}</select>
      </L>
      <L t="сегмент риска">
        <select name="seg" defaultValue={f.seg ?? ""} className={cls}>
          <option value="">все</option>
          {Object.entries(SEG_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          <option value="OUT">❌ все вне стратегии</option>
        </select>
      </L>
      <L t="случайные">
        <select name="rnd" defaultValue={f.rnd ?? ""} className={cls}><option value="">все</option><option value="exclude">без случайных</option><option value="only">только случайные</option></select>
      </L>
      <L t="ликвидации">
        <select name="liq" defaultValue={f.liq ?? ""} className={cls}><option value="">все</option><option value="exclude">без ликвидаций</option><option value="only">только ликвидации</option></select>
      </L>
      {tags && (
        <L t="тег">
          <select name="tag" defaultValue={f.tag ?? ""} className={cls}><option value="">все</option>{tags.map((t) => <option key={t.name} value={t.name}>{t.name} ({t.n})</option>)}</select>
        </L>
      )}
      <button className="rounded-md bg-zinc-100 px-3 py-1 font-medium text-zinc-900">Применить</button>
      <Link href={action} className="px-2 py-1 text-zinc-400 hover:text-zinc-200">сброс</Link>
    </form>
  );
}
