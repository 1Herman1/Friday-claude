// Формат корма (format:dry / format:wet) для товаров, у которых его нет.
// Без формата корм не попадает ни в «Сухой», ни во «Влажный корм» дерева
// категорий и выпадает из квиза. Характеристики первичного импорта есть не у
// всех, синхронизация с МоимСкладом их не пишет.
//
// Порядок доверия:
// 1. Папка МоегоСклада называет формат («… / Сухой», «… / Влажный»).
// 2. Название называет влажный корм (WET_NAME).
// 3. ПРАВИЛО, решение владельца 26.09: папка «Корм…» и в названии нет влажных
//    слов → сухой. Это вывод из закономерности каталога (влажный корм в нём
//    подписан, сухой — нет), а не факт из источника, поэтому печатается
//    отдельным списком целиком.
//
// Пишет в quizTags, а не в autoQuizTags: те пересобираются на каждой выкатке.
// Товар с уже стоящим форматом не трогается — ручная правка в админке главнее.
import { PrismaClient } from '@prisma/client'
import { classifyType, WET_NAME } from '../lib/product-type.js'
import { withFormatTag } from '../lib/quiz-tags.js'
import { loadMoyskladFolders } from '../services/moysklad/folders.js'

const prisma = new PrismaClient()

type Format = 'dry' | 'wet'
type Decision = { id: string; name: string; quizTags: string[]; format: Format; reason: 'folder' | 'name' | 'rule' }

function formatFromFolder(path: string): Format | null {
  const lower = path.toLowerCase()
  const wet = /влажн|консерв|пауч/.test(lower)
  const dry = /сух/.test(lower)
  if (wet && !dry) return 'wet'
  if (dry && !wet) return 'dry'
  return null
}

function printList(title: string, names: string[]) {
  console.log(`\n--- ${title}: ${names.length} ---`)
  for (const name of names) console.log(`  • ${name.slice(0, 90)}`)
}

async function main() {
  const apply = process.argv.includes('--apply')
  console.log(`\n════════ ФОРМАТ КОРМА ════════`)
  console.log(`Режим: ${apply ? '✅ ПРИМЕНЕНИЕ' : '📋 ПРЕДПРОСМОТР (без записи)'}`)

  const products = await prisma.product.findMany({
    select: {
      id: true,
      name: true,
      quizTags: true,
      autoQuizTags: true,
      variants: { select: { moyskladId: true } },
    },
  })
  const folders = await loadMoyskladFolders()

  // Только товары, которым дерево не нашло типа: у лечебных, лакомств, ухода и
  // ветаптеки тип уже есть, а формат им в квизе не нужен.
  const untyped = products.filter((p) => classifyType(p) === null)

  const decisions: Decision[] = []
  const left: string[] = []
  for (const p of untyped) {
    const folder = folders
      ? p.variants.map((v) => (v.moyskladId ? folders.get(v.moyskladId) : undefined)).find(Boolean) ?? null
      : null

    const fromFolder = folder ? formatFromFolder(folder) : null
    if (fromFolder) {
      decisions.push({ ...p, format: fromFolder, reason: 'folder' })
    } else if (WET_NAME.test(p.name)) {
      decisions.push({ ...p, format: 'wet', reason: 'name' })
    } else if (folder && /^корм/i.test(folder)) {
      decisions.push({ ...p, format: 'dry', reason: 'rule' })
    } else {
      left.push(folder ? `${p.name}  [${folder}]` : p.name)
    }
  }

  const by = (reason: Decision['reason']) => decisions.filter((d) => d.reason === reason)
  console.log(`Товаров без типа: ${untyped.length}`)
  console.log(`  из папки МоегоСклада: ${by('folder').length}`)
  console.log(`  влажный по названию: ${by('name').length}`)
  console.log(`  сухой по правилу «Корм без влажных слов»: ${by('rule').length}`)
  console.log(`  остаются без типа (в корне вида): ${left.length}`)

  printList('Из папки МоегоСклада', by('folder').map((d) => `${d.format === 'dry' ? 'сухой' : 'влажный'} — ${d.name}`))
  printList('Влажный по названию', by('name').map((d) => d.name))
  printList('Сухой по ПРАВИЛУ (вывод, не факт — проверить)', by('rule').map((d) => d.name))
  printList('Остаются без типа', left)

  if (!apply) {
    console.log('\n📌 Предпросмотр. Ничего не записано. Для применения — флаг --apply\n')
    return
  }

  for (const d of decisions) {
    await prisma.product.update({ where: { id: d.id }, data: { quizTags: withFormatTag(d.quizTags, d.format) } })
  }
  console.log(`\n✅ Записан формат у ${decisions.length} товаров.`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
