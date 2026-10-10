export type IngredientIconName =
  | 'Dna'
  | 'Droplet'
  | 'Waves'
  | 'Droplets'
  | 'FlaskConical'
  | 'Wind'
  | 'Citrus'
  | 'Sun'
  | 'Hexagon'
  | 'Leaf'
  | 'Flower2'
  | 'Grape'
  | 'Wheat'
  | 'Gem'
  | 'Atom'
  | 'Sparkles'

// Порядок важен: первое совпадение побеждает («экстракт винограда» — лист, а не гроздь).
const RULES: ReadonlyArray<readonly [readonly string[], IngredientIconName]> = [
  [['фактор роста', 'egf', 'fgf', 'kgf', 'пептид'], 'Dna'],
  [['гиалурон', 'nmf', 'увлажн'], 'Droplet'],
  [['вода', 'термальн', 'морск', 'гидролат'], 'Waves'],
  [['масло', 'воск', 'карите', 'эфир'], 'Droplets'],
  [['кислот'], 'FlaskConical'],
  [['озон', 'кислород'], 'Wind'],
  [['витамин с', 'витамин c'], 'Citrus'],
  [['витамин'], 'Sun'],
  [['пчел', 'яд'], 'Hexagon'],
  [['экстракт', 'стволов', 'алоэ'], 'Leaf'],
  [['цвет', 'роз', 'лаванд'], 'Flower2'],
  [['виноград'], 'Grape'],
  [['пшениц', 'пшенич'], 'Wheat'],
  [['уголь', 'глин', 'каолин', 'бентонит', 'минерал', 'микроэлемент'], 'Gem'],
  [['ретинол', 'ниацинамид', 'кофеин', 'аллантоин', 'мелатонин', 'cbd', 'атф'], 'Atom'],
]

export function ingredientIcon(name: string): IngredientIconName {
  const normalized = name.toLowerCase()
  const rule = RULES.find(([roots]) => roots.some(root => normalized.includes(root)))
  return rule ? rule[1] : 'Sparkles'
}
