import { FastifyInstance } from 'fastify'
import { getProductBySlug, getRelatedProducts } from '../../services/product.service'

export default async function singleRoute(app: FastifyInstance) {
  app.get<{ Params: { slug: string } }>('/:slug', async (request, reply) => {
    const { slug } = request.params

    const product = await getProductBySlug(app.prisma, slug)
    if (!product) {
      return reply.status(404).send({ error: 'Product not found' })
    }

    const categoryIds = product.categories.map((c) => c.categoryId)
    const related = await getRelatedProducts(app.prisma, product.id, categoryIds)

    const categories = product.categories.map((c) => ({
      id: c.category.id,
      name: c.category.name,
      slug: c.category.slug,
    }))

    const filterValues = product.filterValues.map((fv) => ({
      id: fv.filterValue.id,
      value: fv.filterValue.value,
      filter: { name: fv.filterValue.filter.name },
    }))

    return reply.send({
      id: product.id,
      name: product.name,
      slug: product.slug,
      description: product.description,
      images: product.images,
      brand: product.brand,
      isGrainFree: product.isGrainFree,
      isHypoallergenic: product.isHypoallergenic,
      isWeightControl: product.isWeightControl,
      protein: product.protein,
      fat: product.fat,
      fiber: product.fiber,
      ash: product.ash,
      ingredients: product.ingredients,
      showAboutTab: product.showAboutTab,
      showSpecsTab: product.showSpecsTab,
      showReviewsTab: product.showReviewsTab,
      categories,
      variants: product.variants,
      filterValues,
      related,
    })
  })
}
