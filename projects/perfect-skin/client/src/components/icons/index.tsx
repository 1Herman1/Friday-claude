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

/** source: iconify/lucide "droplet", license: ISC — https://icon-sets.iconify.design/lucide/droplet/ */
export function IconDroplet({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5S5 13 5 15a7 7 0 0 0 7 7" />
    </svg>
  )
}

/** source: iconify/lucide "droplets", license: ISC — https://icon-sets.iconify.design/lucide/droplets/ */
export function IconDroplets({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M7 16.3c2.2 0 4-1.83 4-4.05c0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05" />
      <path d="M12.56 6.6A11 11 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97" />
    </svg>
  )
}

/** source: iconify/lucide "waves", license: ISC — https://icon-sets.iconify.design/lucide/waves/ */
export function IconWaves({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2c2.5 0 2.5-2 5-2c1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1c2.5 0 2.5-2 5-2c2.6 0 2.4 2 5 2c2.5 0 2.5-2 5-2c1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1c2.5 0 2.5-2 5-2c2.6 0 2.4 2 5 2c2.5 0 2.5-2 5-2c1.3 0 1.9.5 2.5 1" />
    </svg>
  )
}

/** source: iconify/lucide "leaf", license: ISC — https://icon-sets.iconify.design/lucide/leaf/ */
export function IconLeaf({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8c0 5.5-4.78 10-10 10" />
      <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
    </svg>
  )
}

/** source: iconify/lucide "flower-2", license: ISC — https://icon-sets.iconify.design/lucide/flower-2/ */
export function IconFlower2({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M12 5a3 3 0 1 1 3 3m-3-3a3 3 0 1 0-3 3m3-3v1M9 8a3 3 0 1 0 3 3M9 8h1m5 0a3 3 0 1 1-3 3m3-3h-1m-2 3v-1" />
      <circle cx="12" cy="8" r="2" />
      <path d="M12 10v12m0 0c4.2 0 7-1.667 7-5c-4.2 0-7 1.667-7 5m0 0c-4.2 0-7-1.667-7-5c4.2 0 7 1.667 7 5" />
    </svg>
  )
}

/** source: iconify/lucide "flask-conical", license: ISC — https://icon-sets.iconify.design/lucide/flask-conical/ */
export function IconFlaskConical({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2M6.453 15h11.094M8.5 2h7" />
    </svg>
  )
}

/** source: iconify/lucide "dna", license: ISC — https://icon-sets.iconify.design/lucide/dna/ */
export function IconDna({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="m10 16l1.5 1.5M14 8l-1.5-1.5M15 2c-1.798 1.998-2.518 3.995-2.807 5.993M16.5 10.5l1 1M17 6l-2.891-2.891M2 15c6.667-6 13.333 0 20-6m-2 0l.891.891M3.109 14.109L4 15m2.5-2.5l1 1M7 18l2.891 2.891M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
    </svg>
  )
}

/** source: iconify/lucide "wind", license: ISC — https://icon-sets.iconify.design/lucide/wind/ */
export function IconWind({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M12.8 19.6A2 2 0 1 0 14 16H2m15.5-8a2.5 2.5 0 1 1 2 4H2m7.8-7.6A2 2 0 1 1 11 8H2" />
    </svg>
  )
}

/** source: iconify/lucide "sun", license: ISC — https://icon-sets.iconify.design/lucide/sun/ */
export function IconSun({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

/** source: iconify/lucide "citrus", license: ISC — https://icon-sets.iconify.design/lucide/citrus/ */
export function IconCitrus({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M21.66 17.67a1.08 1.08 0 0 1-.04 1.6A12 12 0 0 1 4.73 2.38a1.1 1.1 0 0 1 1.61-.04z" />
      <path d="M19.65 15.66A8 8 0 0 1 8.35 4.34M14 10l-5.5 5.5" />
      <path d="M14 17.85V10H6.15" />
    </svg>
  )
}

/** source: iconify/lucide "hexagon", license: ISC — https://icon-sets.iconify.design/lucide/hexagon/ */
export function IconHexagon({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16" />
    </svg>
  )
}

/** source: iconify/lucide "gem", license: ISC — https://icon-sets.iconify.design/lucide/gem/ */
export function IconGem({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M10.5 3L8 9l4 13l4-13l-2.5-6" />
      <path d="M17 3a2 2 0 0 1 1.6.8l3 4a2 2 0 0 1 .013 2.382l-7.99 10.986a2 2 0 0 1-3.247 0l-7.99-10.986A2 2 0 0 1 2.4 7.8l2.998-3.997A2 2 0 0 1 7 3zM2 9h20" />
    </svg>
  )
}

/** source: iconify/lucide "atom", license: ISC — https://icon-sets.iconify.design/lucide/atom/ */
export function IconAtom({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <circle cx="12" cy="12" r="1" />
      <path d="M20.2 20.2c2.04-2.03.02-7.36-4.5-11.9c-4.54-4.52-9.87-6.54-11.9-4.5c-2.04 2.03-.02 7.36 4.5 11.9c4.54 4.52 9.87 6.54 11.9 4.5" />
      <path d="M15.7 15.7c4.52-4.54 6.54-9.87 4.5-11.9c-2.03-2.04-7.36-.02-11.9 4.5c-4.52 4.54-6.54 9.87-4.5 11.9c2.03 2.04 7.36.02 11.9-4.5" />
    </svg>
  )
}

/** source: iconify/lucide "sparkles", license: ISC — https://icon-sets.iconify.design/lucide/sparkles/ */
export function IconSparkles({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594zM20 2v4m2-2h-4" />
      <circle cx="4" cy="20" r="2" />
    </svg>
  )
}

/** source: iconify/lucide "lightbulb", license: ISC — https://icon-sets.iconify.design/lucide/lightbulb/ */
export function IconLightbulb({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M15 14c.2-1 .7-1.7 1.5-2.5c1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5c.7.7 1.3 1.5 1.5 2.5m0 4h6m-5 4h4" />
    </svg>
  )
}

/** source: iconify/lucide "grape", license: ISC — https://icon-sets.iconify.design/lucide/grape/ */
export function IconGrape({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M22 5V2l-5.89 5.89" />
      <circle cx="16.6" cy="15.89" r="3" />
      <circle cx="8.11" cy="7.4" r="3" />
      <circle cx="12.35" cy="11.65" r="3" />
      <circle cx="13.91" cy="5.85" r="3" />
      <circle cx="18.15" cy="10.09" r="3" />
      <circle cx="6.56" cy="13.2" r="3" />
      <circle cx="10.8" cy="17.44" r="3" />
      <circle cx="5" cy="19" r="3" />
    </svg>
  )
}

/** source: iconify/lucide "wheat", license: ISC — https://icon-sets.iconify.design/lucide/wheat/ */
export function IconWheat({ className, size = 24, 'aria-hidden': ariaHidden = true, ...rest }: IconProps) {
  return (
    <svg {...defaults} width={size} height={size} className={className} aria-hidden={ariaHidden} {...rest}>
      <path d="M2 22L16 8M3.47 12.53L5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94m4-4L9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94m4-4L13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4" />
      <path d="M11.47 17.47L13 19l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L5 19l1.53-1.53a3.5 3.5 0 0 1 4.94 0m4-4L17 15l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L9 15l1.53-1.53a3.5 3.5 0 0 1 4.94 0m4-4L21 11l-1.53 1.53a3.5 3.5 0 0 1-4.94 0L13 11l1.53-1.53a3.5 3.5 0 0 1 4.94 0" />
    </svg>
  )
}
