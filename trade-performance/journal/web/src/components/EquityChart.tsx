"use client";
import { useEffect, useRef } from "react";
import { createChart, BaselineSeries, ColorType, type UTCTimestamp } from "lightweight-charts";

export default function EquityChart({ points }: { points: { t: number; v: number }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const chart = createChart(ref.current, {
      height: 280,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#a1a1aa" },
      grid: { vertLines: { color: "#27272a" }, horzLines: { color: "#27272a" } },
      timeScale: { timeVisible: true, borderColor: "#3f3f46" },
      rightPriceScale: { borderColor: "#3f3f46" },
      localization: { locale: "ru-RU" },
    });
    const s = chart.addSeries(BaselineSeries, {
      baseValue: { type: "price", price: 0 },
      topLineColor: "#34d399", topFillColor1: "rgba(52,211,153,0.25)", topFillColor2: "rgba(52,211,153,0.02)",
      bottomLineColor: "#fb7185", bottomFillColor1: "rgba(251,113,133,0.02)", bottomFillColor2: "rgba(251,113,133,0.25)",
    });
    // у lightweight-charts время должно строго расти
    const data: { time: UTCTimestamp; value: number }[] = [];
    let last = 0;
    for (const p of points) {
      const t = Math.max(p.t, last + 1);
      data.push({ time: t as UTCTimestamp, value: p.v });
      last = t;
    }
    s.setData(data);
    chart.timeScale().fitContent();
    const ro = new ResizeObserver(() => chart.applyOptions({ width: ref.current!.clientWidth }));
    ro.observe(ref.current);
    return () => { ro.disconnect(); chart.remove(); };
  }, [points]);
  return <div ref={ref} className="w-full" />;
}
