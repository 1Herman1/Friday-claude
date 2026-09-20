import fs from 'fs'
import path from 'path'
import os from 'os'
import { db } from '../lib/db.js'
import { recalcProductPrices } from './product-prices.js'
import { ApiError } from '../lib/errors.js'

interface ParsedCatalogItem {
  sku?: string
  externalId?: string
  quantity: number
  price: number
}

interface ParsedOrderItem {
  sku?: string
  externalId?: string
  quantity: number
  price: number
}

interface ParsedOrder {
  id: string
  number: string
  date: string
  recipientName: string
  recipientPhone: string
  recipientEmail?: string
  total: number
  items: ParsedOrderItem[]
}

export class Exchange1CService {
  private inboxDir: string

  constructor() {
    const baseDir = os.tmpdir()
    this.inboxDir = path.join(baseDir, 'ps-1c')
    if (!fs.existsSync(this.inboxDir)) {
      fs.mkdirSync(this.inboxDir, { recursive: true })
    }
  }

  /**
   * Сохраняет XML-файл во временный каталог.
   */
  saveXmlFile(filename: string, content: string): void {
    const filepath = path.join(this.inboxDir, filename)
    fs.writeFileSync(filepath, content, 'utf-8')
  }

  /**
   * Читает и парсит XML-файл. Простой парсинг без новых зависимостей.
   */
  private parseXml(xmlContent: string): { catalog?: ParsedCatalogItem[]; orders?: ParsedOrder[] } {
    const result: { catalog?: ParsedCatalogItem[]; orders?: ParsedOrder[] } = {}

    // Парсим товары (режим импорта каталога)
    if (xmlContent.includes('<Товар>')) {
      const items: ParsedCatalogItem[] = []
      const itemRegex = /<Товар>([\s\S]*?)<\/Товар>/g
      let match

      while ((match = itemRegex.exec(xmlContent)) !== null) {
        const itemXml = match[1]

        // Извлекаем Артикул
        const skuMatch = /<Артикул[^>]*>(.*?)<\/Артикул>/i.exec(itemXml)
        const sku = skuMatch ? skuMatch[1].trim() : undefined

        // Извлекаем Ид (externalId)
        const idMatch = /<Ид[^>]*>(.*?)<\/Ид>/i.exec(itemXml)
        const externalId = idMatch ? idMatch[1].trim() : undefined

        // Извлекаем Количество
        const qtyMatch = /<Количество[^>]*>(.*?)<\/Количество>/i.exec(itemXml)
        const quantity = qtyMatch ? parseInt(qtyMatch[1].trim(), 10) || 0 : 0

        // Извлекаем цену из Цены/ЦенаЗаЕдиницу
        let price = 0
        const priceMatch = /<ЦенаЗаЕдиницу[^>]*>(.*?)<\/ЦенаЗаЕдиницу>/i.exec(itemXml)
        if (priceMatch) {
          const priceStr = priceMatch[1].trim()
          price = Math.round(parseFloat(priceStr) * 100) // копейки
        }

        if (sku || externalId) {
          items.push({ sku, externalId, quantity, price })
        }
      }
      if (items.length > 0) {
        result.catalog = items
      }
    }

    // Парсим заказы (режим выгрузки)
    if (xmlContent.includes('<Документ>')) {
      const orders: ParsedOrder[] = []
      const docRegex = /<Документ>([\s\S]*?)<\/Документ>/g
      let match

      while ((match = docRegex.exec(xmlContent)) !== null) {
        const docXml = match[1]

        // Ид заказа
        const idMatch = /<Ид[^>]*>(.*?)<\/Ид>/i.exec(docXml)
        const id = idMatch ? idMatch[1].trim() : ''

        // Номер заказа
        const numberMatch = /<Номер[^>]*>(.*?)<\/Номер>/i.exec(docXml)
        const number = numberMatch ? numberMatch[1].trim() : ''

        // Дата
        const dateMatch = /<Дата[^>]*>(.*?)<\/Дата>/i.exec(docXml)
        const date = dateMatch ? dateMatch[1].trim() : ''

        // Сумма (итог)
        const sumMatch = /<Сумма[^>]*>(.*?)<\/Сумма>/i.exec(docXml)
        const total = sumMatch ? Math.round(parseFloat(sumMatch[1].trim()) * 100) : 0

        // Контрагент
        let recipientName = ''
        let recipientPhone = ''
        let recipientEmail: string | undefined

        const contragentMatch = /<Контрагент>([\s\S]*?)<\/Контрагент>/i.exec(docXml)
        if (contragentMatch) {
          const contragentXml = contragentMatch[1]
          const nameMatch = /<Наименование[^>]*>(.*?)<\/Наименование>/i.exec(contragentXml)
          if (nameMatch) {
            recipientName = nameMatch[1].trim()
          }
          const phoneMatch = /<Телефон[^>]*>(.*?)<\/Телефон>/i.exec(contragentXml)
          if (phoneMatch) {
            recipientPhone = phoneMatch[1].trim()
          }
          const emailMatch = /<Email[^>]*>(.*?)<\/Email>/i.exec(contragentXml)
          if (emailMatch) {
            recipientEmail = emailMatch[1].trim()
          }
        }

        // Товары в заказе
        const items: ParsedOrderItem[] = []
        const lineRegex = /<Товар>([\s\S]*?)<\/Товар>/g
        let lineMatch
        while ((lineMatch = lineRegex.exec(docXml)) !== null) {
          const lineXml = lineMatch[1]
          const lineSku = /<Артикул[^>]*>(.*?)<\/Артикул>/i.exec(lineXml)?.at(1)?.trim()
          const lineExtId = /<Ид[^>]*>(.*?)<\/Ид>/i.exec(lineXml)?.at(1)?.trim()
          const lineQty = parseInt(/<Количество[^>]*>(.*?)<\/Количество>/i.exec(lineXml)?.at(1)?.trim() || '0', 10)
          const linePrice = Math.round(parseFloat(/<ЦенаЗаЕдиницу[^>]*>(.*?)<\/ЦенаЗаЕдиницу>/i.exec(lineXml)?.at(1)?.trim() || '0') * 100)

          if (lineSku || lineExtId) {
            items.push({ sku: lineSku, externalId: lineExtId, quantity: lineQty, price: linePrice })
          }
        }

        orders.push({
          id,
          number,
          date,
          recipientName,
          recipientPhone,
          recipientEmail,
          total,
          items,
        })
      }
      if (orders.length > 0) {
        result.orders = orders
      }
    }

    return result
  }

  /**
   * Применяет импорт каталога: обновляет остатки и цены существующих вариантов.
   */
  async importCatalog(xmlContent: string): Promise<{ imported: number; skipped: number; error?: string }> {
    const { catalog } = this.parseXml(xmlContent)
    if (!catalog || catalog.length === 0) {
      return { imported: 0, skipped: 0, error: 'No catalog items found in XML' }
    }

    let imported = 0
    let skipped = 0

    try {
      await db.$transaction(async (tx) => {
        const productIds = new Set<string>()

        for (const item of catalog) {
          let variant = null

          if (item.externalId) {
            variant = await tx.productVariant.findUnique({
              where: { externalId: item.externalId },
            })
          }

          if (!variant && item.sku) {
            variant = await tx.productVariant.findUnique({
              where: { sku: item.sku },
            })
          }

          if (!variant) {
            skipped++
            continue
          }

          // Обновляем только stock и retailPrice
          await tx.productVariant.update({
            where: { id: variant.id },
            data: {
              stock: item.quantity,
              retailPrice: item.price,
            },
          })

          productIds.add(variant.productId)
          imported++
        }

        // Пересчитываем minPrice/maxPrice для затронутых товаров
        for (const productId of productIds) {
          await recalcProductPrices(tx, productId)
        }
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      throw new ApiError(500, 'IMPORT_ERROR', `Ошибка импорта: ${msg}`)
    }

    return { imported, skipped }
  }

  /**
   * Выгружает заказы в CommerceML XML.
   */
  async exportOrders(): Promise<string> {
    const orders = await db.order.findMany({
      where: {
        status: { in: ['new', 'confirmed'] },
      },
      include: {
        items: {
          include: {
            productVariant: true,
            product: {
              include: { brand: true },
            },
          },
        },
        user: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n'
    xml += '<КоммерческаяИнформация>\n'
    xml += '  <Документы>\n'

    for (const order of orders) {
      xml += '    <Документ>\n'
      xml += `      <Ид>${escapeXml(order.id)}</Ид>\n`
      xml += `      <Номер>${escapeXml(order.number)}</Номер>\n`
      xml += `      <Дата>${order.createdAt.toISOString().split('T')[0]}</Дата>\n`
      xml += `      <Сумма>${(order.total / 100).toFixed(2)}</Сумма>\n`
      xml += '      <Контрагент>\n'
      xml += `        <Наименование>${escapeXml(order.recipientName)}</Наименование>\n`
      xml += `        <Телефон>${escapeXml(order.recipientPhone)}</Телефон>\n`
      if (order.recipientEmail) {
        xml += `        <Email>${escapeXml(order.recipientEmail)}</Email>\n`
      }
      xml += '      </Контрагент>\n'
      xml += '      <Товары>\n'

      for (const item of order.items) {
        xml += '        <Товар>\n'
        xml += `          <Ид>${escapeXml(item.productVariant.externalId || item.productVariant.sku || item.productVariantId)}</Ид>\n`
        xml += `          <Количество>${item.quantity}</Количество>\n`
        xml += `          <ЦенаЗаЕдиницу>${(item.price / 100).toFixed(2)}</ЦенаЗаЕдиницу>\n`
        xml += '        </Товар>\n'
      }

      xml += '      </Товары>\n'
      xml += '    </Документ>\n'
    }

    xml += '  </Документы>\n'
    xml += '</КоммерческаяИнформация>\n'

    return xml
  }
}

function escapeXml(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

export const exchange1cService = new Exchange1CService()
