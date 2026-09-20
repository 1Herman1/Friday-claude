import { useDeliveryOptions } from '../../hooks/useDeliveryOptions'

const items = [
  { title: 'Доставка по всей России', subtitle: 'Курьер, СДЭК, Яндекс, Ozon' },
  { title: 'Только оригиналы', subtitle: 'Прямые поставки от брендов' },
  { title: 'Ветеринарный подбор', subtitle: 'AI-помощник бесплатно' },
  { title: 'Бонусная программа', subtitle: 'До 5% от каждой покупки' },
]

export default function PromoStrip() {
  // Перечень служб — из прайс-листа доставки, чтобы выключенный способ исчезал сам.
  const carriers = useDeliveryOptions().map((o) => o.title.replace(/\s+—.*$/, '')).join(', ')
  const rows = carriers ? items.map((it, i) => (i === 0 ? { ...it, subtitle: carriers } : it)) : items
  return (
    <div className="bg-white shadow-sm border-b border-line">
      <div className="max-w-7xl mx-auto px-4 py-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {rows.map((item) => (
          <div key={item.title} className="flex items-center gap-3">
            <div>
              <p className="text-xs font-bold text-navy-900 leading-tight">{item.title}</p>
              <p className="text-xs text-navy-500 leading-tight">{item.subtitle}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
