"use client";
import { useEffect, useRef } from "react";
import { createChart, CandlestickSeries, createSeriesMarkers, ColorType, LineStyle, type UTCTimestamp, type SeriesMarker, type Time } from "lightweight-charts";

type C = { time: number; open: number; high: number; low: number; close: number };
type Fill = { t: number; price: number; open: boolean; side: string; liq: boolean; qty: number };

export default function TradeChart({ candles, fills, entry, exit, stop, step }: { candles: C[]; fills: Fill[]; entry: number; exit: number | null; stop: number | null; step: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current || !candles.length) return;
    const chart = createChart(ref.current, {
      height: 420,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#a1a1aa" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
      timeScale: {
        timeVisible: true, borderColor: "#3f3f46",
        // подписи оси тоже в МСК (по умолчанию библиотека рисует UTC)
        tickMarkFormatter: (t: number, kind: number) => new Date(t * 1000).toLocaleString("ru-RU", kind >= 3
          ? { timeZone: "Europe/Moscow", hour: "2-digit", minute: "2-digit" }
          : { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit" }),
      },
      rightPriceScale: { borderColor: "#3f3f46" },
      localization: { locale: "ru-RU", timeFormatter: (t: number) => new Date(t * 1000).toLocaleString("ru-RU", { timeZone: "Europe/Moscow", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) },
    });
    const s = chart.addSeries(CandlestickSeries, {
      upColor: "#34d399", downColor: "#fb7185", borderVisible: false, wickUpColor: "#34d399", wickDownColor: "#fb7185",
      priceFormat: { type: "price", precision: entry >= 100 ? 1 : entry >= 1 ? 4 : 6, minMove: entry >= 100 ? 0.1 : entry >= 1 ? 0.0001 : 0.000001 },
    });
    s.setData(candles.map((c) => ({ ...c, time: c.time as UTCTimestamp })));
    s.createPriceLine({ price: entry, color: "#60a5fa", lineStyle: LineStyle.Dashed, lineWidth: 1, title: "вход" });
    if (exit) s.createPriceLine({ price: exit, color: "#e4e4e7", lineStyle: LineStyle.Dashed, lineWidth: 1, title: "выход" });
    if (stop) s.createPriceLine({ price: stop, color: "#fb7185", lineStyle: LineStyle.Dotted, lineWidth: 1, title: "стоп (план)" });
    const long = fills[0]?.side === "long";
    const markers: SeriesMarker<Time>[] = fills.map((f) => {
      const buy = f.open === long; // покупка на графике
      return {
        time: (Math.floor(f.t / step) * step) as UTCTimestamp,
        position: buy ? ("atPriceBottom" as const) : ("atPriceTop" as const),
        price: f.price,
        color: f.liq ? "#f43f5e" : f.open ? "#60a5fa" : "#e4e4e7",
        shape: buy ? ("arrowUp" as const) : ("arrowDown" as const),
        text: f.liq ? "💀" : f.open ? "вход" : "выход",
      };
    }).sort((a, b) => (a.time as number) - (b.time as number));
    createSeriesMarkers(s, markers);
    const first = Math.min(...fills.map((f) => f.t)), last = Math.max(...fills.map((f) => f.t));
    const span = Math.max(last - first, step * 20);
    chart.timeScale().setVisibleRange({ from: (first - span * 0.6) as UTCTimestamp, to: (last + span * 0.4) as UTCTimestamp });
    const ro = new ResizeObserver(() => chart.applyOptions({ width: ref.current!.clientWidth }));
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [candles, fills, entry, exit, stop, step]);
  if (!candles.length) return <div className="py-16 text-center text-sm text-zinc-500">Свечи недоступны (MEXC не отдал историю по этому тикеру)</div>;
  return <div ref={ref} className="w-full" />;
}
