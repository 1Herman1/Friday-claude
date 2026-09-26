// Скрипт импорта профильных бизнесов из открытого реестра МСП ФНС.
// Использование: tsx prisma/import-msp.ts [--url <url>] [--file <path>] [--apply] [--keep-zip]

import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { Readable, Transform } from 'stream'
import * as https from 'https'
import yauzl from 'yauzl'
import { PrismaClient } from '../../../../node_modules/.prisma/ps-client'
import { parseMspXml, RegistryRecord } from '../src/lib/registry/msp-parser'
import { parseOkvedPrefixes, isProfileOkved } from '../src/lib/registry/okved'

const db = new PrismaClient()

interface Options {
  url?: string
  file?: string
  apply: boolean
  keepZip: boolean
}

const DEFAULT_URL = 'https://file.nalog.ru/opendata/7707329152-rsmp/data-10092026-structure-12052026.zip'

async function main() {
  const opts = parseArgs()
  const prefixes = parseOkvedPrefixes(process.env.PS_PRO_OKVED_PREFIXES)

  console.log(`[MSP Import] Профильные префиксы ОКВЭД: ${prefixes.join(', ')}`)
  console.log(`[MSP Import] Режим: ${opts.apply ? 'APPLY (запись в БД)' : 'DRY RUN (только подсчёт)'}`)

  let zipPath: string
  let sourceUrl: string

  try {
    if (opts.file) {
      if (!fs.existsSync(opts.file)) {
        throw new Error(`Файл не найден: ${opts.file}`)
      }
      zipPath = opts.file
      sourceUrl = `file:${opts.file}`
      console.log(`[MSP Import] Используется локальный файл: ${zipPath}`)
    } else {
      const url = opts.url || DEFAULT_URL
      sourceUrl = url
      console.log(`[MSP Import] Скачивание архива: ${url}`)
      zipPath = await downloadZip(url)
    }

    const stats = await importZip(zipPath, prefixes, opts.apply, sourceUrl)
    printReport(stats, opts.apply)

    process.exit(0)
  } catch (err) {
    console.error(`[MSP Import] ОШИБКА: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  } finally {
    if (zipPath && !opts.keepZip && opts.file === undefined) {
      try {
        fs.unlinkSync(zipPath)
      } catch (e) {
        // молча игнорируем ошибку удаления
      }
    }
    await db.$disconnect()
  }
}

async function downloadZip(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tmpDir = process.env.PS_MSP_TMP_DIR || os.tmpdir()
    const tmpPath = path.join(tmpDir, `msp-${Date.now()}.zip`)

    const file = fs.createWriteStream(tmpPath)
    let contentLength = 0
    let downloadedBytes = 0
    let lastReportedPercent = 0

    https
      .get(url, { timeout: 60000 }, (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`))
          return
        }

        contentLength = parseInt(res.headers['content-length'] || '0', 10)

        res.on('data', (chunk) => {
          downloadedBytes += chunk.length
          const percent = contentLength > 0 ? Math.floor((downloadedBytes / contentLength) * 100) : 0

          // Печатаем прогресс каждые 5%
          if (percent >= lastReportedPercent + 5) {
            console.log(`[MSP Download] ${percent}%...`)
            lastReportedPercent = percent
          }
        })

        res.pipe(file)
      })
      .on('error', (err) => {
        fs.unlinkSync(tmpPath)
        reject(new Error(`Download failed: ${err.message}`))
      })

    file.on('finish', () => {
      file.close()

      // Проверяем размер
      const stats = fs.statSync(tmpPath)
      if (contentLength > 0 && stats.size !== contentLength) {
        fs.unlinkSync(tmpPath)
        reject(
          new Error(
            `Size mismatch: expected ${contentLength} bytes, got ${stats.size} bytes`
          )
        )
        return
      }

      console.log(`[MSP Download] 100%. Размер: ${(stats.size / 1024 / 1024).toFixed(2)} МБ`)
      resolve(tmpPath)
    })

    file.on('error', (err) => {
      fs.unlinkSync(tmpPath)
      reject(new Error(`Write failed: ${err.message}`))
    })
  })
}

interface ImportStats {
  releaseDate: Date
  scanned: number
  matched: number
  byPrefix: Record<string, number>
  examples: Array<{ inn: string; name: string }>
}

async function importZip(
  zipPath: string,
  prefixes: string[],
  shouldApply: boolean,
  sourceUrl: string
): Promise<ImportStats> {
  const stats: ImportStats = {
    releaseDate: new Date(),
    scanned: 0,
    matched: 0,
    byPrefix: {},
    examples: [],
  }

  const records: RegistryRecord[] = []
  const prefixHits: Record<string, Set<string>> = {}
  prefixes.forEach((p) => {
    prefixHits[p] = new Set()
  })

  // Лениво открываем zip и парсим каждый XML
  const zip = await new Promise<yauzl.ZipFile>((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, z) => {
      if (err) reject(err)
      else resolve(z)
    })
  })

  await new Promise<void>((resolve, reject) => {
    zip.on('entry', async (entry: yauzl.Entry) => {
      if (!entry.fileName.endsWith('.xml')) {
        zip.readEntry()
        return
      }

      const stream = await new Promise<Readable>((res, rej) => {
        zip.openReadStream(entry, (err, s) => {
          if (err) rej(err)
          else res(s)
        })
      })

      // Читаем кодировку из XML-декларации
      const decoder = new TextDecodingStream()
      stream.pipe(decoder as any)

      try {
        await parseMspXml(decoder as any, (record) => {
          stats.scanned++

          if (isProfileOkved(record.okveds, prefixes)) {
            stats.matched++
            records.push(record)

            // Запоминаем какой префикс совпал
            for (const code of record.okveds) {
              for (const prefix of prefixes) {
                if (code === prefix || code.startsWith(prefix + '.')) {
                  prefixHits[prefix].add(record.inn)
                  break
                }
              }
            }

            // Первые 5 примеров
            if (stats.examples.length < 5) {
              stats.examples.push({ inn: maskInn(record.inn), name: record.name })
            }

            // Сохраняем дату из первой профильной записи
            if (stats.scanned === 1 || record.releaseDate > stats.releaseDate) {
              stats.releaseDate = record.releaseDate
            }
          }
        })
      } catch (err) {
        reject(new Error(`Parse error in ${entry.fileName}: ${err instanceof Error ? err.message : String(err)}`))
        return
      }

      zip.readEntry()
    })

    zip.on('end', () => {
      resolve()
    })

    zip.on('error', reject)

    zip.readEntry()
  })

  // Считаем по префиксам
  prefixes.forEach((p) => {
    stats.byPrefix[p] = prefixHits[p].size
  })

  // Если --apply, пишем в БД
  if (shouldApply && records.length > 0) {
    await writeToDb(records, stats.releaseDate, sourceUrl, stats.scanned)
  }

  return stats
}

async function writeToDb(
  records: RegistryRecord[],
  releaseDate: Date,
  sourceUrl: string,
  scanned: number
): Promise<void> {
  console.log(`[MSP Import] Запись ${records.length} записей в БД...`)

  // Одна транзакция для всего
  await db.$transaction(async (tx) => {
    // Удаляем старые записи
    const deleted = await tx.registryProfile.deleteMany({})
    console.log(`[MSP Import] Удалено старых записей: ${deleted.count}`)

    // Пишем пачками по 1000 (лимит параметров Postgres)
    const batchSize = 1000
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, Math.min(i + batchSize, records.length))
      await tx.registryProfile.createMany({
        data: batch.map((r) => ({
          inn: r.inn,
          ogrn: r.ogrn,
          kind: r.kind,
          name: r.name,
          okvedMain: r.okvedMain,
          okveds: r.okveds,
          releaseDate: r.releaseDate,
        })),
      })
      console.log(`[MSP Import] Записано ${Math.min(i + batchSize, records.length)} / ${records.length}`)
    }

    // Записываем информацию о выпуске
    await tx.registryRelease.create({
      data: {
        sourceUrl,
        releaseDate,
        scanned,
        matched: records.length,
      },
    })
  },
  // У интерактивной транзакции Prisma по умолчанию 5 секунд — десятки тысяч
  // строк пачками в них не укладываются, и импорт откатывался бы целиком.
  { timeout: 10 * 60_000, maxWait: 30_000 })

  console.log(`[MSP Import] ✓ Данные успешно записаны в БД`)
}

function printReport(stats: ImportStats, applied: boolean) {
  console.log('\n' + '='.repeat(60))
  console.log('ОТЧЁТ ИМПОРТА РЕЕСТРА МСП')
  console.log('='.repeat(60))
  console.log(`Дата состояния: ${stats.releaseDate.toLocaleDateString('ru-RU')}`)
  console.log(`Всего документов прочитано: ${stats.scanned}`)
  console.log(`Профильных найдено: ${stats.matched}`)
  console.log()
  console.log('По префиксам:')
  Object.entries(stats.byPrefix)
    .sort()
    .forEach(([prefix, count]) => {
      console.log(`  ${prefix}: ${count}`)
    })
  console.log()
  console.log('Первые 5 примеров:')
  stats.examples.forEach((ex, i) => {
    console.log(`  ${i + 1}. ${ex.name} (ИНН ${ex.inn})`)
  })
  console.log()
  console.log(applied ? '✓ Данные записаны в БД' : 'ⓘ Сухой прогон (БД не изменена)')
  console.log('='.repeat(60))
}

function maskInn(inn: string): string {
  // Оставляем первые 4 и последние 2 цифры
  if (inn.length <= 6) return inn
  return inn.slice(0, 4) + '*'.repeat(inn.length - 6) + inn.slice(-2)
}

function parseArgs(): Options {
  const args = process.argv.slice(2)
  const opts: Options = {
    apply: false,
    keepZip: false,
  }

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--url' && i + 1 < args.length) {
      opts.url = args[i + 1]
      i++
    } else if (args[i] === '--file' && i + 1 < args.length) {
      opts.file = args[i + 1]
      i++
    } else if (args[i] === '--apply') {
      opts.apply = true
    } else if (args[i] === '--keep-zip') {
      opts.keepZip = true
    }
  }

  return opts
}

// Вспомогательный stream для детектирования кодировки из XML-декларации
class TextDecodingStream extends Transform {
  private decoder: TextDecoder | null = null
  private headerBuffer = Buffer.alloc(0)
  private headerProcessed = false

  _transform(chunk: Buffer, encoding: string, callback: Function) {
    if (!this.headerProcessed) {
      this.headerBuffer = Buffer.concat([this.headerBuffer, chunk])

      // Ищем конец XML-декларации
      const headerEnd = this.headerBuffer.indexOf('?>')
      if (headerEnd !== -1) {
        const headerStr = this.headerBuffer.slice(0, headerEnd + 2).toString('utf-8', 0, Math.min(200, headerEnd + 2))
        const encodingMatch = headerStr.match(/encoding\s*=\s*["']([^"']+)["']/i)
        const encoding = encodingMatch ? encodingMatch[1] : 'utf-8'

        this.decoder = new TextDecoder(encoding, { fatal: false })
        this.headerProcessed = true

        // Декодируем всё, включая заголовок
        const result = this.decoder.decode(this.headerBuffer, { stream: true })
        this.headerBuffer = Buffer.alloc(0)
        this.push(result)
      }
    } else if (this.decoder) {
      const result = this.decoder.decode(chunk, { stream: true })
      this.push(result)
    }

    callback()
  }

  _flush(callback: Function) {
    if (this.decoder) {
      const result = this.decoder.decode(new Uint8Array(0))
      if (result) this.push(result)
    }
    callback()
  }
}

main().catch(console.error)
