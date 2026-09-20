import { PrismaClient, UserRole, FilterType } from '@prisma/client'

const prisma = new PrismaClient()

// Валидация quizTags
const VALID_QUIZ_TAGS = new Set([
  'species:dog', 'species:cat',
  'age:puppy', 'age:kitten', 'age:adult', 'age:senior', 'age:all',
  'size:mini', 'size:small', 'size:medium', 'size:large', 'size:giant', 'size:all',
  'format:dry', 'format:wet',
  'philosophy:grainfree', 'philosophy:lowgrain', 'philosophy:classic',
  'health:digestion', 'health:skin', 'health:allergy', 'health:sterilized',
  'health:joints', 'health:hairball', 'health:urinary', 'health:longhair',
  'flavor:chicken', 'flavor:lamb', 'flavor:fish', 'flavor:game',
  'flavor:beef', 'flavor:turkey', 'flavor:duck', 'flavor:rabbit',
  'contains:chicken', 'contains:beef', 'contains:fish', 'contains:grain', 'contains:lamb',
  'weight:overweight', 'weight:underweight',
  'activity:low', 'activity:normal', 'activity:high',
  'lifestyle:indoor', 'lifestyle:outdoor',
  'special:monoprotein', 'special:hypoallergenic', 'special:palatable',
])

function validateQuizTags(tags: string[]): boolean {
  return tags.every(t => VALID_QUIZ_TAGS.has(t))
}

async function main() {
  console.log('Seeding database...')

  // Категории
  const catFood = await prisma.category.upsert({
    where: { slug: 'cats-food' },
    update: {},
    create: { name: 'Корм для кошек', slug: 'cats-food', isActive: true, sortOrder: 1 },
  })

  const dogFood = await prisma.category.upsert({
    where: { slug: 'dogs-food' },
    update: {},
    create: { name: 'Корм для собак', slug: 'dogs-food', isActive: true, sortOrder: 2 },
  })

  const treats = await prisma.category.upsert({
    where: { slug: 'treats' },
    update: {},
    create: { name: 'Лакомства', slug: 'treats', isActive: true, sortOrder: 3 },
  })

  console.log('Categories:', catFood.name, dogFood.name, treats.name)

  // Бренды
  const royalCanin = await prisma.brand.upsert({
    where: { slug: 'royal-canin' },
    update: {},
    create: { name: 'Royal Canin', slug: 'royal-canin' },
  })

  const hills = await prisma.brand.upsert({
    where: { slug: 'hills' },
    update: {},
    create: { name: "Hill's", slug: 'hills' },
  })

  console.log('Brands:', royalCanin.name, hills.name)

  // Фильтры
  const speciesFilter = await prisma.filter.upsert({
    where: { slug: 'species' },
    update: {},
    create: {
      name: 'Вид животного',
      slug: 'species',
      type: FilterType.checkbox,
      values: {
        create: [
          { value: 'Кошки', slug: 'cats' },
          { value: 'Собаки', slug: 'dogs' },
        ],
      },
    },
  })

  const healthFilter = await prisma.filter.upsert({
    where: { slug: 'health' },
    update: {},
    create: {
      name: 'Проблема здоровья',
      slug: 'health',
      type: FilterType.checkbox,
      values: {
        create: [
          { value: 'Почечная недостаточность', slug: 'kidney' },
          { value: 'Мочекаменная болезнь', slug: 'urinary' },
          { value: 'Ожирение', slug: 'obesity' },
          { value: 'Чувствительное пищеварение', slug: 'sensitive-digestion' },
        ],
      },
    },
  })

  const weightFilter = await prisma.filter.upsert({
    where: { slug: 'package-weight' },
    update: {},
    create: { name: 'Вес упаковки', slug: 'package-weight', type: FilterType.range },
  })

  console.log('Filters:', speciesFilter.name, healthFilter.name, weightFilter.name)

  // Тестовый товар Royal Canin Renal
  const renalProduct = await prisma.product.upsert({
    where: { slug: 'royal-canin-renal' },
    update: {},
    create: {
      name: 'Royal Canin Renal',
      slug: 'royal-canin-renal',
      description:
        'Полнорационный диетический корм для взрослых кошек при хронической почечной недостаточности.',
      brandId: royalCanin.id,
      images: [],
      isGrainFree: false,
      isHypoallergenic: false,
      protein: 25.0,
      fat: 20.0,
      fiber: 0.6,
      ash: 4.5,
      isActive: true,
    },
  })

  // Варианты товара — цены в копейках (89900 = 899 руб)
  for (const variant of [
    { weight: 0.5, price: 89900, oldPrice: 99900, stock: 45, sku: 'RC-RENAL-0.5' },
    { weight: 2, price: 249900, oldPrice: 279900, stock: 23, sku: 'RC-RENAL-2' },
    { weight: 4, price: 419900, oldPrice: null, stock: 12, sku: 'RC-RENAL-4' },
  ]) {
    await prisma.productVariant.upsert({
      where: { sku: variant.sku },
      update: {},
      create: { productId: renalProduct.id, ...variant },
    })
  }

  await prisma.productCategory.upsert({
    where: { productId_categoryId: { productId: renalProduct.id, categoryId: catFood.id } },
    update: {},
    create: { productId: renalProduct.id, categoryId: catFood.id },
  })

  console.log('Product:', renalProduct.name, '— 3 variants')

  // Новые бренды для квиза
  const farmina = await prisma.brand.upsert({
    where: { slug: 'farmina' },
    update: { accentColor: '#0F70B5', logoFit: 'mark' },
    create: { name: 'Farmina', slug: 'farmina', accentColor: '#0F70B5', logoFit: 'mark' },
  })

  const monge = await prisma.brand.upsert({
    where: { slug: 'monge' },
    update: {},
    create: { name: 'Monge', slug: 'monge' },
  })

  const happyDog = await prisma.brand.upsert({
    where: { slug: 'happy-dog' },
    update: {},
    create: { name: 'Happy Dog', slug: 'happy-dog' },
  })

  const happyCat = await prisma.brand.upsert({
    where: { slug: 'happy-cat' },
    update: {},
    create: { name: 'Happy Cat', slug: 'happy-cat' },
  })

  console.log('Brands added: Farmina, Monge, Happy Dog, Happy Cat')

  // Товары для квиза — 64 SKU
  const quizProducts = [
    // Собаки, сухой корм, щенок, Farmina (беззерновой)
    { name: 'Farmina N&D Prime Puppy Chicken Mini', slug: 'farmina-nd-prime-puppy-chicken-mini', brand: farmina, tags: ['species:dog', 'age:puppy', 'size:mini', 'format:dry', 'philosophy:grainfree', 'flavor:chicken', 'contains:chicken', 'special:monoprotein'], prices: [{ w: 0.8, p: 59900, old: 69900, stock: 15 }] },
    { name: 'Farmina N&D Prime Puppy Lamb Small', slug: 'farmina-nd-prime-puppy-lamb-small', brand: farmina, tags: ['species:dog', 'age:puppy', 'size:small', 'format:dry', 'philosophy:grainfree', 'flavor:lamb', 'contains:lamb', 'special:hypoallergenic'], prices: [{ w: 0.8, p: 59900, old: 69900, stock: 12 }] },
    { name: 'Farmina N&D Ancestral Puppy Medium Chicken', slug: 'farmina-nd-ancestral-puppy-chicken-med', brand: farmina, tags: ['species:dog', 'age:puppy', 'size:medium', 'format:dry', 'philosophy:lowgrain', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 89900, old: 99900, stock: 20 }] },
    // Собаки, сухой корм, взрослый, Farmina
    { name: 'Farmina N&D Pumpkin Chicken Adult Small', slug: 'farmina-nd-pumpkin-chicken-adult-small', brand: farmina, tags: ['species:dog', 'age:adult', 'size:small', 'format:dry', 'philosophy:grainfree', 'health:digestion', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 109900, old: 129900, stock: 25 }, { w: 3, p: 179900, old: null, stock: 18 }] },
    { name: 'Farmina N&D Ocean Salmon Adult Medium', slug: 'farmina-nd-ocean-salmon-adult-med', brand: farmina, tags: ['species:dog', 'age:adult', 'size:medium', 'format:dry', 'philosophy:grainfree', 'flavor:fish', 'contains:fish', 'health:skin'], prices: [{ w: 2.5, p: 149900, old: 179900, stock: 30 }] },
    { name: 'Farmina N&D Quinoa Lamb Adult Large', slug: 'farmina-nd-quinoa-lamb-adult-large', brand: farmina, tags: ['species:dog', 'age:adult', 'size:large', 'format:dry', 'philosophy:lowgrain', 'flavor:lamb', 'contains:lamb', 'health:skin'], prices: [{ w: 3.5, p: 189900, old: 219900, stock: 22 }] },
    { name: 'Farmina N&D Medium Adult Chicken Giant', slug: 'farmina-nd-medium-adult-chicken-giant', brand: farmina, tags: ['species:dog', 'age:adult', 'size:giant', 'format:dry', 'philosophy:lowgrain', 'flavor:chicken', 'contains:chicken', 'health:joints'], prices: [{ w: 4, p: 229900, old: 259900, stock: 15 }] },
    // Собаки, сухой корм, пожилой, Farmina
    { name: 'Farmina N&D Senior Chicken Small', slug: 'farmina-nd-senior-chicken-small', brand: farmina, tags: ['species:dog', 'age:senior', 'size:small', 'format:dry', 'philosophy:grainfree', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 119900, old: 139900, stock: 18 }] },
    { name: 'Farmina N&D Senior Beef Adult Medium', slug: 'farmina-nd-senior-beef-adult-med', brand: farmina, tags: ['species:dog', 'age:senior', 'size:medium', 'format:dry', 'philosophy:lowgrain', 'flavor:beef', 'contains:beef'], prices: [{ w: 2.5, p: 159900, old: 189900, stock: 14 }] },
    // Собаки, влажный корм, Farmina
    { name: 'Farmina N&D Wet Chicken Puppy', slug: 'farmina-nd-wet-chicken-puppy', brand: farmina, tags: ['species:dog', 'age:puppy', 'format:wet', 'philosophy:grainfree', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 0.285, p: 8990, old: 9990, stock: 50 }] },
    { name: 'Farmina N&D Wet Lamb Adult', slug: 'farmina-nd-wet-lamb-adult', brand: farmina, tags: ['species:dog', 'age:adult', 'format:wet', 'philosophy:grainfree', 'flavor:lamb', 'contains:lamb'], prices: [{ w: 0.285, p: 8990, old: 9990, stock: 45 }] },
    // Монге собаки сухой
    { name: 'Monge BWild Grain Free Chicken Puppy', slug: 'monge-bwild-chicken-puppy', brand: monge, tags: ['species:dog', 'age:puppy', 'size:small', 'format:dry', 'philosophy:grainfree', 'flavor:chicken', 'contains:chicken', 'special:monoprotein'], prices: [{ w: 0.8, p: 54900, old: 64900, stock: 20 }] },
    { name: 'Monge Speciality Monoprotein Lamb Adult', slug: 'monge-speciality-mono-lamb-adult', brand: monge, tags: ['species:dog', 'age:adult', 'size:medium', 'format:dry', 'philosophy:lowgrain', 'flavor:lamb', 'contains:lamb', 'health:digestion', 'special:monoprotein'], prices: [{ w: 2.5, p: 139900, old: 159900, stock: 28 }] },
    { name: 'Monge Daily Chicken Rice Adult', slug: 'monge-daily-chicken-rice-adult', brand: monge, tags: ['species:dog', 'age:adult', 'size:large', 'format:dry', 'philosophy:classic', 'flavor:chicken', 'contains:chicken', 'contains:grain'], prices: [{ w: 3, p: 129900, old: 149900, stock: 32 }] },
    { name: 'Monge Speciality Senior Beef', slug: 'monge-speciality-senior-beef', brand: monge, tags: ['species:dog', 'age:senior', 'size:medium', 'format:dry', 'philosophy:lowgrain', 'flavor:beef', 'contains:beef', 'health:joints'], prices: [{ w: 2.5, p: 149900, old: 169900, stock: 16 }] },
    // Монге собаки влажный
    { name: 'Monge Wet Chicken Puppy', slug: 'monge-wet-chicken-puppy', brand: monge, tags: ['species:dog', 'age:puppy', 'format:wet', 'philosophy:grainfree', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 0.400, p: 10990, old: 11990, stock: 40 }] },
    // Hill's собаки
    { name: "Hill's Science Plan Puppy Chicken", slug: 'hills-science-plan-puppy-chicken', brand: hills, tags: ['species:dog', 'age:puppy', 'size:small', 'format:dry', 'philosophy:classic', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 119900, old: 139900, stock: 24 }] },
    { name: "Hill's Science Plan Adult Sensitive Skin", slug: 'hills-science-plan-adult-sensitive', brand: hills, tags: ['species:dog', 'age:adult', 'size:medium', 'format:dry', 'philosophy:classic', 'health:skin', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 2.5, p: 159900, old: 189900, stock: 20 }] },
    { name: "Hill's Science Plan Perfect Weight", slug: 'hills-science-plan-perfect-weight', brand: hills, tags: ['species:dog', 'age:adult', 'size:large', 'format:dry', 'philosophy:classic', 'weight:overweight', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 3, p: 169900, old: 199900, stock: 18 }] },
    { name: "Hill's Science Plan Large Breed", slug: 'hills-science-plan-large-breed', brand: hills, tags: ['species:dog', 'age:adult', 'size:giant', 'format:dry', 'philosophy:classic', 'health:joints', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 4, p: 199900, old: 229900, stock: 15 }] },
    // Happy Dog
    { name: 'Happy Dog Sensible Lamb Rice', slug: 'happy-dog-sensible-lamb-rice', brand: happyDog, tags: ['species:dog', 'age:adult', 'size:medium', 'format:dry', 'philosophy:lowgrain', 'flavor:lamb', 'contains:lamb', 'health:allergy', 'special:hypoallergenic'], prices: [{ w: 2.5, p: 129900, old: 149900, stock: 22 }] },
    { name: 'Happy Dog Fit & Vital Adult Chicken', slug: 'happy-dog-fit-vital-chicken', brand: happyDog, tags: ['species:dog', 'age:adult', 'size:small', 'format:dry', 'philosophy:classic', 'flavor:chicken', 'contains:chicken', 'activity:normal'], prices: [{ w: 1.5, p: 109900, old: 129900, stock: 26 }] },
    // Кошки, сухой корм, котёнок, Farmina
    { name: 'Farmina N&D Prime Kitten Chicken', slug: 'farmina-nd-prime-kitten-chicken', brand: farmina, tags: ['species:cat', 'age:kitten', 'size:all', 'format:dry', 'philosophy:grainfree', 'flavor:chicken', 'contains:chicken', 'special:monoprotein'], prices: [{ w: 0.8, p: 59900, old: 69900, stock: 18 }] },
    { name: 'Farmina N&D Prime Kitten Fish', slug: 'farmina-nd-prime-kitten-fish', brand: farmina, tags: ['species:cat', 'age:kitten', 'size:all', 'format:dry', 'philosophy:grainfree', 'flavor:fish', 'contains:fish'], prices: [{ w: 0.8, p: 59900, old: 69900, stock: 15 }] },
    // Кошки, сухой корм, взрослый, Farmina
    { name: 'Farmina N&D Pumpkin Chicken Adult Cat', slug: 'farmina-nd-pumpkin-chicken-cat', brand: farmina, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:grainfree', 'health:digestion', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 119900, old: 139900, stock: 20 }] },
    { name: 'Farmina N&D Quinoa Skin & Coat', slug: 'farmina-nd-quinoa-skin-coat-cat', brand: farmina, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:lowgrain', 'health:skin', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 119900, old: 139900, stock: 22 }] },
    { name: 'Farmina N&D Neutered Chicken', slug: 'farmina-nd-neutered-chicken-cat', brand: farmina, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:lowgrain', 'health:sterilized', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 119900, old: 139900, stock: 19 }] },
    { name: 'Farmina N&D Indoor Hairball', slug: 'farmina-nd-indoor-hairball-cat', brand: farmina, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:grainfree', 'health:hairball', 'lifestyle:indoor', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 119900, old: 139900, stock: 21 }] },
    { name: 'Farmina N&D Urinary Chicken', slug: 'farmina-nd-urinary-chicken-cat', brand: farmina, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:grainfree', 'health:urinary', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 129900, old: 149900, stock: 17 }] },
    // Кошки, сухой корм, пожилой, Farmina
    { name: 'Farmina N&D Senior Chicken Cat', slug: 'farmina-nd-senior-chicken-cat', brand: farmina, tags: ['species:cat', 'age:senior', 'size:all', 'format:dry', 'philosophy:grainfree', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 129900, old: 149900, stock: 16 }] },
    // Кошки, влажный корм, Farmina
    { name: 'Farmina N&D Wet Chicken Kitten Pouch', slug: 'farmina-nd-wet-chicken-kitten', brand: farmina, tags: ['species:cat', 'age:kitten', 'format:wet', 'philosophy:grainfree', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 0.085, p: 3990, old: 4490, stock: 60 }] },
    { name: 'Farmina N&D Wet Fish Adult Pouch', slug: 'farmina-nd-wet-fish-adult-cat', brand: farmina, tags: ['species:cat', 'age:adult', 'format:wet', 'philosophy:grainfree', 'flavor:fish', 'contains:fish', 'special:palatable'], prices: [{ w: 0.085, p: 3990, old: 4490, stock: 55 }] },
    // Монге кошки сухой
    { name: 'Monge Sterilised Chicken Cat', slug: 'monge-sterilised-chicken-cat', brand: monge, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:lowgrain', 'health:sterilized', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 109900, old: 129900, stock: 25 }] },
    { name: 'Monge Indoor Hairball', slug: 'monge-indoor-hairball-cat', brand: monge, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:lowgrain', 'health:hairball', 'lifestyle:indoor', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 109900, old: 129900, stock: 23 }] },
    { name: 'Monge Sensitive Cat Fish', slug: 'monge-sensitive-cat-fish', brand: monge, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:lowgrain', 'health:skin', 'flavor:fish', 'contains:fish', 'special:hypoallergenic'], prices: [{ w: 1.5, p: 119900, old: 139900, stock: 20 }] },
    // Монге кошки влажный
    { name: 'Monge Wet Chicken Adult Cat Pouch', slug: 'monge-wet-chicken-adult-cat', brand: monge, tags: ['species:cat', 'age:adult', 'format:wet', 'philosophy:lowgrain', 'flavor:chicken', 'contains:chicken', 'special:palatable'], prices: [{ w: 0.100, p: 4990, old: 5490, stock: 50 }] },
    // Hill's кошки
    { name: "Hill's Science Plan Kitten Chicken", slug: 'hills-science-plan-kitten-chicken', brand: hills, tags: ['species:cat', 'age:kitten', 'size:all', 'format:dry', 'philosophy:classic', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 119900, old: 139900, stock: 22 }] },
    { name: "Hill's Science Plan Sterilised Cat", slug: 'hills-science-plan-sterilised-cat', brand: hills, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:classic', 'health:sterilized', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 119900, old: 139900, stock: 21 }] },
    { name: "Hill's Science Plan Perfect Weight Cat", slug: 'hills-science-plan-perfect-weight-cat', brand: hills, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:classic', 'weight:overweight', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 129900, old: 149900, stock: 18 }] },
    { name: "Hill's Science Plan Hairball Indoor", slug: 'hills-science-plan-hairball-indoor', brand: hills, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:classic', 'health:hairball', 'lifestyle:indoor', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.5, p: 119900, old: 139900, stock: 19 }] },
    // Happy Cat
    { name: 'Happy Cat Sterilised Chicken', slug: 'happy-cat-sterilised-chicken', brand: happyCat, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:lowgrain', 'health:sterilized', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.4, p: 99900, old: 119900, stock: 24 }] },
    { name: 'Happy Cat Indoor Poultry', slug: 'happy-cat-indoor-poultry', brand: happyCat, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:lowgrain', 'lifestyle:indoor', 'flavor:chicken', 'contains:chicken'], prices: [{ w: 1.4, p: 99900, old: 119900, stock: 26 }] },
    { name: 'Happy Cat Sensitive Stomach & Skin', slug: 'happy-cat-sensitive-stomach', brand: happyCat, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:lowgrain', 'health:digestion', 'health:skin', 'flavor:fish', 'contains:fish'], prices: [{ w: 1.4, p: 109900, old: 129900, stock: 20 }] },
    { name: 'Happy Cat Culinary Adult Beef', slug: 'happy-cat-culinary-beef', brand: happyCat, tags: ['species:cat', 'age:adult', 'size:all', 'format:dry', 'philosophy:classic', 'flavor:beef', 'contains:beef', 'special:palatable'], prices: [{ w: 1.4, p: 99900, old: 119900, stock: 22 }] },
  ]

  // Добавление товаров
  for (const product of quizProducts) {
    if (!validateQuizTags(product.tags)) {
      console.error(`Invalid tags for ${product.slug}:`, product.tags)
      continue
    }

    const created = await prisma.product.upsert({
      where: { slug: product.slug },
      update: { quizTags: product.tags },
      create: {
        name: product.name,
        slug: product.slug,
        description: `${product.name} — высокое качество и питательность`,
        brandId: product.brand.id,
        images: [],
        isActive: true,
        quizTags: product.tags,
      },
    })

    for (const variant of product.prices) {
      const sku = `${product.slug.substring(0, 8).toUpperCase()}-${Math.random().toString(36).substring(7)}`
      await prisma.productVariant.upsert({
        where: { sku },
        update: {},
        create: {
          productId: created.id,
          weight: variant.w,
          price: variant.p,
          oldPrice: variant.old || null,
          stock: variant.stock,
          sku,
          isActive: true,
        },
      })
    }
  }

  console.log(`Quiz products: ${quizProducts.length} items created`)

  // Баннеры главной страницы
  // Баннеры владельца: текст уже нарисован на картинке (showText: false),
  // у каждого — своя версия для телефона. update повторяет create, чтобы
  // повторный сид обновлял содержимое, а не оставлял старые картинки.
  const homeBanners = [
    {
      id: 'banner-bonus-registration',
      title: '300 бонусов в подарок за регистрацию',
      subtitle: '1 бонус = 1 рубль. Оплачивайте бонусами до 50% следующего заказа',
      slug: 'bonus-registration',
      link: '/auth',
    },
    {
      id: 'banner-cashback-5',
      title: 'Возвращаем 5% бонусами с каждого заказа',
      subtitle: 'Бонусы действуют 6 месяцев',
      slug: 'cashback-5',
      link: '/bonuses',
    },
    {
      id: 'banner-free-delivery-pvz',
      title: 'Бесплатная доставка до пункта выдачи на любой заказ',
      subtitle: 'Яндекс Маркет и СДЭК',
      slug: 'free-delivery-pvz',
      link: '/delivery',
    },
    {
      id: 'banner-pickup-free',
      title: 'Заберите заказ уже через час самовывозом бесплатно',
      subtitle: 'Доставим по Москве за 1 день',
      slug: 'pickup-free',
      link: '/delivery',
    },
  ]

  for (const [index, b] of homeBanners.entries()) {
    const data = {
      title: b.title,
      subtitle: b.subtitle,
      image: `/banners/desktop/${b.slug}.webp`,
      imageMobile: `/banners/mobile/${b.slug}.webp`,
      showText: false,
      link: b.link,
      page: 'home' as const,
      position: 'main_slider' as const,
      sortOrder: index + 1,
      isActive: true,
    }
    await prisma.banner.upsert({ where: { id: b.id }, update: data, create: { id: b.id, ...data } })
  }
  // Старые демонстрационные слайды с котом и собакой больше не нужны.
  await prisma.banner.deleteMany({ where: { id: { in: ['banner-1-home', 'banner-2-home', 'banner-3-home'] } } })

  console.log(`Banners: ${homeBanners.length} items created`)

  // Суперадмин
  const admin = await prisma.user.upsert({
    where: { email: 'admin@simbazoo.ru' },
    update: {},
    create: {
      email: 'admin@simbazoo.ru',
      name: 'Администратор Simba',
      role: UserRole.super_admin,
      isActive: true,
    },
  })

  console.log('Admin:', admin.email)
  console.log('Seeding complete.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
