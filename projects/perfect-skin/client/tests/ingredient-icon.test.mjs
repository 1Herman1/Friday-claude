// Тесты выбора иконки по названию активного компонента (src/lib/ingredient-icon.ts).
//
// Запуск: node --test projects/perfect-skin/client/tests/ingredient-icon.test.mjs
import { test, before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { build } from 'esbuild'

const here = path.dirname(fileURLToPath(import.meta.url))
const clientRoot = path.resolve(here, '..')

let ingredientIcon

before(async () => {
  const outdir = await mkdtemp(path.join(tmpdir(), 'ps-ingredient-icon-'))
  const outfile = path.join(outdir, 'ingredient-icon.bundle.mjs')
  await build({
    entryPoints: [path.join(clientRoot, 'src/lib/ingredient-icon.ts')],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    outfile,
    logLevel: 'silent',
  })
  ;({ ingredientIcon } = await import(pathToFileURL(outfile).href))
})

const cases = [
  ['Фактор роста EGF', 'Dna'],
  ['Пептиды меди', 'Dna'],
  ['Гиалуроновая кислота', 'Droplet'],
  ['Увлажняющий комплекс', 'Droplet'],
  ['Термальная вода', 'Waves'],
  ['Масло жожоба', 'Droplets'],
  ['Карите', 'Droplets'],
  ['Гликолевая кислота', 'FlaskConical'],
  ['Озон', 'Wind'],
  ['Витамин С', 'Citrus'],
  ['Витамин B3', 'Sun'],
  ['Пчелиный яд', 'Hexagon'],
  ['Экстракт алоэ вера', 'Leaf'],
  ['Лаванда', 'Flower2'],
  ['Экстракт винограда', 'Leaf'],
  ['Виноградные косточки', 'Grape'],
  ['Пшеничные протеины', 'Wheat'],
  ['Каолин', 'Gem'],
  ['Ретинол', 'Atom'],
  ['Неизвестный компонент', 'Sparkles'],
]

test('каждое ключевое слово даёт свою иконку', () => {
  for (const [name, expected] of cases) {
    assert.equal(ingredientIcon(name), expected, name)
  }
})

test('регистр не влияет на результат', () => {
  assert.equal(ingredientIcon('ГИАЛУРОНОВАЯ КИСЛОТА'), 'Droplet')
  assert.equal(ingredientIcon('EGF'), 'Dna')
})

test('более ранее правило побеждает: гиалуроновая кислота — капля, а не колба', () => {
  assert.equal(ingredientIcon('Гиалуроновая кислота'), 'Droplet')
})

test('пустая строка получает запасную иконку', () => {
  assert.equal(ingredientIcon(''), 'Sparkles')
})
