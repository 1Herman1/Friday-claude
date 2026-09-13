import { useEffect, useState } from 'react'
import { categoriesApi, type CategoryTreeNode } from '../lib/api'

/** Дерево категорий из админки, один запрос на вкладку. Пустой массив — пока грузится или API недоступен. */
let cache: CategoryTreeNode[] | null = null

export function useCategoryTree(): CategoryTreeNode[] {
  const [tree, setTree] = useState<CategoryTreeNode[]>(cache ?? [])
  useEffect(() => {
    if (cache) return
    let alive = true
    categoriesApi.tree()
      .then((r) => { cache = Array.isArray(r.data) ? r.data : [] })
      .catch(() => { cache = [] })
      .finally(() => { if (alive) setTree(cache ?? []) })
    return () => { alive = false }
  }, [])
  return tree
}

export function findNode(tree: CategoryTreeNode[], slug: string): CategoryTreeNode | undefined {
  for (const n of tree) {
    if (n.slug === slug) return n
    const inner = n.children ? findNode(n.children, slug) : undefined
    if (inner) return inner
  }
  return undefined
}
