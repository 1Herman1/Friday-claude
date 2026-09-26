// Потоковый парсер XML реестра МСП ФНС через SAX (без построения дерева в памяти).

import { Readable } from 'stream'
import * as sax from 'sax'

export enum RegistryKind {
  Legal = 'legal',
  Individual = 'individual',
}

export interface RegistryRecord {
  inn: string
  ogrn: string
  kind: RegistryKind
  name: string
  okvedMain: string | null
  okveds: string[]
  releaseDate: Date
}

interface CurrentDocument {
  inn?: string
  ogrn?: string
  kind?: RegistryKind
  name?: string
  okvedMain?: string
  okveds: Set<string>
  releaseDate?: Date
}

/**
 * Парсит XML-поток реестра МСП (sax strict, без валидации DTD).
 * Вызывает onDocument для каждого найденного документа.
 * Кодировка XML читается из объявления в начале файла (детектируется автоматически).
 *
 * @param stream - Readable поток XML-файла
 * @param onDocument - callback(record), вызывается с нормализованным документом
 */
export async function parseMspXml(
  stream: Readable,
  onDocument: (record: RegistryRecord) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const parser = sax.parser(true, { lowercase: false })
    let currentDoc: CurrentDocument | null = null
    let inOkved = false

    parser.onopentag = (node: { name: string; attributes: Record<string, any> }) => {
      const tag = node.name
      const attrs = node.attributes

      // Новый документ
      if (tag === 'Документ') {
        // Завершаем предыдущий, если был
        if (currentDoc && currentDoc.inn && currentDoc.releaseDate) {
          const record = buildRecord(currentDoc)
          if (record) {
            onDocument(record)
          }
        }
        currentDoc = { okveds: new Set() }

        // Читаем дату состояния из Документа
        const dataSost = attrs.ДатаСост
        if (dataSost && currentDoc) {
          const [day, month, year] = dataSost.split('.').map(Number)
          currentDoc.releaseDate = new Date(year, month - 1, day)
        }
        return
      }

      if (!currentDoc) return

      // Юрлицо
      if (tag === 'ОргВклМСП') {
        const наимОрг = attrs.НаимОрг || ''
        const наимОргСокр = attrs.НаимОргСокр
        currentDoc.name = наимОргСокр || наимОрг
        currentDoc.inn = attrs.ИННЮЛ
        currentDoc.ogrn = attrs.ОГРН
        currentDoc.kind = RegistryKind.Legal
        return
      }

      // ИП
      if (tag === 'ИПВклМСП') {
        currentDoc.inn = attrs.ИННФЛ
        currentDoc.ogrn = attrs.ОГРНИП
        currentDoc.kind = RegistryKind.Individual
        return
      }

      // ФИО для ИП
      if (tag === 'ФИОИП' && currentDoc.kind === RegistryKind.Individual) {
        const фамилия = attrs.Фамилия || ''
        const имя = attrs.Имя || ''
        const отчество = attrs.Отчество || ''
        // Форматируем: "ИП Фамилия И. О."
        const иницИ = имя ? имя[0] + '.' : ''
        const иницО = отчество ? отчество[0] + '.' : ''
        const иниц = [иницИ, иницО].filter(Boolean).join(' ')
        currentDoc.name = `ИП ${фамилия}${иниц ? ' ' + иниц : ''}`
        return
      }

      // Начало блока ОКВЭД
      if (tag === 'СвОКВЭД') {
        inOkved = true
        return
      }

      // Основной ОКВЭД
      if (tag === 'СвОКВЭДОсн' && inOkved) {
        const версОКВЭД = attrs.ВерсОКВЭД
        if (версОКВЭД === '2014') {
          const код = attrs.КодОКВЭД
          if (код) {
            currentDoc.okvedMain = код
            currentDoc.okveds.add(код)
          }
        }
        return
      }

      // Дополнительный ОКВЭД
      if (tag === 'СвОКВЭДДоп' && inOkved) {
        const версОКВЭД = attrs.ВерсОКВЭД
        if (версОКВЭД === '2014') {
          const код = attrs.КодОКВЭД
          if (код) {
            currentDoc.okveds.add(код)
          }
        }
        return
      }
    }

    parser.onclosetag = (tagName: string) => {
      if (tagName === 'СвОКВЭД') {
        inOkved = false
      }
    }

    parser.onerror = (err: Error) => {
      reject(new Error(`XML parse error: ${err.message}`))
    }

    parser.onend = () => {
      // Завершаем последний документ
      if (currentDoc && currentDoc.inn && currentDoc.releaseDate) {
        const record = buildRecord(currentDoc)
        if (record) {
          onDocument(record)
        }
      }
      resolve()
    }

    stream.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf-8')
      parser.write(text)
    })

    stream.on('end', () => {
      parser.close()
    })

    stream.on('error', (err: Error) => {
      reject(err)
    })
  })
}

function buildRecord(doc: CurrentDocument): RegistryRecord | null {
  if (!doc.inn || !doc.ogrn || !doc.kind || !doc.name || !doc.releaseDate) {
    return null
  }

  return {
    inn: doc.inn,
    ogrn: doc.ogrn,
    kind: doc.kind,
    name: doc.name,
    okvedMain: doc.okvedMain || null,
    okveds: Array.from(doc.okveds),
    releaseDate: doc.releaseDate,
  }
}
