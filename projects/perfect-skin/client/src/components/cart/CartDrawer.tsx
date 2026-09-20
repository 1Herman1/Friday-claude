import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useCart } from '@/context/CartContext'
import { formatPrice } from '@/lib/format'
import { IconCartEmpty, IconCart } from '../icons'
import SideDrawer from './SideDrawer'
import { QuantityStepper } from './QuantityStepper'
import { ApiError } from '@/lib/api'
import type { CartItem, CartWarning } from '@/types/api'

const FREE_DELIVERY_THRESHOLD = 600000 // 6000 руб в копейках

type Props = {
  open: boolean
  onClose: () => void
}

export default function CartDrawer({ open, onClose }: Props) {
  const { cart, isLoading, updateItem, removeItem } = useCart()
  const [mutationError, setMutationError] = useState<{ itemId?: string; code: string; message: string } | null>(null)
  const [mutatingId, setMutatingId] = useState<string | null>(null)

  const items = cart?.items ?? []
  const warnings = cart?.warnings ?? []

  // Все хуки — до условных return, иначе их число меняется между рендерами.
  const subtotal = items.reduce((sum, item) => sum + item.lineTotal, 0)

  // Скелет загрузки
  if (isLoading) {
    return (
      <SideDrawer open={open} onClose={onClose} title="Корзина">
        <div className="px-4 py-4 flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 py-4 animate-pulse">
              <div className="w-16 h-16 bg-muted rounded-media flex-shrink-0" />
              <div className="flex-1 flex flex-col gap-2">
                <div className="h-4 bg-muted rounded-block w-3/4" />
                <div className="h-3 bg-muted rounded-block w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </SideDrawer>
    )
  }

  // Пустая корзина
  if (items.length === 0) {
    return (
      <SideDrawer open={open} onClose={onClose} title="Корзина">
        <div className="flex flex-col items-center justify-center gap-4 py-12 px-4">
          <IconCartEmpty className="w-12 h-12 text-muted-foreground" />
          <div className="text-center">
            <p className="font-heading font-bold text-foreground mb-1">Корзина пуста</p>
            <p className="text-sm text-muted-foreground">Добавьте товары из каталога</p>
          </div>
          <Link
            to="/catalog"
            onClick={onClose}
            className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-pill hover:opacity-90 transition-opacity duration-200 min-h-11"
          >
            В каталог
          </Link>
        </div>
      </SideDrawer>
    )
  }

  // Корзина с товарами
  const toFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal)
  const deliveryProgress = Math.min(100, (subtotal / FREE_DELIVERY_THRESHOLD) * 100)

  const handleUpdateQuantity = async (item: CartItem, newQuantity: number) => {
    // Лочим позицию на время запроса: параллельные PATCH при быстрых
    // кликах приходят вразнобой и рассинхронизируют количество.
    if (mutatingId) return
    setMutatingId(item.id)
    try {
      setMutationError(null)
      if (newQuantity === 0) {
        await removeItem(item.id)
      } else {
        await updateItem(item.id, newQuantity)
      }
    } catch (error) {
      const err = error as ApiError
      if (err.code === 'OUT_OF_STOCK') {
        setMutationError({
          itemId: item.id,
          code: 'OUT_OF_STOCK',
          message: `Осталось ${item.variant.stock} шт.`,
        })
      } else if (err.code === 'CART_ITEM_LIMIT') {
        setMutationError({ code: 'CART_ITEM_LIMIT', message: 'Максимум 50 товаров в корзине' })
      } else if (err.code === 'NETWORK_ERROR') {
        setMutationError({ code: 'NETWORK_ERROR', message: 'Нет соединения с сервером' })
      } else {
        setMutationError({ code: 'UNKNOWN_ERROR', message: 'Ошибка при обновлении корзины' })
      }
    } finally {
      setMutatingId(null)
    }
  }

  const getWarningForItem = (itemId: string): CartWarning | undefined => {
    return warnings.find((w) => w.itemId === itemId)
  }

  const content = (
    <>
      {/* Прогресс-бар до бесплатной доставки */}
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        {toFreeDelivery > 0 ? (
          <>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-foreground font-semibold">
                До бесплатной доставки:{' '}
                <span className="text-primary font-semibold">{formatPrice(toFreeDelivery)}</span>
              </span>
              <span className="text-muted-foreground text-xs">
                от {formatPrice(FREE_DELIVERY_THRESHOLD)}
              </span>
            </div>
            <div className="h-2 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full origin-left transition-transform duration-300"
                style={{ transform: `scaleX(${deliveryProgress / 100})` }}
              />
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3">
            <div className="h-2 bg-success/30 rounded-full flex-1 overflow-hidden">
              <div className="h-full bg-success rounded-full w-full" />
            </div>
            <span className="text-success text-sm font-semibold whitespace-nowrap">Доставка бесплатно</span>
          </div>
        )}
      </div>

      {/* Ошибка мутации */}
      {mutationError && (
        <div className="px-4 py-3 bg-destructive/10 border-b border-destructive/20">
          <p className="text-sm text-destructive font-medium">{mutationError.message}</p>
        </div>
      )}

      {/* Список товаров */}
      <ul className="px-4 divide-y divide-border">
        {items.map((item) => {
          const warning = getWarningForItem(item.id)
          const isUnavailable = warning?.code === 'ITEM_UNAVAILABLE'

          return (
            <li
              key={item.id}
              className={`flex flex-wrap gap-3 py-4 transition-opacity duration-200 ${
                isUnavailable ? 'opacity-60' : ''
              }`}
            >
              {/* Image */}
              <Link
                to={`/product/${item.product.slug}`}
                onClick={onClose}
                className="flex-shrink-0 w-16 h-16 rounded-media bg-muted flex items-center justify-center overflow-hidden"
              >
                {item.product.image ? (
                  <img
                    src={item.product.image}
                    alt={item.product.name}
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <IconCart className="w-6 h-6 text-muted-foreground" />
                )}
              </Link>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <Link
                  to={`/product/${item.product.slug}`}
                  onClick={onClose}
                  className="block text-sm font-semibold text-foreground leading-snug line-clamp-2 hover:text-primary transition-colors"
                >
                  {item.product.name}
                </Link>

                {/* Volume Label */}
                <p className="text-xs text-muted-foreground mt-1">{item.variant.volumeLabel}</p>

                {/* Stock Warning */}
                {warning?.code === 'STOCK_REDUCED' && (
                  <p className="text-xs text-urgency mt-1 font-medium">{warning.message}</p>
                )}

                {/* Price */}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-foreground tabular-nums">
                    {formatPrice(item.lineTotal)}
                  </span>
                  {item.variant.oldRetailPrice && (
                    <span className="text-xs text-muted-foreground line-through tabular-nums">
                      {formatPrice(item.variant.oldRetailPrice * item.quantity)}
                    </span>
                  )}
                </div>
              </div>

              {/* Quantity Stepper */}
              <div className="w-full flex justify-end sm:w-auto sm:block">
              <QuantityStepper
                quantity={item.quantity}
                maxStock={item.variant.stock}
                onQuantityChange={(newQuantity) => handleUpdateQuantity(item, newQuantity)}
                disabled={isUnavailable || mutatingId === item.id}
              />
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )

  // Footer
  const footerContent = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Товары ({items.reduce((sum, i) => sum + i.quantity, 0)} шт.)</span>
          <span className="text-foreground font-semibold">{formatPrice(subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Доставка</span>
          <span className="text-success font-semibold">{toFreeDelivery > 0 ? 'от 200 ₽' : 'Бесплатно'}</span>
        </div>
      </div>

      <div className="border-t border-border pt-3 mb-1">
        <div className="flex justify-between items-center">
          <span className="font-heading font-bold text-foreground">Итого</span>
          <span className="font-heading font-bold text-2xl text-foreground tabular-nums">
            {formatPrice(subtotal)}
          </span>
        </div>
      </div>

      <Link
        to="/checkout"
        onClick={onClose}
        className="w-full py-3 px-6 bg-primary text-primary-foreground font-semibold rounded-pill hover:opacity-90 transition-opacity duration-200 min-h-11 text-center block font-heading"
      >
        Оформить заказ
      </Link>

      <p className="text-center text-xs text-muted-foreground">
        Нажимая кнопку, вы соглашаетесь с{' '}
        <Link to="/offer" onClick={onClose} className="underline underline-offset-2">условиями оферты</Link>
      </p>
    </div>
  )

  return (
    <SideDrawer open={open} onClose={onClose} title="Корзина" footer={footerContent}>
      {content}
    </SideDrawer>
  )
}
