export function formatPrice(kopecks: number): string {
  const rubles = (kopecks / 100).toFixed(0)
  const parts = rubles.split('')
  const result = []

  for (let i = parts.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) {
      result.unshift(' ')
    }
    result.unshift(parts[i])
  }

  return result.join('') + ' ₽'
}

export function pluralize(
  count: number,
  forms: [string, string, string]
): string {
  const mod10 = count % 10
  const mod100 = count % 100

  if (mod10 === 1 && mod100 !== 11) {
    return forms[0]
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return forms[1]
  }
  return forms[2]
}
