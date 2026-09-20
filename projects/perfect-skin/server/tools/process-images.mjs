#!/usr/bin/env node
/**
 * Perfect Skin — конвейер обработки изображений (оптимизированный)
 *
 * Переиспользует одну страницу с явным очищением состояния между операциями.
 *
 * Запуск: node tools/process-images.mjs
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'
import pkg from '/opt/node22/lib/node_modules/playwright/index.js'

const { chromium } = pkg

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = path.resolve(__dirname, '../..')
const PRODUCTS_DIR = path.join(PROJECT_ROOT, 'server/assets/products')
const MEDIA_DIR = path.join(PROJECT_ROOT, '../docs/projects/perfect-skin/media/photos')
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'server/assets/processed')

const MANIFEST_PATH = path.join(PRODUCTS_DIR, 'manifest.json')

// Конфиг размеров
const SIZES = {
  products: [
    { name: 'card', width: 400 },
    { name: 'card@2x', width: 800 },
    { name: 'full', width: 1600 },
  ],
  photos: [
    { name: 'w800', width: 800 },
    { name: 'w1200', width: 1200 },
    { name: 'orig', width: null }, // без изменений
  ],
}

async function ensureDir(dir) {
  try {
    await fs.mkdir(dir, { recursive: true })
  } catch (e) {
    if (e.code !== 'EEXIST') throw e
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function resizeImage(page, imageBase64, targetWidth, originalWidth, originalHeight, mimeType = 'jpeg') {
  // Если нет целевой ширины (orig) или исходник меньше цели — пропустить
  if (!targetWidth) {
    return { width: originalWidth, height: originalHeight, webpBase64: imageBase64 }
  }
  if (originalWidth < targetWidth) {
    return null // Апскейлирование не требуется
  }

  // Вычислить высоту с сохранением пропорций
  const ratio = originalHeight / originalWidth
  const targetHeight = Math.round(targetWidth * ratio)

  const html = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"></head>
    <body><canvas id="c"></canvas><script>
    var img=new Image();img.onload=function(){
    var c=document.getElementById('c');c.width=${targetWidth};c.height=${targetHeight};
    var x=c.getContext('2d');x.imageSmoothingQuality='high';x.drawImage(img,0,0,${targetWidth},${targetHeight});
    window.r=c.toDataURL('image/webp',0.82)};
    img.src='data:image/${mimeType};base64,${imageBase64}'</script></body></html>
  `

  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => typeof window.r !== 'undefined', { timeout: 30000 })
    const result = await page.evaluate(() => window.r)
    if (!result) throw new Error('Render failed')
    return { width: targetWidth, height: targetHeight, webpBase64: result.replace('data:image/webp;base64,', '') }
  } catch (err) {
    throw new Error(`Resize: ${err.message}`)
  }
}

async function getImageDimensions(page, imageBase64, mimeType = 'jpeg') {
  const html = `
    <!DOCTYPE html>
    <html>
    <body><img id="i" src="data:image/${mimeType};base64,${imageBase64}">
    <script>document.getElementById('i').onload=()=>{window.d={w:i.naturalWidth,h:i.naturalHeight}}</script></body></html>
  `
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => typeof window.d !== 'undefined', { timeout: 30000 })
    const d = await page.evaluate(() => window.d)
    if (!d) throw new Error('Failed')
    return { width: d.w, height: d.h }
  } catch (err) {
    throw new Error(`Dimensions: ${err.message}`)
  }
}

async function processProducts(browser, manifest, page) {
  console.log(`\n=== Обработка товарных фото (${manifest.products.length} товаров) ===`)

  const index = {}
  let processed = 0
  let skipped = 0

  for (const product of manifest.products) {
    const { slug, images } = product

    if (!images || images.length === 0) {
      processed++
      continue
    }

    const imageFile = images[0].file
    const srcPath = path.join(PRODUCTS_DIR, imageFile)
    const outDir = path.join(OUTPUT_DIR, 'products', slug)

    try {
      // Проверить кэш
      const allExist = await Promise.all(
        SIZES.products.map(size => {
          const fileName = size.name === 'full' ? 'full.webp' : `${size.name}.webp`
          return fileExists(path.join(outDir, fileName))
        })
      )

      if (allExist.every(e => e)) {
        skipped++
        processed++
        continue
      }

      await ensureDir(outDir)

      const srcExists = await fileExists(srcPath)
      if (!srcExists) {
        processed++
        continue
      }

      const buffer = await fs.readFile(srcPath)
      const imageBase64 = buffer.toString('base64')
      const mimeType = path.extname(srcPath).slice(1).toLowerCase().replace('jpg', 'jpeg')

      try {
        const { width: origWidth, height: origHeight } = await getImageDimensions(page, imageBase64, mimeType)

        const sizes = {}

        for (const size of SIZES.products) {
          const fileName = size.name === 'full' ? 'full.webp' : `${size.name}.webp`
          const filePath = path.join(outDir, fileName)

          if (await fileExists(filePath)) {
            sizes[size.name] = { cached: true }
            continue
          }

          const resized = await resizeImage(page, imageBase64, size.width, origWidth, origHeight, mimeType)
          if (!resized) {
            sizes[size.name] = { skipped: true, reason: 'too small' }
            continue
          }

          const webpBuffer = Buffer.from(resized.webpBase64, 'base64')
          await fs.writeFile(filePath, webpBuffer)

          sizes[size.name] = {
            file: fileName,
            width: resized.width,
            height: resized.height,
            bytes: webpBuffer.length,
          }
        }

        index[slug] = {
          original: { width: origWidth, height: origHeight, bytes: buffer.length },
          sizes,
        }
      } catch (err) {
        console.error(`\n  ❌ [${slug}]: ${err.message}`)
      }

      processed++
      process.stdout.write(`\r  [${processed}/${manifest.products.length}] ${slug}`)
    } catch (err) {
      console.error(`\n  ❌ [${slug}]: ${err.message}`)
      processed++
    }
  }

  console.log(`\n  Завершено: ${processed}/${manifest.products.length} (кэш: ${skipped})`)
  return index
}

async function processPhotos(browser, page) {
  console.log(`\n=== Обработка медиалики ===`)

  const index = {}
  let processed = 0
  let skipped = 0

  try {
    const files = await fs.readdir(MEDIA_DIR)
    const imageFiles = files.filter(f => /\.(jpg|png|webp)$/i.test(f))

    for (const imageFile of imageFiles) {
      const srcPath = path.join(MEDIA_DIR, imageFile)
      const outDir = path.join(OUTPUT_DIR, 'photos', imageFile.replace(/\.\w+$/, ''))

      try {
        // Проверить кэш
        const allExist = await Promise.all(
          SIZES.photos.map(size => {
            const fileName = `${size.name}.webp`
            return fileExists(path.join(outDir, fileName))
          })
        )

        if (allExist.every(e => e)) {
          skipped++
          processed++
          continue
        }

        await ensureDir(outDir)

        const buffer = await fs.readFile(srcPath)
        const imageBase64 = buffer.toString('base64')
        const mimeType = path.extname(imageFile).slice(1).toLowerCase().replace('jpg', 'jpeg')

        try {
          const { width: origWidth, height: origHeight } = await getImageDimensions(page, imageBase64, mimeType)

          const sizes = {}

          // w800 и w1200
          for (const size of SIZES.photos.slice(0, 2)) {
            const filePath = path.join(outDir, `${size.name}.webp`)

            if (await fileExists(filePath)) {
              sizes[size.name] = { cached: true }
              continue
            }

            const resized = await resizeImage(page, imageBase64, size.width, origWidth, origHeight, mimeType)
            if (!resized) {
              sizes[size.name] = { skipped: true, reason: 'too small' }
              continue
            }

            const webpBuffer = Buffer.from(resized.webpBase64, 'base64')
            await fs.writeFile(filePath, webpBuffer)

            sizes[size.name] = {
              file: `${size.name}.webp`,
              width: resized.width,
              height: resized.height,
              bytes: webpBuffer.length,
            }
          }

          // оригинал
          const origFilePath = path.join(outDir, 'orig.webp')
          if (!(await fileExists(origFilePath))) {
            const origResized = await resizeImage(page, imageBase64, origWidth, origWidth, origHeight, mimeType)
            if (origResized) {
              const webpBuffer = Buffer.from(origResized.webpBase64, 'base64')
              await fs.writeFile(origFilePath, webpBuffer)
              sizes.orig = {
                file: 'orig.webp',
                width: origResized.width,
                height: origResized.height,
                bytes: webpBuffer.length,
              }
            }
          } else {
            sizes.orig = { cached: true }
          }

          index[imageFile] = {
            original: { width: origWidth, height: origHeight, bytes: buffer.length },
            sizes,
          }
        } catch (err) {
          console.error(`\n  ❌ [${imageFile}]: ${err.message}`)
        }

        processed++
        process.stdout.write(`\r  [${processed}/${imageFiles.length}] ${imageFile}`)
      } catch (err) {
        console.error(`\n  ❌ [${imageFile}]: ${err.message}`)
        processed++
      }
    }

    console.log(`\n  Завершено: ${processed} (кэш: ${skipped})`)
  } catch (err) {
    console.error(`  ❌ Ошибка: ${err.message}`)
  }

  return index
}

async function main() {
  console.log('Perfect Skin — конвейер обработки изображений')
  console.log('='.repeat(60))

  try {
    const manifestJson = await fs.readFile(MANIFEST_PATH, 'utf8')
    const manifest = JSON.parse(manifestJson)

    console.log(`Манифест загружен: ${manifest.products.length} товаров`)
    await ensureDir(OUTPUT_DIR)

    console.log(`Запуск Chromium...`)
    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()

    const productsIndex = await processProducts(browser, manifest, page)
    const photosIndex = await processPhotos(browser, page)

    await page.close()
    await browser.close()
    console.log(`\nВсе браузеры закрыты`)

    const fullIndex = {
      generatedAt: new Date().toISOString(),
      products: productsIndex,
      photos: photosIndex,
    }

    const indexPath = path.join(OUTPUT_DIR, 'index.json')
    await fs.writeFile(indexPath, JSON.stringify(fullIndex, null, 2))
    console.log(`index.json сохранён`)

    console.log(`\n${'='.repeat(60)}`)
    console.log(`✓ Завершено: ${Object.keys(productsIndex).length} товаров, ${Object.keys(photosIndex).length} файлов медиалики`)

  } catch (err) {
    console.error('❌ ОШИБКА:', err.message)
    process.exit(1)
  }
}

main()
