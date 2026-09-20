/**
 * Иконки витрины Perfect Skin.
 * Набор: Iconify — lucide (версия ~0.400, MIT License).
 * https://icon-sets.iconify.design/lucide/
 * Единый стиль: сетка 24×24, stroke=currentColor, strokeWidth=1.75,
 * скруглённые концы и соединения — под гуманистический, но сдержанный
 * характер бренда (аптечная точность без резких углов).
 * Цвет не хардкодится — наследуется от родителя через currentColor.
 */

import type { SVGProps } from 'react'

export type IconProps = {
  className?: string
  size?: number
} & Omit<SVGProps<SVGSVGElement>, 'className' | 'width' | 'height'>

const defaults = {
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/**
 * Корзина: source: iconify/lucide "shopping-bag", license: MIT
 * https://icon-sets.iconify.design/lucide/shopping-bag/
 *
 * Выбор shopping-bag, а не shopping-cart: у Perfect Skin нет тележки по
 * физическому магазину — это витрина премиум-косметики, где метафора
 * «сумка/пакет из бутика» ближе к опыту покупки, чем супермаркетная тележка.
 * Cart читается как масс-маркет/грокери, bag — как аптека/парфюмерия.
 */
export function IconCart({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
      <path d="M3 6h18" />
      <path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}

/** source: iconify/lucide "heart", license: MIT — https://icon-sets.iconify.design/lucide/heart/ */
export function IconHeart({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

/** source: iconify/lucide "heart" (solid), license: MIT — https://icon-sets.iconify.design/lucide/heart/ */
export function IconHeartSolid({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} className={className} aria-hidden={ariaHidden} fill="currentColor" stroke="none" {...rest}>
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  )
}

/** source: iconify/lucide "menu", license: MIT — https://icon-sets.iconify.design/lucide/menu/ */
export function IconMenu({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <line x1="4" x2="20" y1="6" y2="6" />
      <line x1="4" x2="20" y1="12" y2="12" />
      <line x1="4" x2="20" y1="18" y2="18" />
    </svg>
  )
}

/** source: iconify/lucide "x", license: MIT — https://icon-sets.iconify.design/lucide/x/ */
export function IconClose({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  )
}

/** source: iconify/lucide "search", license: MIT — https://icon-sets.iconify.design/lucide/search/ */
export function IconSearch({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

/** source: iconify/lucide "arrow-right", license: MIT — https://icon-sets.iconify.design/lucide/arrow-right/ */
export function IconArrowRight({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}

/** source: iconify/lucide "chevron-down", license: MIT — https://icon-sets.iconify.design/lucide/chevron-down/ */
export function IconChevronDown({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  )
}

/** source: iconify/lucide "phone", license: MIT — https://icon-sets.iconify.design/lucide/phone/ */
export function IconPhone({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.598 1.767l-.464.354a1 1 0 0 0-.302 1.212 12.35 12.35 0 0 0 6.196 6.196Z" />
    </svg>
  )
}

/** source: iconify/lucide "minus", license: MIT — https://icon-sets.iconify.design/lucide/minus/ */
export function IconMinus({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M5 12h14" />
    </svg>
  )
}

/** source: iconify/lucide "plus", license: MIT — https://icon-sets.iconify.design/lucide/plus/ */
export function IconPlus({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  )
}

/** source: iconify/lucide "check", license: MIT — https://icon-sets.iconify.design/lucide/check/ */
export function IconCheck({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

/** source: iconify/lucide "trash-2", license: MIT — https://icon-sets.iconify.design/lucide/trash-2/ */
export function IconTrash({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  )
}

/**
 * Пустое состояние корзины: source: iconify/lucide "inbox", license: MIT
 * https://icon-sets.iconify.design/lucide/inbox/
 *
 * Выбор inbox, а не повтор shopping-bag: для «корзина пуста» нужен образ
 * пустого лотка/приёмника, а не ещё одна сумка — иначе состояние визуально
 * не отличалось бы от обычной иконки корзины в шапке.
 */
export function IconCartEmpty({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11Z" />
    </svg>
  )
}

/** source: iconify/lucide "user", license: MIT — https://icon-sets.iconify.design/lucide/user/ */
export function IconUser({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  )
}

/** source: iconify/lucide "truck", license: MIT — https://icon-sets.iconify.design/lucide/truck/ */
export function IconTruck({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
      <circle cx="17" cy="18" r="2" />
      <circle cx="7" cy="18" r="2" />
    </svg>
  )
}

/** source: iconify/lucide "store", license: MIT — https://icon-sets.iconify.design/lucide/store/ */
export function IconStore({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7" />
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4" />
      <path d="M2 7h20" />
      <path d="M22 7v3a2 2 0 0 1-2 2 2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12a2 2 0 0 1-2-2V7" />
    </svg>
  )
}

/** source: iconify/lucide "package", license: MIT — https://icon-sets.iconify.design/lucide/package/ */
export function IconPackage({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73Z" />
      <path d="M12 22V12" />
      <path d="m3.3 7 8.7 5 8.7-5" />
      <path d="m7.5 4.27 9 5.15" />
    </svg>
  )
}

/** source: iconify/lucide "mail", license: MIT — https://icon-sets.iconify.design/lucide/mail/ */
export function IconMail({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}
