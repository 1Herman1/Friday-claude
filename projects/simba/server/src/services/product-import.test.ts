import { describe, it, expect } from 'vitest'
import * as XLSX from 'xlsx'
import {
  transliterate,
  parseAttributes,
  mapRow,
  parseCsvLine,
  parseRows,
  parseWeightFromName,
  detectBrand,
  isNonProductRow,
} from './product-import'

describe('transliterate', () => {
  it('переводит реальное название товара в латинский слаг', () => {
    expect(transliterate('Бальзам-кондиционер Muzzle для собак и кошек')).toBe(
      'balzam-kondicioner-muzzle-dlya-sobak-i-koshek'
    )
  })

  it('сохраняет латинские части в смешанном русско-латинском тексте', () => {
    expect(transliterate('Корм Royal Canin для кошек')).toBe('korm-royal-canin-dlya-koshek')
  })

  it('заменяет спецсимволы и лишние пробелы на одиночные дефисы', () => {
    expect(transliterate('  Шампунь  //  для   щенков!!!  ')).toBe('shampun-dlya-shchenkov')
  })

  it('схлопывает повторяющиеся дефисы в один', () => {
    expect(transliterate('Корм---премиум - - класс')).toBe('korm-premium-klass')
  })

  it('не оставляет дефисов по краям', () => {
    expect(transliterate('---Корм для собак---')).toBe('korm-dlya-sobak')
  })

  it('обрезает результат до 80 символов', () => {
    const long = 'Бальзам кондиционер для длинношерстных собак и кошек премиум класса с экстрактом алоэ'
    const slug = transliterate(long)
    expect(slug.length).toBeLessThanOrEqual(80)
    expect(slug.startsWith('balzam-kondicioner-dlya')).toBe(true)
  })

  it('на пустой строке возвращает пустую строку', () => {
    expect(transliterate('')).toBe('')
  })

  it('сохраняет цифры', () => {
    expect(transliterate('Корм 15 кг')).toBe('korm-15-kg')
  })
})

describe('parseAttributes', () => {
  it('отбрасывает пары с пустыми значениями (реальный файл пользователя)', () => {
    const raw: Record<string, string> = {
      'Название атрибута 1': 'вид',
      'Значение атрибута 1': '',
      'Название атрибута 2': 'вкус',
      'Значение атрибута 2': '',
      'Название атрибута 3': 'Возраст питомца',
      'Значение атрибута 3': '',
      'Название атрибута 4': 'Патология',
      'Значение атрибута 4': '',
      'Название атрибута 5': 'Страна-изготовитель',
      'Значение атрибута 5': '',
    }
    expect(parseAttributes(raw)).toEqual([])
  })

  it('распознаёт пары с заполненными значениями', () => {
    const raw: Record<string, string> = {
      'Название атрибута 1': 'вид',
      'Значение атрибута 1': 'собаки',
      'Название атрибута 2': 'вкус',
      'Значение атрибута 2': '',
      'Название атрибута 3': 'Страна-изготовитель',
      'Значение атрибута 3': 'Россия',
    }
    expect(parseAttributes(raw)).toEqual([
      { name: 'вид', value: 'собаки' },
      { name: 'Страна-изготовитель', value: 'Россия' },
    ])
  })

  it('работает с 7 атрибутами (без хардкода на 5)', () => {
    const raw: Record<string, string> = {}
    for (let i = 1; i <= 7; i++) {
      raw[`Название атрибута ${i}`] = `атрибут${i}`
      raw[`Значение атрибута ${i}`] = `значение${i}`
    }
    expect(parseAttributes(raw)).toHaveLength(7)
  })

  it('работает с 12 атрибутами (без хардкода на 5)', () => {
    const raw: Record<string, string> = {}
    for (let i = 1; i <= 12; i++) {
      raw[`Название атрибута ${i}`] = `атрибут${i}`
      raw[`Значение атрибута ${i}`] = `значение${i}`
    }
    const result = parseAttributes(raw)
    expect(result).toHaveLength(12)
    expect(result).toContainEqual({ name: 'атрибут12', value: 'значение12' })
  })

  it('отбрасывает полные дубликаты пар', () => {
    const raw: Record<string, string> = {
      'Название атрибута 1': 'вид',
      'Значение атрибута 1': 'собаки',
      'Название атрибута 2': 'вид',
      'Значение атрибута 2': 'собаки',
      'Название атрибута 3': 'вид',
      'Значение атрибута 3': 'кошки',
    }
    expect(parseAttributes(raw)).toEqual([
      { name: 'вид', value: 'собаки' },
      { name: 'вид', value: 'кошки' },
    ])
  })

  it('не ломается на пропуске в нумерации (есть 1 и 3, нет 2)', () => {
    const raw: Record<string, string> = {
      'Название атрибута 1': 'вид',
      'Значение атрибута 1': 'собаки',
      'Название атрибута 3': 'вкус',
      'Значение атрибута 3': 'курица',
    }
    expect(parseAttributes(raw)).toEqual([
      { name: 'вид', value: 'собаки' },
      { name: 'вкус', value: 'курица' },
    ])
  })

  it('игнорирует служебные колонки «Глобальный атрибут» и «Видимость атрибута»', () => {
    const raw: Record<string, string> = {
      'Название атрибута 1': 'вид',
      'Значение атрибута 1': 'собаки',
      'Глобальный атрибут 1': '1',
      'Видимость атрибута 1': '1',
      'Глобальный атрибут 2': '0',
      'Видимость атрибута 2': '0',
    }
    expect(parseAttributes(raw)).toEqual([{ name: 'вид', value: 'собаки' }])
  })

  it('обрезает пробелы вокруг названия и значения', () => {
    const raw: Record<string, string> = {
      'Название атрибута 1': '  вид  ',
      'Значение атрибута 1': '  собаки  ',
      'Название атрибута 2': 'вкус',
      'Значение атрибута 2': '   ',
    }
    expect(parseAttributes(raw)).toEqual([{ name: 'вид', value: 'собаки' }])
  })

  it('на строке без атрибутивных колонок возвращает пустой массив', () => {
    expect(parseAttributes({ 'Имя': 'Корм', 'Артикул': 'A-1' })).toEqual([])
  })
})

describe('mapRow — русский формат', () => {
  const base = () => ({
    'Имя': 'Бальзам-кондиционер Muzzle',
    'Артикул': 'MZ-001',
  }) as Record<string, string>

  it('читает Имя, Артикул и Наименование', () => {
    const row = mapRow({ ...base(), 'Наименование': 'Описание товара' })
    expect(row.name).toBe('Бальзам-кондиционер Muzzle')
    expect(row.sku).toBe('MZ-001')
    expect(row.description).toBe('Описание товара')
  })

  it('подставляет имя в описание, если Наименование пустое', () => {
    const row = mapRow({ ...base(), 'Наименование': '   ' })
    expect(row.description).toBe('Бальзам-кондиционер Muzzle')
  })

  it('понимает запятую как десятичный разделитель в цене', () => {
    const row = mapRow({ ...base(), 'Базовая цена': '1299,50' })
    expect(row.price).toBe(1299.5)
    expect(row.oldPrice).toBeUndefined()
  })

  it('при двух ценах меньшая становится price, большая — oldPrice', () => {
    const row = mapRow({ ...base(), 'Базовая цена': '1299,50', 'Акционная цена': '999' })
    expect(row.price).toBe(999)
    expect(row.oldPrice).toBe(1299.5)
  })

  it('правило двух цен не зависит от того, в какой колонке большее значение', () => {
    const row = mapRow({ ...base(), 'Базовая цена': '500', 'Акционная цена': '1500' })
    expect(row.price).toBe(500)
    expect(row.oldPrice).toBe(1500)
  })

  it('поддерживает колонку «Цена» как запасную для базовой цены', () => {
    const row = mapRow({ ...base(), 'Цена': '350,25' })
    expect(row.price).toBe(350.25)
  })

  it('разбирает Категории по запятой с тримом', () => {
    const row = mapRow({ ...base(), 'Категории': ' Собаки, Уход за шерстью ,Шампуни, ' })
    expect(row.categories).toEqual(['Собаки', 'Уход за шерстью', 'Шампуни'])
  })

  it('разбирает Изображения по запятой с тримом', () => {
    const row = mapRow({
      ...base(),
      'Изображения': 'https://cdn.ru/a.jpg , https://cdn.ru/b.jpg',
    })
    expect(row.images).toEqual(['https://cdn.ru/a.jpg', 'https://cdn.ru/b.jpg'])
  })

  it('без категорий и изображений отдаёт пустые массивы', () => {
    const row = mapRow(base())
    expect(row.categories).toEqual([])
    expect(row.images).toEqual([])
  })

  it('без цены и веса отдаёт undefined, а не 0 и не NaN', () => {
    const row = mapRow(base())
    expect(row.price).toBeUndefined()
    expect(row.oldPrice).toBeUndefined()
    expect(row.weight).toBeUndefined()
  })

  it('читает вес с запятой в качестве разделителя', () => {
    const row = mapRow({ ...base(), 'Вес (kg)': '0,45' })
    expect(row.weight).toBe(0.45)
  })

  it('на пустой строке остатка отдаёт stock = 0', () => {
    expect(mapRow(base()).stock).toBe(0)
    expect(mapRow({ ...base(), 'Запасы': '' }).stock).toBe(0)
  })

  it('читает остаток из «Запасы»', () => {
    expect(mapRow({ ...base(), 'Запасы': '17' }).stock).toBe(17)
  })

  it('читает бренд из «Бренд» или «Производитель»', () => {
    expect(mapRow({ ...base(), 'Бренд': 'Muzzle' }).brandName).toBe('Muzzle')
    expect(mapRow({ ...base(), 'Производитель': 'Мужжл' }).brandName).toBe('Мужжл')
    expect(mapRow(base()).brandName).toBeUndefined()
  })

  it('пустой артикул превращается в undefined, а не в пустую строку', () => {
    expect(mapRow({ 'Имя': 'Корм', 'Артикул': '  ' }).sku).toBeUndefined()
  })

  it('подтягивает атрибуты из той же строки', () => {
    const row = mapRow({
      ...base(),
      'Название атрибута 1': 'вид',
      'Значение атрибута 1': 'собаки',
      'Название атрибута 2': 'вкус',
      'Значение атрибута 2': '',
    })
    expect(row.attributes).toEqual([{ name: 'вид', value: 'собаки' }])
  })
})

describe('mapRow — старый английский формат (защита от регресса)', () => {
  it('читает те же поля, что и раньше', () => {
    const row = mapRow({
      name: 'Muzzle Balm',
      slug: 'muzzle-balm',
      description: 'Conditioner for dogs',
      brandSlug: 'muzzle',
      price: '1299.50',
      oldPrice: '1599',
      stock: '12',
      weight: '0.45',
      sku: 'MZ-001',
    })
    expect(row).toEqual({
      name: 'Muzzle Balm',
      slug: 'muzzle-balm',
      description: 'Conditioner for dogs',
      brandSlug: 'muzzle',
      price: 1299.5,
      oldPrice: 1599,
      stock: 12,
      weight: 0.45,
      sku: 'MZ-001',
      categories: [],
      images: [],
      attributes: [],
    })
  })

  it('не переставляет price и oldPrice местами (правило двух цен — только для русского формата)', () => {
    const row = mapRow({ name: 'X', price: '1599', oldPrice: '999' })
    expect(row.price).toBe(1599)
    expect(row.oldPrice).toBe(999)
  })

  it('подставляет name в description, если description пустой', () => {
    expect(mapRow({ name: 'Muzzle Balm', description: '' }).description).toBe('Muzzle Balm')
  })

  it('без цены, старой цены и веса отдаёт undefined', () => {
    const row = mapRow({ name: 'X' })
    expect(row.price).toBeUndefined()
    expect(row.oldPrice).toBeUndefined()
    expect(row.weight).toBeUndefined()
    expect(row.stock).toBe(0)
    expect(row.sku).toBeUndefined()
    expect(row.slug).toBeUndefined()
  })
})

describe('parseWeightFromName — вес из хвоста названия', () => {
  it('читает граммы и переводит в килограммы', () => {
    expect(parseWeightFromName('Grandorf Adult Indoor - 400 гр')).toEqual({
      baseName: 'Grandorf Adult Indoor',
      weightKg: 0.4,
    })
  })

  it('читает килограммы', () => {
    expect(parseWeightFromName('Grandorf Adult Indoor - 8 кг').weightKg).toBe(8)
  })

  it('понимает запятую как десятичный разделитель', () => {
    expect(parseWeightFromName('Monge Cat Sterilised - 1,5 кг').weightKg).toBe(1.5)
    expect(parseWeightFromName('Muzzle Шампунь - 0,8 кг').weightKg).toBe(0.8)
  })

  it('умножает мультипак через звёздочку', () => {
    expect(parseWeightFromName('Влажный корм - 100 гр*12').weightKg).toBe(1.2)
  })

  it('умножает мультипак через кириллическую «х» со словом «шт»', () => {
    expect(parseWeightFromName('Влажный корм - 85 гр х 12 шт').weightKg).toBe(1.02)
  })

  it('умножает мультипак через латинскую «x» со словом «шт»', () => {
    expect(parseWeightFromName('Влажный корм - 300 гр x 6 шт').weightKg).toBe(1.8)
  })

  it('считает литр за килограмм', () => {
    expect(parseWeightFromName('Шампунь для собак - 1 л').weightKg).toBe(1)
  })

  it('переводит миллилитры в килограммы', () => {
    expect(parseWeightFromName('Лосьон для ушей - 250 мл').weightKg).toBe(0.25)
    expect(parseWeightFromName('Капли на холку - 30 мл').weightKg).toBe(0.03)
  })

  it('без весового суффикса возвращает имя целиком и weightKg undefined', () => {
    const name = 'Grandorf Kitten (Ягненок, индейка)'
    expect(parseWeightFromName(name)).toEqual({ baseName: name, weightKg: undefined })
  })

  it.each([
    'Многоразовая впитывающая пеленка для собак и кошек - 40х60',
    'Когтеточка деревянная - 605х205х225',
    'Muzzle Ошейник для собак - синий',
    'Muzzle Демисезонный дождевик для собак - горчица',
    'Muzzle Антипаразитарный биоошейник для собак и кошек - оранжевый',
  ])('не принимает за вес хвост «%s»', (name) => {
    expect(parseWeightFromName(name)).toEqual({ baseName: name, weightKg: undefined })
  })

  it('даёт один baseName для всех фасовок одного корма', () => {
    const expected = 'Grandorf Adult Indoor (Ягненок, индейка)'
    const variants = [
      'Grandorf Adult Indoor (Ягненок, индейка)',
      'Grandorf Adult Indoor (Ягненок, индейка) - 400 гр',
      'Grandorf Adult Indoor (Ягненок, индейка) - 2 кг',
      'Grandorf Adult Indoor (Ягненок, индейка) - 8 кг',
    ]
    const baseNames = variants.map(v => parseWeightFromName(v).baseName)
    expect(baseNames).toEqual([expected, expected, expected, expected])
    expect(new Set(baseNames).size).toBe(1)
  })

  it('режет только хвостовой вес, вес в середине названия сохраняет', () => {
    expect(parseWeightFromName('Farmina Vet Life Neutered + 10 кг Dog - 2 кг')).toEqual({
      baseName: 'Farmina Vet Life Neutered + 10 кг Dog',
      weightKg: 2,
    })
  })
})

describe('detectBrand — бренд по названию', () => {
  it.each([
    ['Farmina N&D Pumpkin GF Adult Mini (Тыква, ягненок, черника) - 7 кг', 'Farmina'],
    ['Happy Cat VET Diet Intestinal - 4 кг', 'Happy Cat'],
    ['Happy Dog Sensible Toscana (Утка, лосось)', 'Happy Dog'],
    ["Hill's Science Plan Adult Maxi (курица) - 14 кг", "Hill's"],
    ['Корм Farmina N&D LG Ocean Cat (Треска, тыква)', 'Farmina'],
    ['Monge Cat Sterilised - 1,5 кг', 'Monge'],
    ['Grandorf Kitten (Ягненок, индейка)', 'Grandorf'],
    ['ZILLII Puppy (Индейка, ягненок) - 3 кг', 'ZILLII'],
    ['Craftia Natura Adult Mini (Курица, индейка) - 2 кг', 'Craftia'],
    ['AlphaPet Vet Diet Cat Gastro - 1,5 кг', 'AlphaPet'],
    ['Alleva Holistic Chicken & Duck Puppy Mini - 2 кг', 'Alleva'],
    ['Forza10 Cat Maintenance Fish - 2 кг', 'Forza10'],
  ])('«%s» → %s', (name, brand) => {
    expect(detectBrand(name)).toBe(brand)
  })

  it.each([
    'Многоразовая впитывающая пеленка для собак и кошек - 60х90',
    'Dog Puppy Medium/Large Pol/Pat',
    'F10MANT DogMedAdu Cerv/PatDRY12kg 1pz',
  ])('не выдумывает бренд для «%s»', (name) => {
    expect(detectBrand(name)).toBeUndefined()
  })

  it('не путает Happy Cat и Happy Dog между собой', () => {
    expect(detectBrand('Happy Cat Sensitive Grainfree - 4 кг')).toBe('Happy Cat')
    expect(detectBrand('Happy Dog Supreme Mini Neuseeland - 4 кг')).toBe('Happy Dog')
  })
})

describe('mapRow — файл без колонки «Имя» (реальная выгрузка)', () => {
  const row = (name: string, values: string[]) => {
    const raw: Record<string, string> = { 'Наименование': name }
    const names = ['вид', 'вкус', 'Возраст питомца', 'Патология', 'Страна-изготовитель']
    names.forEach((attrName, i) => {
      raw[`Название атрибута ${i + 1}`] = attrName
      raw[`Значение атрибута ${i + 1}`] = values[i] ?? ''
      raw[`Глобальный атрибут ${i + 1}`] = '1'
      raw[`Видимость атрибута ${i + 1}`] = '1'
    })
    return raw
  }

  const values = ['кошки', 'курица', 'взрослые', 'ЖКТ', 'Италия']
  const name = 'Farmina N&D Pumpkin GF Adult Mini (Тыква, ягненок, черника) - 7 кг'

  it('берёт имя из «Наименование», раз колонки «Имя» нет', () => {
    expect(mapRow(row(name, values)).name).toBe(name)
  })

  it('распознаёт все пять атрибутов и игнорирует служебные колонки', () => {
    expect(mapRow(row(name, values)).attributes).toEqual([
      { name: 'вид', value: 'кошки' },
      { name: 'вкус', value: 'курица' },
      { name: 'Возраст питомца', value: 'взрослые' },
      { name: 'Патология', value: 'ЖКТ' },
      { name: 'Страна-изготовитель', value: 'Италия' },
    ])
  })

  it('без колонок цены и веса отдаёт undefined, а не 0', () => {
    const mapped = mapRow(row(name, values))
    expect(mapped.price).toBeUndefined()
    expect(mapped.oldPrice).toBeUndefined()
    expect(mapped.weight).toBeUndefined()
  })

  it('строка-пустышка даёт пустое имя и пустые атрибуты (роут её пропустит)', () => {
    const mapped = mapRow(row('', []))
    expect(mapped.name).toBe('')
    expect(mapped.attributes).toEqual([])
  })
})

describe('parseCsvLine', () => {
  it('разбирает простую строку без кавычек', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c'])
  })

  it('снимает кавычки со значений', () => {
    expect(parseCsvLine('"Корм","Muzzle"')).toEqual(['Корм', 'Muzzle'])
  })

  it('не разбивает по запятой внутри кавычек', () => {
    expect(parseCsvLine('"Собаки, Кошки",Muzzle')).toEqual(['Собаки, Кошки', 'Muzzle'])
  })

  it('сохраняет пустые поля', () => {
    expect(parseCsvLine('a,,c')).toEqual(['a', '', 'c'])
    expect(parseCsvLine(',,')).toEqual(['', '', ''])
  })

  it('обрезает пробелы вокруг значений', () => {
    expect(parseCsvLine(' a , b ')).toEqual(['a', 'b'])
  })
})

describe('parseRows (CSV)', () => {
  it('собирает объекты по заголовкам', () => {
    const csv = 'Имя,Артикул,Категории\nКорм,A-1,"Собаки, Кошки"\n'
    expect(parseRows(Buffer.from(csv, 'utf-8'), 'import.csv')).toEqual([
      { 'Имя': 'Корм', 'Артикул': 'A-1', 'Категории': 'Собаки, Кошки' },
    ])
  })

  it('добивает пустой строкой недостающие в конце колонки', () => {
    const csv = 'Имя,Артикул\nКорм\n'
    expect(parseRows(Buffer.from(csv, 'utf-8'), 'import.csv')).toEqual([
      { 'Имя': 'Корм', 'Артикул': '' },
    ])
  })

  it('на файле только с заголовками возвращает пустой массив', () => {
    expect(parseRows(Buffer.from('Имя,Артикул\n', 'utf-8'), 'import.csv')).toEqual([])
  })
})

describe('числа из Excel не ломают разбор', () => {
  it('parseRows приводит числовые ячейки к строкам', () => {
    const sheet = XLSX.utils.json_to_sheet([
      {
        'Наименование': 'Farmina N&D Prime GF Adult Mini (Кабан и яблоко) - 2,5 кг',
        'Артикул': 1234567,
        'Название атрибута 1': 'вид',
        'Значение атрибута 1': 'Сухой',
        'Название атрибута 2': 'вкус',
        'Значение атрибута 2': 2024,
      },
    ])
    const book = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(book, sheet, 'Sheet1')
    const buffer = XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }) as Buffer

    const rows = parseRows(buffer, 'catalog.xlsx')

    expect(rows).toHaveLength(1)
    expect(rows[0]['Артикул']).toBe('1234567')
    expect(rows[0]['Значение атрибута 2']).toBe('2024')
  })

  it('mapRow не падает на числовом артикуле', () => {
    const raw = {
      'Наименование': 'Grandorf Adult Indoor (Ягненок, индейка) - 400 гр',
      'Артикул': 1234567,
    } as unknown as Record<string, string>

    expect(() => mapRow(raw)).not.toThrow()
    expect(mapRow(raw).sku).toBe('1234567')
  })

  it('parseAttributes не падает на числовом значении атрибута', () => {
    const raw = {
      'Название атрибута 1': 'Год выпуска',
      'Значение атрибута 1': 2024,
    } as unknown as Record<string, string>

    expect(parseAttributes(raw)).toEqual([{ name: 'Год выпуска', value: '2024' }])
  })
})

describe('isNonProductRow', () => {
  it.each([
    'Коробка картонная 300*300*200',
    'Коробка картонная 600*400*150 мм',
    'Коробки',
    'Скотч прозрачный 48мм*50м*45мкм',
    'Скотч прозрачный 72мм*100м*45мкм',
    'Стеллаж',
    'Фонды',
    'ВПП двухслойная Стандарт 100*0,5',
  ])('отсеивает складскую строку из выгрузки: %s', (name) => {
    expect(isNonProductRow(name)).toBe(true)
  })

  it.each([
    'Паллет европейский',
    'Палета деревянная',
    'Ценник самоклеящийся 30*20',
    'Стрейч-плёнка 500мм',
  ])('отсеивает заложенные складские слова без примеров в выгрузке: %s', (name) => {
    expect(isNonProductRow(name)).toBe(true)
  })

  it.each([
    'Muzzle Крахмальные пакеты для выгула собак',
    'Muzzle Диспенсер для пакетов для выгула собак - синий',
    'Muzzle Ветеринарный паспорт для домашних животных',
    'Многоразовая впитывающая пеленка для собак и кошек - 40х60',
    'Многоразовая впитывающая пеленка для собак и кошек - 60х90',
    'Когтеточка деревянная - 605х205х225',
    "Hill's Prescription Diet l/d Liver Care - 1,5 кг",
    'Farmina N&D Ocean Adult (Треска, киноа) - 1,5 кг',
    'Monge Cat Adult (Лосось) - 400 гр',
    'Grandorf Adult Indoor (Ягненок, индейка) - 400 гр',
    'Happy Cat Sensitive Stomach - 1,3 кг',
  ])('не трогает реальный товар каталога: %s', (name) => {
    expect(isNonProductRow(name)).toBe(false)
  })

  it.each(['КОРОБКА картонная', 'коробка картонная', 'Коробка картонная'])(
    'отсеивает независимо от регистра: %s',
    (name) => {
      expect(isNonProductRow(name)).toBe(true)
    }
  )

  it('отсеивает пометку БРАК в конце названия', () => {
    expect(isNonProductRow("Hill's Prescription Diet l/d Liver Care - 1,5 кг БРАК")).toBe(true)
  })

  it('отсеивает пометку БРАК в начале названия', () => {
    expect(isNonProductRow('БРАК Monge Cat Adult (Лосось) - 400 гр')).toBe(true)
  })

  it('отсеивает пометку БРАК в середине названия', () => {
    expect(isNonProductRow('Monge Cat БРАК Adult (Лосось) - 400 гр')).toBe(true)
  })

  it.each([
    'Игрушка с бракетом для собак',
    'Ошейник бракованный тип не подходит',
  ])('не отсеивает, когда "брак" — часть другого слова: %s', (name) => {
    expect(isNonProductRow(name)).toBe(false)
  })

  it('не отсеивает, когда складское слово стоит в середине названия', () => {
    expect(isNonProductRow('Игрушка коробка для кошек')).toBe(false)
  })

  it('не отсеивает товар, чьё название лишь начинается с тех же букв, что и складское слово', () => {
    expect(isNonProductRow('Коробочка-домик для кошки')).toBe(false)
    expect(isNonProductRow('Скотчбрайт-щётка для лотка')).toBe(false)
  })
})

describe('пометка БРАК без пробела (реальные строки из базы)', () => {
  it.each([
    'БРАК Farmina Vet Life Struvite Dog',
    'БРАК! Monge Dog Speciality Adult All Breeds (Лосось, рис)',
    'БРАК!!!Monge Dog Speciality Adult All Breeds (Лосось, рис)',
    'БРАК!Monge Dog',
    'брак!!!Monge Dog',
  ])('отсекает %s', name => {
    expect(isNonProductRow(name)).toBe(true)
  })

  it.each([
    'Бракованный ошейник',
    'Собачий ошейник с бракетом',
    'Monge Dog Speciality Adult All Breeds (Лосось, рис)',
  ])('не трогает %s', name => {
    expect(isNonProductRow(name)).toBe(false)
  })
})
