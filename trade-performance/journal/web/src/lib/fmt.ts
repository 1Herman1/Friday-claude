export const usd = (v: unknown, d = 2) => {
  const n = Number(v ?? 0);
  return (n > 0 ? "+" : n < 0 ? "−" : "") + "$" + Math.abs(n).toLocaleString("ru-RU", { minimumFractionDigits: d, maximumFractionDigits: d });
};
export const num = (v: unknown, d = 2) => Number(v ?? 0).toLocaleString("ru-RU", { maximumFractionDigits: d });
export const px = (v: unknown) => {
  const n = Number(v ?? 0);
  return n.toLocaleString("en-US", { maximumSignificantDigits: n >= 1 ? 8 : 5, useGrouping: false });
};
export const dt = (v: unknown) =>
  v ? new Date(v as string).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—";
export const pnlClass = (v: unknown) => (Number(v) > 0 ? "text-emerald-400" : Number(v) < 0 ? "text-rose-400" : "text-zinc-400");
