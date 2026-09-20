import { describe, it, expect } from 'vitest'
import { deriveQuizTags, mergeQuizTags, determineSpecies, isUniversalCare, speciesFromText, type AutotagInput } from './quiz-autotag'
import { isQuizTag } from '../lib/quiz-tags'

/** Собрать вход, подставив вид животного через категорию. */
function input(over: Partial<AutotagInput> = {}): AutotagInput {
  return {
    name: 'Тестовый корм',
    categorySlugs: ['dogs-dry'],
    filters: [],
    ...over,
  }
}

const flavor = (value: string) => ({ filter: 'вкус', value })
const pathology = (value: string) => ({ filter: 'Патология', value })
const age = (value: string) => ({ filter: 'Возраст питомца', value })
const kind = (value: string) => ({ filter: 'вид', value })

describe('deriveQuizTags — вид животного', () => {
  it('определяет вид по слагу категории', () => {
    expect(deriveQuizTags(input({ categorySlugs: ['cats-wet'] }))).toContain('species:cat')
    expect(deriveQuizTags(input({ categorySlugs: ['dogs-dry'] }))).toContain('species:dog')
  })

  it('падает на название, когда категории не помогли', () => {
    const cat = deriveQuizTags(input({ categorySlugs: [], name: 'Monge Cat Adult' }))
    expect(cat).toContain('species:cat')

    const dog = deriveQuizTags(input({ categorySlugs: [], name: 'Корм для собак Acana' }))
    expect(dog).toContain('species:dog')
  })

  it('читает вид по маркерам линейки, когда категорий нет (251 товар на проде)', () => {
    const cats = [
      'Grandorf Fresh Adult Sterilised (Индейка и батат)',
      'Grandorf Kitten (Ягненок, индейка)',
      'Grandorf Adult Indoor (Ягненок, индейка)',
      'Farmina Matisse Neutered (Лосось)',
    ]
    for (const name of cats) {
      expect(deriveQuizTags(input({ categorySlugs: [], name })), name).toContain('species:cat')
    }

    const dogs = [
      'Farmina N&D Prime Puppy Chicken Mini',
      'Grandorf Fresh Adult Medium & Maxi (Утка и батат)',
      'Farmina Cibau Adult Medium (Курица)',
      'Grandorf Fresh Puppy All Breeds (Ягненок и батат)',
      'Grandorf Junior Medium & Maxi (Ягненок и индейка)',
    ]
    for (const name of dogs) {
      expect(deriveQuizTags(input({ categorySlugs: [], name })), name).toContain('species:dog')
    }
  })

  it('кошачий маркер сильнее размерного', () => {
    // «Стерилизованный» — кошачья линейка; Mini рядом не должен перетянуть в собак.
    const tags = deriveQuizTags(input({ categorySlugs: [], name: 'Grandorf Sterilised Mini' }))
    expect(tags).toContain('species:cat')
  })

  it('универсальный товар «для собак и кошек» остаётся вне подбора', () => {
    for (const name of [
      'Универсальный шампунь для собак и кошек',
      'Гигиенический лосьон для глаз для собак и кошек',
    ]) {
      expect(deriveQuizTags(input({ categorySlugs: [], name })), name).toEqual([])
    }
  })

  it('без определимого вида не выдаёт тегов вообще', () => {
    // Товар вне квиза — лучше не показать ничего, чем предложить кошке собачий корм.
    expect(deriveQuizTags(input({ categorySlugs: [], name: 'Лакомство Мнямс' }))).toEqual([])
  })
})

describe('deriveQuizTags — вкус и аллергены (реальные значения с прода)', () => {
  it('«Курица, Спельта, Овес, Гранат» → курица + злаки', () => {
    const tags = deriveQuizTags(input({ filters: [flavor('Курица, Спельта, Овес, Гранат')] }))
    expect(tags).toContain('flavor:chicken')
    expect(tags).toContain('contains:chicken')
    expect(tags).toContain('contains:grain')
  })

  it('«Индейка, Ягненок» → оба вкуса, аллерген только у ягнёнка', () => {
    const tags = deriveQuizTags(input({ filters: [flavor('Индейка, Ягненок')] }))
    expect(tags).toContain('flavor:turkey')
    expect(tags).toContain('flavor:lamb')
    expect(tags).toContain('contains:lamb')
  })

  it('рыба во всех вариантах названия', () => {
    for (const value of ['Лосось', 'Тунец', 'Рыба', 'Сельдь', 'Треска']) {
      const tags = deriveQuizTags(input({ filters: [flavor(value)] }))
      expect(tags, value).toContain('flavor:fish')
      expect(tags, value).toContain('contains:fish')
    }
  })

  it('ё и е считаются одинаково', () => {
    const withYo = deriveQuizTags(input({ filters: [flavor('Ягнёнок')] }))
    const withYe = deriveQuizTags(input({ filters: [flavor('Ягненок')] }))
    expect(withYo).toContain('contains:lamb')
    expect(withYe).toContain('contains:lamb')
  })
})

describe('deriveQuizTags — патологии', () => {
  it('«Аллергия, чувствительное пищеварение» → аллергия + пищеварение + гипоаллергенность', () => {
    const tags = deriveQuizTags(input({ filters: [pathology('Аллергия, чувствительное пищеварение')] }))
    expect(tags).toContain('health:allergy')
    expect(tags).toContain('special:hypoallergenic')
    expect(tags).toContain('health:digestion')
  })

  it('«Без патологий» не добавляет health-тегов', () => {
    const tags = deriveQuizTags(input({ filters: [pathology('Без патологий')] }))
    expect(tags.filter(t => t.startsWith('health:'))).toEqual([])
  })

  it('контроль веса и МКБ', () => {
    expect(deriveQuizTags(input({ filters: [pathology('Контроль веса')] }))).toContain('weight:overweight')
    expect(deriveQuizTags(input({ filters: [pathology('Мочекаменная болезнь')] }))).toContain('health:urinary')
    expect(deriveQuizTags(input({ filters: [pathology('Профилактика мочекаменной болезни')] }))).toContain('health:urinary')
  })
})

describe('deriveQuizTags — возраст', () => {
  it('«до 1 года» зависит от вида животного', () => {
    const cat = deriveQuizTags(input({ categorySlugs: ['cats-dry'], filters: [age('до 1 года')] }))
    expect(cat).toContain('age:kitten')

    const dog = deriveQuizTags(input({ categorySlugs: ['dogs-dry'], filters: [age('до 1 года')] }))
    expect(dog).toContain('age:puppy')
  })

  it('«от 1 года» и «Взрослые» → adult, «от 7 лет» → senior', () => {
    expect(deriveQuizTags(input({ filters: [age('от 1 года')] }))).toContain('age:adult')
    expect(deriveQuizTags(input({ filters: [age('Взрослые')] }))).toContain('age:adult')
    expect(deriveQuizTags(input({ filters: [age('от 7 лет')] }))).toContain('age:senior')
  })

  it('без указания возраста товар подходит всем', () => {
    expect(deriveQuizTags(input())).toContain('age:all')
  })
})

describe('deriveQuizTags — формат', () => {
  it('«Сухой» / «Влажный»', () => {
    expect(deriveQuizTags(input({ filters: [kind('Сухой')] }))).toContain('format:dry')
    expect(deriveQuizTags(input({ filters: [kind('Влажный')] }))).toContain('format:wet')
  })
})

describe('deriveQuizTags — размер породы', () => {
  it('Mini побеждает, «Small & Toy» не читается как Small', () => {
    expect(deriveQuizTags(input({ name: 'Farmina N&D Mini Adult' }))).toContain('size:mini')
    expect(deriveQuizTags(input({ name: 'Happy Dog Small & Toy' }))).toContain('size:mini')
  })

  it('остальные размеры', () => {
    expect(deriveQuizTags(input({ name: 'Monge Medium Adult' }))).toContain('size:medium')
    expect(deriveQuizTags(input({ name: 'Farmina Maxi Puppy' }))).toContain('size:large')
    expect(deriveQuizTags(input({ name: 'Happy Dog Giant Adult' }))).toContain('size:giant')
  })

  it('без указания размера — подходит любой породе', () => {
    expect(deriveQuizTags(input({ name: 'Monge Speciality Adult' }))).toContain('size:all')
  })
})

describe('deriveQuizTags — философия состава', () => {
  it('беззерновой и низкозерновой из названия', () => {
    expect(deriveQuizTags(input({ name: 'Farmina N&D Grain Free Adult' }))).toContain('philosophy:grainfree')
    expect(deriveQuizTags(input({ name: 'Farmina N&D Ancestral Grain Adult' }))).toContain('philosophy:lowgrain')
  })

  it('не выдумывает classic, когда в названии ничего нет', () => {
    const tags = deriveQuizTags(input({ name: 'Monge Speciality Adult' }))
    expect(tags.filter(t => t.startsWith('philosophy:'))).toEqual([])
  })
})

describe('deriveQuizTags — инварианты', () => {
  it('все выданные теги есть в словаре', () => {
    const tags = deriveQuizTags(input({
      name: 'Farmina N&D Grain Free Mini Adult',
      categorySlugs: ['dogs-dry'],
      filters: [
        kind('Сухой'),
        age('от 1 года'),
        flavor('Курица, Спельта, Овес, Гранат'),
        pathology('Аллергия, чувствительное пищеварение'),
      ],
    }))
    expect(tags.length).toBeGreaterThan(5)
    for (const tag of tags) expect(isQuizTag(tag), tag).toBe(true)
  })

  it('не дублирует теги при повторяющихся фильтрах', () => {
    const tags = deriveQuizTags(input({ filters: [flavor('Курица'), flavor('Курица, рис')] }))
    expect(tags.filter(t => t === 'flavor:chicken')).toHaveLength(1)
    expect(tags.filter(t => t === 'contains:chicken')).toHaveLength(1)
  })
})

describe('mergeQuizTags', () => {
  it('ручные теги перекрывают авто по пространству имён', () => {
    const merged = mergeQuizTags(['age:senior'], ['age:adult', 'format:dry'])
    expect(merged).toContain('age:senior')
    expect(merged).toContain('format:dry')
    expect(merged).not.toContain('age:adult')
  })

  it('без ручных тегов остаются все авто', () => {
    expect(mergeQuizTags([], ['species:dog', 'age:adult'])).toEqual(['species:dog', 'age:adult'])
  })

  it('не дублирует одинаковые теги', () => {
    expect(mergeQuizTags(['format:dry'], ['format:dry'])).toEqual(['format:dry'])
  })
})

describe('determineSpecies — расширенные проверки', () => {
  it('голые формы слов для собак', () => {
    const cases = [
      'Мультивитамины для взрослых собак 8in1 Excel',
      'Витамины для щенят',
      'Корм for dogs',
      'Canine Adult',
    ]
    for (const name of cases) {
      expect(determineSpecies(name, []), name).toBe('dog')
    }
  })

  it('голые формы слов для кошек', () => {
    const cases = [
      'Витамины для шерсти Laveta Super for Cats, 50 мл',
      'Для кошек препарат',
      'Feline Urinary',
    ]
    for (const name of cases) {
      expect(determineSpecies(name, []), name).toBe('cat')
    }
  })

  it('маркеры линеек для кошек: когтеточка, hairball, y/d', () => {
    const cases = [
      'Когтеточка деревянная - 605х205х225',
      'Royal Canin Urinary S/O Feline',
      'Hill\'s Prescription Diet y/d Thyroid Care',
    ]
    for (const name of cases) {
      expect(determineSpecies(name, []), name).toBe('cat')
    }
  })

  it('маркеры линеек для собак: для выгула, дождевик, симпарика, low fat, derm', () => {
    const cases = [
      'Muzzle Крахмальные пакеты для выгула собак',
      'Симпарика 1,3-2,5 кг (3 таблетки)',
      'Hill\'s Prescription Diet i/d Low Fat Digestive Care (курица)',
      'Hill\'s Prescription Diet u/d Urinary Care',
      'Royal Canin Derm Complete',
    ]
    for (const name of cases) {
      expect(determineSpecies(name, []), name).toBe('dog')
    }
  })

  it('u/d в диете не путается с утка', () => {
    // Hill's Science Plan Adult (утка) содержит слово «утка», но не содержит u/d диету
    expect(determineSpecies('Hill\'s Science Plan Adult (утка)', [])).toBe(null)
  })

  it('оба вида в названии → null', () => {
    expect(determineSpecies('Бальзам-кондиционер Muzzle для собак и кошек', [])).toBe(null)
  })

  it('k/d существует для обоих видов → не определяем', () => {
    // Hill's Prescription Diet k/d Kidney Care — есть для кошек и собак
    expect(determineSpecies('Hill\'s Prescription Diet k/d Kidney Care (курица)', [])).toBe(null)
  })

  it('регрессия: кошачий маркер (steril) перетягивает размерный (mini)', () => {
    expect(determineSpecies('Grandorf Sterilised Mini', [])).toBe('cat')
  })

  it('регрессия: щенячий маркер (puppy)', () => {
    expect(determineSpecies('Prime Puppy Mini', [])).toBe('dog')
  })
})

describe('isUniversalCare', () => {
  it('определяет по названию', () => {
    const cases = [
      'Гель-мыло для лап',
      'Muzzle Нейтрализатор запаха животных',
      'Расческа для кошек и собак',
      'Зубная щётка для животных',
      'Шампунь универсальный',
    ]
    for (const name of cases) {
      expect(isUniversalCare(name, []), name).toBe(true)
    }
  })

  it('определяет по категории', () => {
    expect(isUniversalCare('Товар', ['care'])).toBe(true)
    expect(isUniversalCare('Товар', ['care-accessories'])).toBe(true)
    expect(isUniversalCare('Товар', ['dogs-care'])).toBe(false) // dogs-care не начинается с care-
  })

  it('не ловит обычный корм', () => {
    expect(isUniversalCare('Hill\'s Science Plan Adult', [])).toBe(false)
  })

  it('ё и е считаются одинаково', () => {
    expect(isUniversalCare('Расчёска', [])).toBe(true)
    expect(isUniversalCare('Расческа', [])).toBe(true)
  })
})

describe('speciesFromText — вид из пути папки МоегоСклада', () => {
  it('читает родительный падеж: «для кошек»', () => {
    expect(speciesFromText('Корм/Grandorf/Grandorf для кошек')).toBe('cat')
  })

  it('читает именительный: «Кошки»', () => {
    expect(speciesFromText('Корм/Farmina/Farmina / Кошки/Farmina / Кошки / Сухой/N&D')).toBe('cat')
  })

  it('читает собачьи папки в обеих формах', () => {
    expect(speciesFromText('Корм/Monge/Monge / Собаки')).toBe('dog')
    expect(speciesFromText('Корм/Grandorf/Grandorf для собак')).toBe('dog')
  })

  it('папка по бренду вида не несёт', () => {
    expect(speciesFromText("Корм/Hill's")).toBeNull()
    expect(speciesFromText('Корм/Zillii')).toBeNull()
    expect(speciesFromText('Уход и косметика/Muzzle')).toBeNull()
  })

  it('оба вида в пути — не гадаем', () => {
    expect(speciesFromText('Уход/Для собак и кошек')).toBeNull()
  })
})
