import { describe, it, expect } from 'vitest'
import { fixClientText, fixMixedScript } from '../lib/text-fixes.js'

const fixed = (text: string): string => fixClientText(text).text

describe('fixMixedScript', () => {
  it('двойники в латинских словах заменяются на латиницу', () => {
    expect(fixMixedScript('ВEEVENOM')).toBe('BEEVENOM')
    expect(fixMixedScript('СONTORNO')).toBe('CONTORNO')
    expect(fixMixedScript('REDENSIFICANTЕ')).toBe('REDENSIFICANTE')
    expect(fixMixedScript('АQUA')).toBe('AQUA')
    expect(fixMixedScript('СBD')).toBe('CBD')
    expect(fixMixedScript('ВALANCE')).toBe('BALANCE')
  })

  it('двойники в русских словах заменяются на кириллицу', () => {
    expect(fixMixedScript('Oзон')).toBe('Озон')
    expect(fixMixedScript('себостазa')).toBe('себостаза')
  })

  it('слова одного алфавита и слова без однозначных букв не меняются', () => {
    expect(fixMixedScript('Витамин С')).toBe('Витамин С')
    expect(fixMixedScript('B3')).toBe('B3')
    expect(fixMixedScript('Liposome-C')).toBe('Liposome-C')
    expect(fixMixedScript('ДНК')).toBe('ДНК')
    expect(fixMixedScript('СOРE')).toBe('СOРE')
  })

  it('однозначные буквы обоих алфавитов — слово не трогается', () => {
    expect(fixMixedScript('Qжa')).toBe('Qжa')
  })

  it('меняет только смешанные слова в строке', () => {
    expect(fixMixedScript('ВEEVENOM SERUM — сывороткa с ядом пчелы')).toBe('BEEVENOM SERUM — сыворотка с ядом пчелы')
  })
})

describe('fixClientText: знаки', () => {
  it('стоп-точка перед числом после буквы', () => {
    expect(fixClientText('Нанесите .4–6 капель')).toEqual({ text: 'Нанесите 4–6 капель', fixes: ['«Нанесите .4–6» → «Нанесите 4–6»'] })
  })

  it('пробел перед знаком убирается', () => {
    expect(fixed('кожи , которая')).toBe('кожи, которая')
    expect(fixed('Liposome-C .')).toBe('Liposome-C.')
    expect(fixed('Внимание ! Шаг 1 : нанесите ; затем ?')).toBe('Внимание! Шаг 1: нанесите; затем?')
  })

  it('ведущие знаки в начале строки убираются', () => {
    expect(fixed('.Альгинатная маска')).toBe('Альгинатная маска')
    expect(fixed(', . Альгинатная маска')).toBe('Альгинатная маска')
  })

  it('нет пробела после конца фразы', () => {
    expect(fixClientText('защитного барьера.Эта формула')).toEqual({
      text: 'защитного барьера. Эта формула',
      fixes: ['«барьера.Эта» → «барьера. Эта»'],
    })
  })

  it('хвост из многоточий и точек в конце строки убирается', () => {
    expect(fixClientText('сыворотки Fluvix. ………')).toEqual({ text: 'сыворотки Fluvix.', fixes: ['«Fluvix. ………» → «Fluvix.»'] })
    expect(fixed('текст.………')).toBe('текст.')
    expect(fixed('текст ……')).toBe('текст')
    expect(fixed('текст....')).toBe('текст.')
  })

  it('строка из одних точек и многоточий становится пустой', () => {
    expect(fixed('. ……………')).toBe('')
    expect(fixed('…………')).toBe('')
  })
})

describe('fixClientText: опечатки', () => {
  it('элексир → эликсир во всех формах', () => {
    expect(fixed('Элексир с элексирами, элексиры')).toBe('Эликсир с эликсирами, эликсиры')
  })

  it('Витамие → Витамин только целым словом', () => {
    expect(fixClientText('Витамие С')).toEqual({ text: 'Витамин С', fixes: ['«Витамие» → «Витамин»'] })
  })

  it('антивозрасной → антивозрастной', () => {
    expect(fixed('АНТИВОЗРАСНОЙ уход, антивозрасная сыворотка')).toBe('АНТИВОЗРАСТНОЙ уход, антивозрастная сыворотка')
  })

  it('«в соответствие с» → «в соответствии с», но «привести в соответствие с» верно', () => {
    expect(fixed('В соответствие с протоколом')).toBe('В соответствии с протоколом')
    expect(fixed('применять в соответствие с инструкцией')).toBe('применять в соответствии с инструкцией')
    expect(fixed('привести в соответствие с нормой')).toBe('привести в соответствие с нормой')
  })

  it('Обьем → Объем', () => {
    expect(fixed('Обьем: 30 мл')).toBe('Объем: 30 мл')
    expect(fixed('ОБЬЁМ флакона, обьема')).toBe('ОБЪЁМ флакона, объема')
  })

  it('регистр сохраняется: всё заглавное, первая заглавная, строчные', () => {
    expect(fixed('ЭЛЕКСИР')).toBe('ЭЛИКСИР')
    expect(fixed('Элексир')).toBe('Эликсир')
    expect(fixed('элексир')).toBe('эликсир')
  })

  it('смешанный алфавит исправляется в конце, в том числе внутри опечатки', () => {
    expect(fixClientText('Oбьем элексиp')).toEqual({
      text: 'Объем эликсир',
      fixes: ['«Oбьем» → «Обьем»', '«элексиp» → «элексир»', '«элексир» → «эликсир»', '«Обьем» → «Объем»'],
    })
  })
})

describe('fixClientText: без ложных срабатываний', () => {
  it.each([
    '1.5 мл',
    'т. е. так',
    'SPF 50.',
    'Конец фразы…',
    'Витамин С',
    'Шаг 1: нанесите',
    'Liposome-C. Сыворотка',
    'Многоточие из точек...',
    'и т.д. далее',
  ])('«%s» не меняется', (text) => {
    expect(fixClientText(text)).toEqual({ text, fixes: [] })
  })
})

describe('fixClientText: идемпотентность', () => {
  it.each([
    'Нанесите .4–6 капель',
    'кожи , которая',
    '.Альгинатная маска',
    'защитного барьера.Эта формула',
    'сыворотки Fluvix. ………',
    '. ……………',
    'Элексир с элексирами',
    'АНТИВОЗРАСНОЙ',
    'В соответствие с протоколом',
    'Обьем: 30 мл',
    'ВEEVENOM сывороткa',
    'Oбьем элексиp',
    'Нанесите  .4 капли',
  ])('повторный вызов на «%s» ничего не правит', (text) => {
    const once = fixClientText(text)
    expect(once.fixes.length).toBeGreaterThan(0)
    expect(fixClientText(once.text)).toEqual({ text: once.text, fixes: [] })
  })
})
