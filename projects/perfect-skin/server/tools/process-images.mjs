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

async function normalizeProductImage(page, imageBase64, mimeType = 'jpeg') {
  /**
   * Нормализация карточки товара через браузер:
   * Поиск контента, обрезка инфографики, центрирование на белом фоне
   */
  const script = `
    (async () => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });

      return new Promise((resolve) => {
        img.onload = () => {
          const W = img.width, H = img.height;
          canvas.width = W;
          canvas.height = H;
          ctx.drawImage(img, 0, 0);

          const imgData = ctx.getImageData(0, 0, W, H);
          const data = imgData.data;

          // Найти bounding box контента (не-белые пиксели)
          let minY = H, maxY = -1;
          for (let y = 0; y < H; y++) {
            for (let x = 0; x < W; x++) {
              const idx = (y * W + x) * 4;
              const r = data[idx], g = data[idx+1], b = data[idx+2];
              // Если не белый (< 245), это контент
              if (r < 245 || g < 245 || b < 245) {
                minY = Math.min(minY, y);
                maxY = Math.max(maxY, y);
                break;
              }
            }
          }

          if (maxY < 0) {
            resolve({ status: 'no-content', normalizedBase64: '${imageBase64}', contentHeightPercent: 0 });
            return;
          }

          const contentHeight = maxY - minY + 1;
          const contentHeightPercent = (contentHeight / H) * 100;

          // Если контент занимает слишком мало или слишком много, пропустить
          if (contentHeightPercent < 30 || contentHeightPercent > 95) {
            resolve({ status: 'suspicious', normalizedBase64: '${imageBase64}', contentHeightPercent });
            return;
          }

          // Вписать в квадрат 800×800, 76% заполнения
          const targetSize = 800;
          const fitSize = Math.round(targetSize * 0.76);
          const ratio = W / contentHeight;
          let fitW = fitSize, fitH = fitSize;
          if (ratio > 1) {
            fitW = fitSize;
            fitH = Math.round(fitSize / ratio);
          } else {
            fitH = fitSize;
            fitW = Math.round(fitSize * ratio);
          }

          const outCanvas = document.createElement('canvas');
          outCanvas.width = targetSize;
          outCanvas.height = targetSize;
          const outCtx = outCanvas.getContext('2d');

          outCtx.fillStyle = '#ffffff';
          outCtx.fillRect(0, 0, targetSize, targetSize);

          const padX = (targetSize - fitW) / 2;
          const padY = (targetSize - fitH) / 2;

          outCtx.drawImage(img, 0, minY, W, contentHeight, padX, padY, fitW, fitH);

          resolve({
            status: 'normalized',
            normalizedBase64: outCanvas.toDataURL('image/webp', 0.92).replace('data:image/webp;base64,', ''),
            contentHeightPercent
          });
        };
        img.src = 'data:image/${mimeType};base64,${imageBase64}';
      });
    })()
  `

  try {
    const result = await page.evaluate(script)
    return result || { status: 'failed' }
  } catch (err) {
    // На ошибку просто пропускаем
    return { status: 'error', normalizedBase64: imageBase64, contentHeightPercent: 100, error: err.message }
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
    window.r=c.toDataURL('image/webp',0.92)};
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
  const md5Map = {}  // Для подсчёта уникальных изображений
  const suspiciousProducts = []  // Товары с контент-боксом < 30% или > 95%
  let processed = 0
  let skipped = 0
  let normalized = 0

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
        // Если кэш существует, прочитать card.webp для md5
        const cardPath = path.join(outDir, 'card.webp')
        const cardBuf = await fs.readFile(cardPath)
        const crypto = await import('crypto')
        const md5 = crypto.createHash('md5').update(cardBuf).digest('hex')
        md5Map[md5] = (md5Map[md5] || 0) + 1
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

        // Нормализовать карточку
        let normalizedBase64 = imageBase64
        let normStatus = 'skipped'
        let contentHeightPercent = 100

        const normResult = await normalizeProductImage(page, imageBase64, mimeType)
        if (normResult.status === 'normalized') {
          normalizedBase64 = normResult.normalizedBase64
          normStatus = 'normalized'
          normalized++
          contentHeightPercent = normResult.contentHeightPercent

          // Проверить на подозрительные значения
          if (contentHeightPercent < 30 || contentHeightPercent > 95) {
            suspiciousProducts.push({
              slug,
              contentHeightPercent,
              reason: contentHeightPercent < 30 ? 'too-small' : 'too-large'
            })
            // НЕ перезаписываем карточку для подозрительных
            console.log(`\n  ⚠️  [${slug}]: контент ${contentHeightPercent.toFixed(1)}% — пропускаю нормализацию`)
            normalizedBase64 = imageBase64
            normStatus = 'suspicious-skipped'
          }
        }

        const sizes = {}

        for (const size of SIZES.products) {
          const fileName = size.name === 'full' ? 'full.webp' : `${size.name}.webp`
          const filePath = path.join(outDir, fileName)

          if (await fileExists(filePath)) {
            sizes[size.name] = { cached: true }
            continue
          }

          const baseToResize = size.name === 'full' ? imageBase64 : normalizedBase64
          const resized = await resizeImage(page, baseToResize, size.width, origWidth, origHeight, mimeType)
          if (!resized) {
            sizes[size.name] = { skipped: true, reason: 'too small' }
            continue
          }

          const webpBuffer = Buffer.from(resized.webpBase64, 'base64')
          await fs.writeFile(filePath, webpBuffer)

          // Посчитать md5 для card.webp
          if (size.name === 'card') {
            const crypto = await import('crypto')
            const md5 = crypto.createHash('md5').update(webpBuffer).digest('hex')
            md5Map[md5] = (md5Map[md5] || 0) + 1
          }

          sizes[size.name] = {
            file: fileName,
            width: resized.width,
            height: resized.height,
            bytes: webpBuffer.length,
          }
        }

        index[slug] = {
          original: { width: origWidth, height: origHeight, bytes: buffer.length },
          normStatus,
          contentHeightPercent,
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

  const uniqueMd5Count = Object.keys(md5Map).length

  console.log(`\n  Завершено: ${processed}/${manifest.products.length} (кэш: ${skipped}, нормализовано: ${normalized})`)
  console.log(`  Уникальные card.webp: ${uniqueMd5Count} (всего ${manifest.products.length - skipped} переработано)`)

  if (suspiciousProducts.length > 0) {
    console.log(`  ⚠️  Подозрительные товары (пропущены): ${suspiciousProducts.length}`)
    suspiciousProducts.forEach(p => {
      console.log(`     - ${p.slug}: ${p.contentHeightPercent.toFixed(1)}% (${p.reason})`)
    })
  }

  return { index, md5Map, suspiciousProducts, normalizedCount: normalized }
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

async function saveControlSample(slug, beforeBase64, afterBase64, mimeType = 'jpeg') {
  /**
   * Сохранить контрольные примеры до/после в scratchpad для визуальной проверки
   */
  const scratchDir = '/tmp/claude-0/-home-user-project-simba/1749002d-5615-562f-864f-d89af882543c/scratchpad/imgcheck'
  await ensureDir(scratchDir)

  try {
    const beforeBuf = Buffer.from(beforeBase64, 'base64')
    const afterBuf = Buffer.from(afterBase64, 'base64')

    await fs.writeFile(path.join(scratchDir, `${slug}-before.png`), beforeBuf)
    await fs.writeFile(path.join(scratchDir, `${slug}-after.png`), afterBuf)

    return path.join(scratchDir, slug)
  } catch (err) {
    console.error(`  Ошибка сохранения примера [${slug}]: ${err.message}`)
    return null
  }
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

    const { index: productsIndex, md5Map, suspiciousProducts, normalizedCount } = await processProducts(browser, manifest, page)
    const photosIndex = await processPhotos(browser, page)

    await page.close()
    await browser.close()
    console.log(`\nВсе браузеры закрыты`)

    const fullIndex = {
      generatedAt: new Date().toISOString(),
      stats: {
        totalProducts: manifest.products.length,
        normalized: normalizedCount,
        suspicious: suspiciousProducts.length,
        uniqueCardImages: Object.keys(md5Map).length,
        md5Distribution: md5Map,
      },
      products: productsIndex,
      photos: photosIndex,
    }

    const indexPath = path.join(OUTPUT_DIR, 'index.json')
    await fs.writeFile(indexPath, JSON.stringify(fullIndex, null, 2))
    console.log(`index.json сохранён`)

    console.log(`\n${'='.repeat(60)}`)
    console.log(`✓ Завершено:`)
    console.log(`  • Товаров обработано: ${manifest.products.length}`)
    console.log(`  • Нормализовано карточек: ${normalizedCount}`)
    console.log(`  • Уникальные card.webp: ${Object.keys(md5Map).length}`)
    if (suspiciousProducts.length > 0) {
      console.log(`  • ⚠️  Подозрительные (пропущены): ${suspiciousProducts.length}`)
    }
    console.log(`  • Файлов медиалики: ${Object.keys(photosIndex).length}`)
    console.log(`\nПроверка размеров файлов:`)

    // Проверить размеры card.webp
    const cardSizes = []
    for (const slug of Object.keys(productsIndex)) {
      const cardPath = path.join(OUTPUT_DIR, 'products', slug, 'card.webp')
      if (await fileExists(cardPath)) {
        const stat = await fs.stat(cardPath)
        cardSizes.push({ slug, bytes: stat.size })
      }
    }

    const minCardSize = Math.min(...cardSizes.map(c => c.bytes))
    const maxCardSize = Math.max(...cardSizes.map(c => c.bytes))
    const avgCardSize = Math.round(cardSizes.reduce((sum, c) => sum + c.bytes, 0) / cardSizes.length)

    console.log(`  card.webp: ${minCardSize}–${maxCardSize} байт (avg: ${avgCardSize})`)

    if (minCardSize < 4096 || maxCardSize > 40960) {
      console.log(`  ⚠️  Некоторые файлы вне диапазона 4–40KB`)
      cardSizes.forEach(c => {
        if (c.bytes < 4096 || c.bytes > 40960) {
          console.log(`     - ${c.slug}: ${c.bytes} байт`)
        }
      })
    }

  } catch (err) {
    console.error('❌ ОШИБКА:', err.message)
    process.exit(1)
  }
}

main()
