"use client";
import { useRouter } from "next/navigation";

// вся строка таблицы — ссылка на карточку; клики по вложенным ссылкам (метки-фильтры) не перехватываются
export default function RowLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const r = useRouter();
  return (
    <tr
      className={className}
      tabIndex={0}
      role="link"
      onMouseEnter={() => r.prefetch(href)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) return;
        if (e.metaKey || e.ctrlKey) window.open(href, "_blank");
        else r.push(href);
      }}
      onKeyDown={(e) => { if (e.key === "Enter") r.push(href); }}
    >
      {children}
    </tr>
  );
}
