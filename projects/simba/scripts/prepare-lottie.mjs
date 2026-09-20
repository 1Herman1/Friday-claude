/**
 * Готовит присланные Lottie к вставке: подрезает холст и перекрашивает в палитру.
 *
 * Зачем скрипт, а не правка руками: карта цветов видна в диффе одним куском, а
 * прогон воспроизводим — при смене одного тона не надо искать его по 56 КБ JSON.
 *
 * Запуск: node scripts/prepare-lottie.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'

const SRC = new URL('../client/src/lottie/', import.meta.url)

/** Замерено в браузере по фактическим контурам, объединённым по всей петле:
    у обоих файлов рисунок занимает примерно половину холста. Без подрезки
    сцена рендерится мелким пятном в пустой рамке. */
const JOBS = [
  {
    file: 'empty-catalog',
    art: { x: 488, y: 76, w: 985, h: 842 },
    pad: 40,
    /* Градиенты схлопываем в плоский тон — по слою, а не по hex. Один и тот же
       #F9C471 живёт и в корпусе, и в лапах, и в морде: плоская замена по цвету
       слепила бы их в одно пятно и убила силуэт. Сам отказ от градиентов
       осознан: кот полностью плоский, и объёмная собака рядом читалась бы как
       из другого набора; вдобавок исходный перепад корпуса — всего 1.96:1,
       на 128px он не виден, а разделение «лапы на тон темнее» работает всегда. */
    flatten: {
      /* Ближние лапы В ТОН корпусу, как было в оригинале: там они несли ту же
         золотую растяжку, и разделял их не цвет, а контур. Развести их по тону
         я попробовал — на рендере по корпусу пошли угловатые грани: градиент
         раньше маскировал стыки перекрывающихся фигур, плоская заливка их
         обнажает. Глубину даёт только дальняя лапа. */
      'Body': '#8FA8C0',   // navy-300
      'Head': '#8FA8C0',   // navy-300
      'Leg 1': '#8FA8C0',
      'Leg 2': '#8FA8C0',
      'Leg 4': '#8FA8C0',
      'Leg 3': '#4A5C7A',  // navy-500 — дальняя лапа в тени; navy-600 читался
                           //   как чёрная култышка, оторванная от собаки
    },
    colors: {
      '#FFECCE': '#C4D3E0', // navy-200 — светлые отметины
      '#F9C471': '#8FA8C0', // navy-300 — тон корпуса
      '#443826': '#2A3A56', // navy-700 — глаза, контур
      '#000000': '#16233C', // navy-900 — самое тёмное; чистый чёрный запрещён
      '#DF6C6C': '#E8921A', // amber-500 — язык, единственная тёплая нота
    },
  },
  {
    file: 'quiz-loading',
    art: { x: 102, y: 52, w: 138, h: 141 },
    pad: 8,
    flatten: {},
    colors: {
      '#D9DEED': '#E4EBF7', // navy-100 — ошейник
      '#BAC1D8': '#C4D3E0', // navy-200 — брюхо
      '#9999C2': '#C4D3E0', // navy-200 — наземная тень: по рангу просилась темнее,
                            //   но обе наши сцены кладут тень светлой, и тёмная
                            //   читалась бы как отдельная лужа, а не как контакт
      '#333A4E': '#3A4B66', // navy-600 — основная масса
      '#282E3D': '#2A3A56', // navy-700 — круп
      '#212432': '#1F2E48', // navy-800 — уши
      '#020100': '#16233C', // navy-900 — морда
    },
  },
]

const hex = (arr) =>
  '#' + arr.slice(0, 3).map((v) => Math.round(v * 255).toString(16).padStart(2, '0')).join('').toUpperCase()

const toRgba = (h) => {
  const n = h.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16) / 255).concat(1)
}

function recolor(node, map, stats, flat) {
  if (Array.isArray(node)) return node.forEach((n) => recolor(n, map, stats, flat))
  if (!node || typeof node !== 'object') return

  /* Градиентные заливки. У собаки их семь по три стопа, и именно они дают
     основной объём — сборщик сплошных заливок их не видит, так что без этой
     ветки перекраска молча прошла бы мимо корпуса. Формат: g.k.k = плоский
     массив [позиция, r, g, b, позиция, r, g, b, ...], первые g.p*4 значений —
     цветовые стопы, дальше могут идти пары прозрачности. */
  if ((node.ty === 'gf' || node.ty === 'gs') && node.g?.k?.k) {
    const arr = node.g.k.k
    const stops = node.g.p ?? Math.floor(arr.length / 4)
    for (let i = 0; i < stops; i++) {
      const o = i * 4
      const from = hex([arr[o + 1], arr[o + 2], arr[o + 3]])
      const to = flat || map[from]
      if (to) {
        const [r, g, b] = toRgba(to)
        arr[o + 1] = r; arr[o + 2] = g; arr[o + 3] = b
        stats.set(from, (stats.get(from) || 0) + 1)
      } else {
        stats.set(from + ' (НЕ ЗАМЕНЁН, градиент)', (stats.get(from + ' (НЕ ЗАМЕНЁН, градиент)') || 0) + 1)
      }
    }
  }

  if ((node.ty === 'fl' || node.ty === 'st') && node.c && Array.isArray(node.c.k)) {
    const from = hex(node.c.k)
    const to = map[from]
    if (to) {
      node.c.k = toRgba(to)
      stats.set(from, (stats.get(from) || 0) + 1)
    } else {
      stats.set(from + ' (НЕ ЗАМЕНЁН)', (stats.get(from + ' (НЕ ЗАМЕНЁН)') || 0) + 1)
    }
  }
  Object.values(node).forEach((v) => recolor(v, map, stats, flat))
}

/** Сдвигаем только корневые слои: у детей трансформ складывается с родительским,
    и сдвинутый родитель уводит их за собой. Сдвинуть всех — уехало бы дважды. */
function crop(data, art, pad) {
  const dx = art.x - pad
  const dy = art.y - pad
  data.w = Math.round(art.w + pad * 2)
  data.h = Math.round(art.h + pad * 2)

  for (const layer of data.layers) {
    if (layer.parent !== undefined) continue
    const p = layer.ks?.p
    if (!p) continue
    if (p.s) {
      if (p.x?.a === 0) p.x.k -= dx
      else p.x?.k?.forEach((f) => { if (f.s) f.s[0] -= dx; if (f.e) f.e[0] -= dx })
      if (p.y?.a === 0) p.y.k -= dy
      else p.y?.k?.forEach((f) => { if (f.s) f.s[0] -= dy; if (f.e) f.e[0] -= dy })
    } else if (p.a === 0) {
      p.k[0] -= dx
      p.k[1] -= dy
    } else {
      p.k.forEach((f) => {
        if (f.s) { f.s[0] -= dx; f.s[1] -= dy }
        if (f.e) { f.e[0] -= dx; f.e[1] -= dy }
      })
    }
  }
}

for (const job of JOBS) {
  const src = new URL(`_src-${job.file}.json`, SRC)
  const data = JSON.parse(readFileSync(src, 'utf8'))
  const before = `${data.w}x${data.h}`

  crop(data, job.art, job.pad)
  const stats = new Map()
  for (const layer of data.layers) {
    recolor(layer, job.colors, stats, job.flatten?.[layer.nm])
  }

  writeFileSync(new URL(`${job.file}.json`, SRC), JSON.stringify(data))
  console.log(`${job.file}: холст ${before} -> ${data.w}x${data.h}`)
  ;[...stats.entries()].forEach(([k, v]) => console.log(`   ${k} x${v}`))
}
