// Open positions must include price action since the last fill, not stop at it.
export function tradeChartRange(candles: { time: number }[], fills: { t: number }[], step: number, isOpen: boolean) {
  if (!fills.length) {
    const first = candles[0]?.time ?? 0;
    return { from: first, to: Math.max(candles[candles.length - 1]?.time ?? first, first + 1) };
  }
  const first = Math.min(...fills.map((f) => f.t));
  const lastFill = Math.max(...fills.map((f) => f.t));
  const last = isOpen ? Math.max(lastFill, candles[candles.length - 1]?.time ?? lastFill) : lastFill;
  const span = Math.max(last - first, step * 20);
  return { from: first - span * 0.6, to: last + span * (isOpen ? 0.05 : 0.4) };
}
