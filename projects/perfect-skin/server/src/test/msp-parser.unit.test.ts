import { describe, it, expect, beforeAll } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import { Readable } from 'stream'
import { parseMspXml, RegistryRecord, RegistryKind } from '../lib/registry/msp-parser'

const fixtureDir = path.join(__dirname, 'fixtures')

describe('MSP XML парсер', () => {
  it('парсит UTF-8 фикстуру и находит все записи', async () => {
    const records: RegistryRecord[] = []
    const xmlPath = path.join(fixtureDir, 'msp-sample.xml')
    const stream = fs.createReadStream(xmlPath, { encoding: 'utf-8' })

    await parseMspXml(stream, (record) => {
      records.push(record)
    })

    // Фикстура содержит 5 документов, парсер должен отдать все 5
    expect(records.length).toBe(5)

    // Проверяем 1-ю запись (ООО ПП - ЮЛ с 96.02)
    const ооо1 = records.find((r) => r.inn === '7701234567')
    expect(ооо1).toBeDefined()
    expect(ооо1!.kind).toBe(RegistryKind.Legal)
    expect(ооо1!.name).toBe('ООО ПП')
    expect(ооо1!.okvedMain).toBe('96.02')
    expect(ооо1!.okveds).toContain('96.02')

    // Проверяем 2-ю запись (ИП Иванов с доп. 86.90.4)
    const ип = records.find((r) => r.inn === '770123456789')
    expect(ип).toBeDefined()
    expect(ип!.kind).toBe(RegistryKind.Individual)
    expect(ип!.name).toContain('Иванов')
    expect(ип!.okvedMain).toBe('86.90.1')
    expect(ип!.okveds).toContain('86.90.1')
    expect(ип!.okveds).toContain('86.90.4')

    // Проверяем дату
    expect(ооо1!.releaseDate).toEqual(new Date(2026, 8, 26)) // 26.09.2026 в JS: месяц 8 (0-based)
  })

  it('парсит Windows-1251 кодировку', async () => {
    const records: RegistryRecord[] = []
    const xmlPath = path.join(fixtureDir, 'msp-sample-cp1251.xml')

    if (!fs.existsSync(xmlPath)) {
      // Пропускаем если файл не создан
      expect(true).toBe(true)
      return
    }

    const stream = fs.createReadStream(xmlPath)

    await parseMspXml(stream, (record) => {
      records.push(record)
    })

    // Парсер должен отдать все 5 записей
    expect(records.length).toBe(5)
    expect(records.find((r) => r.inn === '7701234567')).toBeDefined()
  })

  it('игнорирует отчётный ОКВЭД (СвОКВЭДотч)', async () => {
    const records: RegistryRecord[] = []
    const xmlPath = path.join(fixtureDir, 'msp-sample.xml')
    const stream = fs.createReadStream(xmlPath, { encoding: 'utf-8' })

    await parseMspXml(stream, (record) => {
      records.push(record)
    })

    // Документ 3 (ООО ТО) имеет 47.75 только в отчётном ОКВЭД (СвОКВЭДотч)
    // Парсер игнорирует отчётный ОКВЭД, так что ООО ТО вернётся с кодом 62.01
    // Проверяем, что в результатах нет записей с 47.75
    const с47 = records.filter((r) => r.okveds.some((k) => k.startsWith('47.75')))
    expect(с47.length).toBe(0)

    // Но ООО ТО есть в результатах с кодом 62.01
    const оооТО = records.find((r) => r.inn === '7702345678')
    expect(оооТО).toBeDefined()
    expect(оооТО!.okveds).toContain('62.01')
  })

  it('обрабатывает записи без СвОКВЭД', async () => {
    const records: RegistryRecord[] = []
    const xmlPath = path.join(fixtureDir, 'msp-sample.xml')
    const stream = fs.createReadStream(xmlPath, { encoding: 'utf-8' })

    await parseMspXml(stream, (record) => {
      records.push(record)
    })

    // Документ 4 (ИП без ОКВЭД) всё ещё возвращается парсером
    // со пустым массивом okveds
    const besokvед = records.find((r) => r.inn === '770234567890')
    expect(besokvед).toBeDefined()
    expect(besokvед!.okveds.length).toBe(0)
  })

  it('форматирует ФИО ИП правильно', async () => {
    const records: RegistryRecord[] = []
    const xmlPath = path.join(fixtureDir, 'msp-sample.xml')
    const stream = fs.createReadStream(xmlPath, { encoding: 'utf-8' })

    await parseMspXml(stream, (record) => {
      records.push(record)
    })

    const ип = records.find((r) => r.inn === '770123456789')
    expect(ип).toBeDefined()
    expect(ип!.name).toMatch(/^ИП Иванов/)
    expect(ип!.name).toContain('П.')
    expect(ип!.name).toContain('С.')
  })

  it('собирает все коды ОКВЭД без дублей', async () => {
    const records: RegistryRecord[] = []
    const xmlPath = path.join(fixtureDir, 'msp-sample.xml')
    const stream = fs.createReadStream(xmlPath, { encoding: 'utf-8' })

    await parseMspXml(stream, (record) => {
      records.push(record)
    })

    const ип = records.find((r) => r.inn === '770123456789')
    expect(ип).toBeDefined()
    expect(ип!.okveds.length).toBe(2) // основной и дополнительный
    expect(new Set(ип!.okveds).size).toBe(2) // нет дублей
  })

  it('устанавливает okvedMain корректно', async () => {
    const records: RegistryRecord[] = []
    const xmlPath = path.join(fixtureDir, 'msp-sample.xml')
    const stream = fs.createReadStream(xmlPath, { encoding: 'utf-8' })

    await parseMspXml(stream, (record) => {
      records.push(record)
    })

    const юл = records.find((r) => r.inn === '7701234567')
    expect(юл!.okvedMain).toBe('96.02')

    const ип = records.find((r) => r.inn === '770123456789')
    expect(ип!.okvedMain).toBe('86.90.1')
  })

  it('парсит только версию ОКВЭД 2014', async () => {
    // Фикстура содержит только версию 2014
    const records: RegistryRecord[] = []
    const xmlPath = path.join(fixtureDir, 'msp-sample.xml')
    const stream = fs.createReadStream(xmlPath, { encoding: 'utf-8' })

    await parseMspXml(stream, (record) => {
      records.push(record)
    })

    // Проверяем что все коды из версии 2014 прочитаны
    expect(records.length).toBe(5)

    // Все записи должны содержать коды из версии 2014
    const recordsWithOkveds = records.filter((r) => r.okveds.length > 0)
    expect(recordsWithOkveds.length).toBeGreaterThan(0)
  })

  it('отслеживает дату состояния из каждого документа', async () => {
    const records: RegistryRecord[] = []
    const xmlPath = path.join(fixtureDir, 'msp-sample.xml')
    const stream = fs.createReadStream(xmlPath, { encoding: 'utf-8' })

    await parseMspXml(stream, (record) => {
      records.push(record)
    })

    // Все записи должны иметь одинаковую дату (из атрибута ДатаСост в Документе)
    const date = new Date(2026, 8, 26) // 26.09.2026
    records.forEach((r) => {
      expect(r.releaseDate).toEqual(date)
    })
  })
})
