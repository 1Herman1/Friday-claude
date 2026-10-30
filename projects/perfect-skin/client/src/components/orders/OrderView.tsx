import { formatPrice } from '@/lib/format'
import { bonusWord } from '@/lib/bonus-labels'

// Форма позиции заказа с сервера (снапшот на момент покупки),
// это НЕ CartItem: поля плоские.
interface OrderItem {
  productName: string
  brandName?: string | null
  volumeLabel?: string | null
  price: number
  quantity: number
  lineTotal: number
  productSlug?: string | null
  image?: string | null
}

interface OrderDelivery {
  trackNumber: string | null
  trackUrl: string | null
  carrierStatus: string | null
  carrierStatusAt: string | null
  point: { code: string; type: string; name: string; address: string; workTime: string | null } | null
  periodMin: number | null
  periodMax: number | null
}

interface OrderDetail {
  number: string
  createdAt: string
  status: string
  items: OrderItem[]
  recipient: {
    name: string
    phone: string
    email?: string
  }
  deliveryMethod: string
  deliveryAddress?: {
    city?: string
    street: string
    house: string
    apartment?: string | null
    postalCode?: string | null
  } | null
  cdekPvzCode?: string | null
  delivery?: OrderDelivery
  subtotal: number
  discount?: number
  deliveryCost: number
  total: number
  comment?: string
  bonus?: OrderBonus | null
}

interface OrderBonus {
  spent: number
  discount: number
  accrualPlanned: number
  accrualStatus: 'none' | 'pending' | 'accrued' | 'cancelled'
}

interface OrderViewProps {
  order: OrderDetail
}

function BonusAccrualLine({ bonus }: { bonus: OrderBonus }) {
  if (bonus.accrualStatus === 'none') return null
  const text =
    bonus.accrualStatus === 'pending'
      ? `Начислим ${bonus.accrualPlanned} ${bonusWord(bonus.accrualPlanned)} после получения`
      : bonus.accrualStatus === 'accrued'
        ? `Начислено ${bonus.accrualPlanned} ${bonusWord(bonus.accrualPlanned)}`
        : 'Начисление отменено'
  return <p className="mt-3 text-body-sm text-muted-foreground">{text}</p>
}

export function OrderView({ order }: OrderViewProps) {
  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr)
      const day = String(date.getDate()).padStart(2, '0')
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const year = date.getFullYear()
      return `${day}.${month}.${year}`
    } catch {
      return dateStr
    }
  }

  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      new: 'Новый',
      confirmed: 'Подтверждён',
      packed: 'Собирается',
      in_transit: 'Отправлен',
      delivered: 'Доставлен',
      cancelled: 'Отменён',
    }
    return labels[status] || status
  }

  const getStatusClasses = (status: string): string => {
    switch (status) {
      case 'new':
      case 'confirmed':
        return 'bg-accent text-foreground'
      case 'packed':
      case 'in_transit':
        return 'bg-primary/10 text-primary'
      case 'delivered':
        return 'bg-success/10 text-success'
      case 'cancelled':
        return 'bg-muted text-muted-foreground'
      default:
        return 'bg-primary/10 text-primary'
    }
  }

  const getDeliveryMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
      pickup: 'Самовывоз',
      cdek_pvz: 'СДЭК — пункт выдачи',
      cdek_courier: 'СДЭК — курьер',
    }
    return labels[method] || method
  }

  return (
    <div className="container-app py-12 md:py-16">
      {/* Шапка */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground mb-2 uppercase tracking-tight">
            Заказ {order.number}
          </h1>
          <p className="text-body-sm text-muted-foreground">
            {formatDate(order.createdAt)}
          </p>
        </div>
        <span className={`inline-block px-4 py-2 text-sm font-semibold uppercase tracking-wide rounded-pill ${getStatusClasses(order.status)}`}>
          {getStatusLabel(order.status)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Основной контент */}
        <div className="lg:col-span-2 space-y-8">
          {/* Товары */}
          <div className="bg-card border border-border rounded-block p-6">
            <h2 className="text-base font-sans font-semibold text-foreground mb-4 uppercase tracking-wide">
              Товары
            </h2>
            <div className="divide-y divide-border">
              {order.items.map((item) => (
                <a
                  key={`${item.productSlug}-${item.productName}`}
                  href={`/product/${item.productSlug}`}
                  className="flex gap-3 py-4 first:pt-0 last:pb-0 hover:opacity-80 transition-opacity"
                >
                  {item.image && (
                    <img
                      src={item.image}
                      alt={item.productName}
                      className="w-16 h-16 rounded-media object-contain flex-shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground line-clamp-2">
                      {item.productName}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.volumeLabel ? `${item.volumeLabel} × ` : ''}{item.quantity} шт.
                    </p>
                    <p className="text-sm font-semibold text-foreground mt-1">
                      {formatPrice(item.lineTotal)}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Доставка */}
          <div className="bg-card border border-border rounded-block p-6">
            <h2 className="text-base font-sans font-semibold text-foreground mb-4 uppercase tracking-wide">
              Доставка
            </h2>
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Способ: </span>
                <span className="font-semibold text-foreground">
                  {getDeliveryMethodLabel(order.deliveryMethod)}
                </span>
              </p>

              {order.deliveryAddress && (
                <>
                  {order.deliveryAddress.city && (
                    <p>
                      <span className="text-muted-foreground">Город: </span>
                      <span className="font-semibold text-foreground">
                        {order.deliveryAddress.city}
                      </span>
                    </p>
                  )}
                  <p>
                    <span className="text-muted-foreground">Адрес: </span>
                    <span className="font-semibold text-foreground">
                      {order.deliveryAddress.street}, {order.deliveryAddress.house}
                      {order.deliveryAddress.apartment && `, кв. ${order.deliveryAddress.apartment}`}
                    </span>
                  </p>
                  {order.deliveryAddress.postalCode && (
                    <p>
                      <span className="text-muted-foreground">Индекс: </span>
                      <span className="font-semibold text-foreground">
                        {order.deliveryAddress.postalCode}
                      </span>
                    </p>
                  )}
                </>
              )}

              {order.delivery?.point && (
                <div>
                  <p className="font-semibold text-foreground">{order.delivery.point.name}</p>
                  <p className="text-muted-foreground">{order.delivery.point.address}</p>
                  {order.delivery.point.workTime && (
                    <p className="text-muted-foreground">Часы работы: {order.delivery.point.workTime}</p>
                  )}
                </div>
              )}

              {!order.delivery?.point && order.cdekPvzCode && (
                <p>
                  <span className="text-muted-foreground">ПВЗ код: </span>
                  <span className="font-semibold text-foreground">
                    {order.cdekPvzCode}
                  </span>
                </p>
              )}

              {order.delivery?.periodMin != null && order.delivery.periodMax != null && (
                <p>
                  <span className="text-muted-foreground">Срок доставки: </span>
                  <span className="font-semibold text-foreground">
                    {order.delivery.periodMin === order.delivery.periodMax
                      ? `${order.delivery.periodMin} дн.`
                      : `${order.delivery.periodMin}–${order.delivery.periodMax} дн.`}
                  </span>
                </p>
              )}

              {order.delivery?.trackNumber && (
                <p>
                  <span className="text-muted-foreground">Трек-номер: </span>
                  <span className="font-semibold text-foreground">{order.delivery.trackNumber}</span>
                  {order.delivery.trackUrl && (
                    <>
                      {' '}
                      <a
                        href={order.delivery.trackUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        Отследить на сайте СДЭК
                      </a>
                    </>
                  )}
                </p>
              )}

              {order.delivery?.carrierStatus && (
                <p>
                  <span className="text-muted-foreground">Статус перевозчика: </span>
                  <span className="font-semibold text-foreground">
                    {order.delivery.carrierStatus}
                    {order.delivery.carrierStatusAt &&
                      ` (${new Date(order.delivery.carrierStatusAt).toLocaleString('ru-RU')})`}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Получатель */}
          <div className="bg-card border border-border rounded-block p-6">
            <h2 className="text-base font-sans font-semibold text-foreground mb-4 uppercase tracking-wide">
              Получатель
            </h2>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Имя: </span>
                <span className="font-semibold text-foreground">
                  {order.recipient.name}
                </span>
              </p>
              <p>
                <span className="text-muted-foreground">Телефон: </span>
                <a
                  href={`tel:${order.recipient.phone}`}
                  className="font-semibold text-primary hover:underline"
                >
                  {order.recipient.phone}
                </a>
              </p>
              {order.recipient.email && (
                <p>
                  <span className="text-muted-foreground">Email: </span>
                  <a
                    href={`mailto:${order.recipient.email}`}
                    className="font-semibold text-primary hover:underline"
                  >
                    {order.recipient.email}
                  </a>
                </p>
              )}
            </div>
          </div>

          {/* Комментарий */}
          {order.comment && (
            <div className="bg-card border border-border rounded-block p-6">
              <h2 className="text-lg font-heading font-semibold text-foreground mb-2">
                Комментарий
              </h2>
              <p className="text-body-sm text-muted-foreground whitespace-pre-wrap">
                {order.comment}
              </p>
            </div>
          )}
        </div>

        {/* Боковая сводка */}
        <div className="lg:col-span-1">
          <div className="bg-card border border-border rounded-block p-6 sticky top-6">
            <h2 className="text-base font-sans font-semibold text-foreground mb-4 uppercase tracking-wide">
              Сумма заказа
            </h2>

            <div className="space-y-2 pb-4 border-b border-border">
              <div className="flex justify-between text-body-sm">
                <span className="text-muted-foreground">Товары</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {formatPrice(order.subtotal)}
                </span>
              </div>

              {order.discount && order.discount > 0 && (
                <div className="flex justify-between text-body-sm">
                  <span className="text-muted-foreground">Скидка</span>
                  <span className="font-semibold text-primary tabular-nums">
                    −{formatPrice(order.discount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-body-sm">
                <span className="text-muted-foreground">Доставка</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {order.deliveryCost === 0 ? "Бесплатно" : formatPrice(order.deliveryCost)}
                </span>
              </div>

              {order.bonus && order.bonus.spent > 0 && (
                <div className="flex justify-between text-body-sm">
                  <span className="text-muted-foreground">Оплачено бонусами: {order.bonus.spent} {bonusWord(order.bonus.spent)}</span>
                  <span className="font-semibold text-primary tabular-nums">
                    −{formatPrice(order.bonus.discount)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-between text-lg mt-4 pt-4">
              <span className="font-heading font-bold text-foreground">
                Итого
              </span>
              <span className="font-heading font-bold text-primary tabular-nums">
                {formatPrice(order.total)}
              </span>
            </div>

            {order.bonus && <BonusAccrualLine bonus={order.bonus} />}
          </div>
        </div>
      </div>
    </div>
  )
}

export type { OrderDetail }
