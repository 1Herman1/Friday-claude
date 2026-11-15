import Link from "next/link";
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = { title: "Дневник трейдера", description: "H&B · trade-performance/journal" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        <header className="border-b border-zinc-800">
          <nav className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 text-sm">
            <span className="font-semibold">📓 Дневник трейдера</span>
            <Link href="/" className="text-zinc-300 hover:text-white">Дашборд</Link>
            <Link href="/trades" className="text-zinc-300 hover:text-white">Сделки</Link>
            <Link href="/signals" className="text-zinc-300 hover:text-white">Сигналы</Link>
            <Link href="/agents-monitor" className="text-zinc-300 hover:text-white">Агенты · Live</Link>
            <Link href="/checklist" className="text-zinc-300 hover:text-white">Чек-лист</Link>
            <span className="ml-auto text-xs text-zinc-500">Локальная система</span>
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
