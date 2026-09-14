import { createHash } from 'node:crypto'
import { FastifyPluginAsync } from 'fastify'
import { checkRole } from '../../middleware/check-role'
import {
  parseRows,
  mapRow,
  transliterate,
  parseWeightFromName,
  detectBrand,
  isNonProductRow,
  type ImportRow,
} from '../../services/product-import'
import { determineSpecies } from '../../services/quiz-autotag'

const importRoute: FastifyPluginAsync = async (app) => {
  const guard = { preHandler: [app.authenticate, checkRole(['super_admin', 'products_manager'])] }

  app.post('/csv', guard, async (request, reply) => {
    const file = await request.file()
    if (!file) return reply.status(400).send({ error: 'Файл не загружен' })

    const chunks: Buffer[] = []
    for await (const chunk of file.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    const rows = parseRows(buffer, file.filename)
    if (rows.length === 0) return reply.status(400).send({ error: 'Файл пустой или нет данных' })

    const created: string[] = []
    const updated: string[] = []
    const skippedNoPrice: string[] = []
    const skippedEmpty: number[] = []
    const skippedNonProduct: string[] = []
    const variantsWithoutPrice: number[] = []
    const createdBrands: string[] = []
    const createdCategories: string[] = []
    const errors: string[] = []

    // Кеши на время импорта
    const brandCache = new Map<string, string>() // slug → id
    const categoryCache = new Map<string, string>() // slug → id
    // Категорий вида ровно две (dogs/cats) — один запрос на весь импорт, а не на каждую строку.
    const speciesCategoryIds = new Map(
      (await app.prisma.category.findMany({
        where: { kind: 'species', isActive: true, species: { in: ['dog', 'cat'] } },
        select: { id: true, species: true },
      })).map((c) => [c.species, c.id] as const),
    )
    const filterCache = new Map<string, string>() // slug → id
    const filterValueCache = new Map<string, string>() // filterSlug|valueSlug → id

    for (let i = 0; i < rows.length; i++) {
      const rawRow = rows[i]
      const rowNum = i + 2

      try {
        const row = mapRow(rawRow)

        // 1. Пропуск пустых строк молча (имя пусто И все атрибуты пусты)
        if (!row.name && row.attributes.length === 0) {
          skippedEmpty.push(rowNum)
          continue
        }

        // 2. Проверка обязательного поля name (если есть атрибуты, но нет имени)
        if (!row.name) {
          errors.push(`Строка ${rowNum}: пропущено обязательное поле «Имя» (есть атрибуты)`)
          continue
        }

        // 3. Отсев складских/хозяйственных материалов (не товары магазина)
        if (isNonProductRow(row.name)) {
          skippedNonProduct.push(row.name)
          continue
        }

        // 4. Парсим вес из имени товара (для группировки фасовок)
        const { baseName, weightKg } = parseWeightFromName(row.name)

        // 5. Определяем бренд по названию (если не указан в файле)
        let brandNameToUse = row.brandName
        if (!brandNameToUse) {
          const detectedBrand = detectBrand(row.name)
          if (detectedBrand) {
            brandNameToUse = detectedBrand
          }
        }

        // 6. Генерация/проверка slug (используем baseName для группировки фасовок)
        let slug = row.slug
        if (!slug) {
          slug = transliterate(baseName)
        }
        if (!slug) {
          // Название без букв и цифр (эмодзи, знаки препинания) — транслитерация
          // даёт пустоту, а slug уникальный и участвует в URL карточки.
          // Хэш от названия устойчив: повторный импорт узнает тот же товар.
          slug =
            transliterate(row.sku ?? '') ||
            `product-${createHash('sha1').update(row.name).digest('hex').slice(0, 8)}`
        }

        // Проверка уникальности slug
        let finalSlug = slug
        let suffix = 2
        while (true) {
          const existing = await app.prisma.product.findUnique({
            where: { slug: finalSlug },
            select: { id: true, name: true },
          })

          if (!existing) {
            // Slug свободен
            break
          }

          if (existing.name === baseName) {
            // Тот же товар (другая фасовка) — обновим его
            break
          }

          // Slug занят другим товаром, подбираем новый
          finalSlug = `${slug}-${suffix}`
          suffix++
        }

        slug = finalSlug

        // 7. Бренд
        let brandId: string | undefined
        if (brandNameToUse || row.brandSlug) {
          const brandSlug = row.brandSlug || transliterate(brandNameToUse!)
          const cachedId = brandCache.get(brandSlug)

          if (cachedId) {
            brandId = cachedId
          } else {
            const brand = await app.prisma.brand.findUnique({
              where: { slug: brandSlug },
              select: { id: true },
            })

            if (brand) {
              brandId = brand.id
              brandCache.set(brandSlug, brandId)
            } else {
              // Создаём бренд
              const newBrand = await app.prisma.brand.create({
                data: {
                  name: brandNameToUse || row.brandSlug || '',
                  slug: brandSlug,
                },
                select: { id: true },
              })
              brandId = newBrand.id
              brandCache.set(brandSlug, brandId)
              createdBrands.push(brandNameToUse || row.brandSlug || '')
            }
          }
        }

        // 8. Товар (upsert)
        const existingProduct = await app.prisma.product.findUnique({
          where: { slug },
          include: { variants: true },
        })

        let productId: string
        let isNewProduct = false

        if (!existingProduct) {
          // Создаём новый товар
          const product = await app.prisma.product.create({
            data: {
              name: baseName,
              slug,
              description: row.description || baseName,
              brandId,
              images: row.images,
              isActive: false, // Станет true если будет цена и вес
            },
            select: { id: true },
          })
          productId = product.id
          isNewProduct = true
        } else {
          // Обновляем существующий товар
          await app.prisma.product.update({
            where: { slug },
            data: {
              name: baseName,
              description: row.description || baseName,
              brandId,
              images: row.images,
            },
          })
          productId = existingProduct.id
        }

        // 9. Вариант (создаём если есть цена и вес, или если есть только вес)
        let hasVariant = false
        const finalWeight = weightKg ?? row.weight
        const finalPrice = row.price

        if (finalPrice !== undefined && finalWeight !== undefined) {
          let variant = null

          if (row.sku) {
            // Проверяем, не принадлежит ли SKU другому товару
            const skuOwner = await app.prisma.productVariant.findUnique({
              where: { sku: row.sku },
              select: { productId: true },
            })

            if (skuOwner && skuOwner.productId !== productId) {
              errors.push(`Строка ${rowNum}: SKU "${row.sku}" принадлежит другому товару`)
              continue
            }

            variant = await app.prisma.productVariant.findFirst({
              where: { productId, sku: row.sku },
            })
          } else {
            variant = await app.prisma.productVariant.findFirst({
              where: { productId, weight: finalWeight },
            })
          }

          if (variant) {
            // Обновляем вариант (только если файл содержит реальную цену)
            await app.prisma.productVariant.update({
              where: { id: variant.id },
              data: {
                price: Math.round(finalPrice * 100),
                oldPrice: row.oldPrice ? Math.round(row.oldPrice * 100) : undefined,
                stock: row.stock || 0,
                sku: row.sku,
                // Фасовка могла быть заведена без цены и скрыта — цена пришла, возвращаем в продажу.
                isActive: true,
              },
            })
          } else {
            // Создаём новый вариант
            await app.prisma.productVariant.create({
              data: {
                productId,
                weight: finalWeight,
                price: Math.round(finalPrice * 100),
                oldPrice: row.oldPrice ? Math.round(row.oldPrice * 100) : undefined,
                stock: row.stock || 0,
                sku: row.sku,
              },
            })
          }

          hasVariant = true

          // Активируем товар только если есть вариант с ценой
          await app.prisma.product.update({
            where: { id: productId },
            data: { isActive: true },
          })
        } else if (finalWeight !== undefined && finalPrice === undefined) {
          // Есть вес но нет цены — создаём вариант с price: 0, stock: 0
          const variantByWeight = await app.prisma.productVariant.findFirst({
            where: { productId, weight: finalWeight },
          })

          if (!variantByWeight) {
            // Создаём вариант с нулевой ценой
            await app.prisma.productVariant.create({
              data: {
                productId,
                weight: finalWeight,
                price: 0,
                stock: 0,
                sku: row.sku,
                // Цены нет — фасовка не должна появиться в карточке товара,
                // даже если сам товар уже продаётся.
                isActive: false,
              },
            })
            variantsWithoutPrice.push(rowNum)
          }
        }

        if (finalPrice !== undefined && finalWeight === undefined) {
          // Цена в каталоге живёт у фасовки, а не у товара — вешать её не на что.
          errors.push(
            `Строка ${rowNum}: цена указана, но не определён вес — добавьте колонку «Вес» или фасовку в название («- 2 кг»)`
          )
        }

        if (!hasVariant) {
          // Файл без цены не должен снимать с продажи товар, у которого цена уже есть.
          const variantCount = await app.prisma.productVariant.count({
            where: { productId },
          })

          if (variantCount === 0) {
            await app.prisma.product.update({
              where: { id: productId },
              data: { isActive: false },
            })
            skippedNoPrice.push(row.name)
          }
        }

        // 10. Категории
        for (const categoryName of row.categories) {
          const categorySlug = transliterate(categoryName)
          const cachedId = categoryCache.get(categorySlug)

          let categoryId: string

          if (cachedId) {
            categoryId = cachedId
          } else {
            const category = await app.prisma.category.findUnique({
              where: { slug: categorySlug },
              select: { id: true },
            })

            if (category) {
              categoryId = category.id
              categoryCache.set(categorySlug, categoryId)
            } else {
              // Создаём категорию
              const newCategory = await app.prisma.category.create({
                data: {
                  name: categoryName,
                  slug: categorySlug,
                  isActive: true,
                },
                select: { id: true },
              })
              categoryId = newCategory.id
              categoryCache.set(categorySlug, categoryId)
              createdCategories.push(categoryName)
            }
          }

          // Связываем товар с категорией
          await app.prisma.productCategory.upsert({
            where: { productId_categoryId: { productId, categoryId } },
            create: { productId, categoryId },
            update: {},
          })
        }

        // Вид животного для нового товара. Без этого каждая загрузка из
        // МоегоСклада добавляла бы товары, не попадающие ни в «Кошки», ни в
        // «Собаки», — и владелец узнавал бы об этом от покупателя.
        // Уже проставленный вид не трогаем: он мог быть выбран вручную.
        let speciesForCategory: 'dog' | 'cat' | null = null
        if (!existingProduct || existingProduct.species === 'unknown') {
          const guessed = determineSpecies(baseName, [
            ...row.categories,
            ...row.categories.map(transliterate),
          ])
          if (guessed) {
            await app.prisma.product.update({
              where: { id: productId },
              data: { species: guessed },
            })
            speciesForCategory = guessed
          }
        } else if (existingProduct.species === 'dog' || existingProduct.species === 'cat') {
          speciesForCategory = existingProduct.species
        }

        // Если определен вид животного (dog или cat), привязываем товар к категории вида
        if (speciesForCategory) {
          const speciesCategoryId = speciesCategoryIds.get(speciesForCategory)

          if (speciesCategoryId) {
            await app.prisma.productCategory.upsert({
              where: { productId_categoryId: { productId, categoryId: speciesCategoryId } },
              create: { productId, categoryId: speciesCategoryId },
              update: {},
            })
          }
        }

        // 11. Атрибуты (фильтры и значения)
        for (const attr of row.attributes) {
          const filterSlug = transliterate(attr.name)
          const cachedFilterId = filterCache.get(filterSlug)

          let filterId: string

          if (cachedFilterId) {
            filterId = cachedFilterId
          } else {
            const filter = await app.prisma.filter.findUnique({
              where: { slug: filterSlug },
              select: { id: true },
            })

            if (filter) {
              filterId = filter.id
              filterCache.set(filterSlug, filterId)
            } else {
              // Создаём фильтр
              const newFilter = await app.prisma.filter.create({
                data: {
                  name: attr.name,
                  slug: filterSlug,
                  type: 'checkbox',
                },
                select: { id: true },
              })
              filterId = newFilter.id
              filterCache.set(filterSlug, filterId)
            }
          }

          // FilterValue
          const valueSlug = transliterate(attr.value)
          const filterValueKey = `${filterSlug}|${valueSlug}`
          const cachedValueId = filterValueCache.get(filterValueKey)

          let filterValueId: string

          if (cachedValueId) {
            filterValueId = cachedValueId
          } else {
            const filterValue = await app.prisma.filterValue.findUnique({
              where: { filterId_slug: { filterId, slug: valueSlug } },
              select: { id: true },
            })

            if (filterValue) {
              filterValueId = filterValue.id
              filterValueCache.set(filterValueKey, filterValueId)
            } else {
              // Создаём значение фильтра
              const newFilterValue = await app.prisma.filterValue.create({
                data: {
                  filterId,
                  value: attr.value,
                  slug: valueSlug,
                },
                select: { id: true },
              })
              filterValueId = newFilterValue.id
              filterValueCache.set(filterValueKey, filterValueId)
            }
          }

          // Связываем товар с значением фильтра
          await app.prisma.productFilterValue.upsert({
            where: { productId_filterValueId: { productId, filterValueId } },
            create: { productId, filterValueId },
            update: {},
          })
        }

        // Добавляем в статистику
        if (isNewProduct) {
          created.push(row.name)
        } else if (!existingProduct) {
          // Это не должно случиться, но на всякий случай
        } else {
          updated.push(row.name)
        }
      } catch (e) {
        errors.push(`Строка ${rowNum}: ошибка — ${e instanceof Error ? e.message : 'unknown'}`)
      }
    }

    return reply.send({
      created: created.length,
      updated: updated.length,
      skippedEmpty: skippedEmpty.length,
      skippedNoPrice,
      skippedNonProduct,
      variantsWithoutPrice: variantsWithoutPrice.length,
      createdBrands,
      createdCategories,
      errors,
    })
  })
}

export default importRoute
