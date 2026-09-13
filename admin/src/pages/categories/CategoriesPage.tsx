import { useEffect, useState } from 'react'
import { categoriesApi, bannersApi, type CategoryNode, type Category } from '../../lib/api'
import { ImageField } from '../../components/ImageField'

function autoSlug(n: string) {
  return n.toLowerCase().replace(/[а-яё]/g, (c: string) => ({
    а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'yo',ж:'zh',з:'z',и:'i',й:'y',
    к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',
    х:'h',ц:'ts',ч:'ch',ш:'sh',щ:'sch',ъ:'',ы:'y',ь:'',э:'e',ю:'yu',я:'ya'
  }[c] ?? c)).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

const empty = (parentId?: string): Partial<Category> => ({
  name: '',
  slug: '',
  description: '',
  seoTitle: '',
  seoDescription: '',
  sortOrder: 0,
  parentId,
  isActive: true,
})

interface EditingNode {
  id: string | null
  data: Partial<Category>
  parentId?: string
}

function TreeRow({
  node,
  depth,
  siblings,
  allNodes,
  onEdit,
  onToggleActive,
  onMove,
  onAddChild,
  onDelete,
  onReorder,
}: {
  node: CategoryNode
  depth: number
  siblings: CategoryNode[]
  allNodes: CategoryNode[]
  onEdit: (id: string, data: Partial<Category>) => void
  onToggleActive: (id: string, active: boolean) => void
  onMove: (id: string, newParentId?: string) => void
  onAddChild: (parentId: string) => void
  onDelete: (id: string, name: string) => void
  onReorder: (id: string, direction: 'up' | 'down') => void
}) {
  const idx = siblings.findIndex(s => s.id === node.id)
  const canMoveUp = idx > 0
  const canMoveDown = idx < siblings.length - 1

  const getAllAncestorIds = (id: string): Set<string> => {
    const ancestors = new Set<string>()
    const find = (nodeId: string) => {
      const parent = allNodes.find(n => n.children.some(c => c.id === nodeId))
      if (parent) {
        ancestors.add(parent.id)
        find(parent.id)
      }
    }
    find(id)
    return ancestors
  }

  const getValidParents = (): CategoryNode[] => {
    const ancestorIds = getAllAncestorIds(node.id)
    const traverse = (nodes: CategoryNode[]): CategoryNode[] => {
      return nodes.filter(n => n.id !== node.id && !ancestorIds.has(n.id))
        .map(n => ({
          ...n,
          children: traverse(n.children),
        }))
    }
    return traverse(allNodes)
  }

  const validParents = getValidParents()
  const parentName = node.parentId
    ? allNodes.find(n => n.id === node.parentId)?.name || 'Неизвестно'
    : 'Корень'

  return (
    <>
      <div
        className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-50"
        style={{ paddingLeft: `${16 + depth * 24}px` }}
      >
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{node.name}</p>
          <p className="text-xs text-gray-400 font-mono">{node.slug}</p>
        </div>

        <div className="flex items-center gap-3 text-sm text-gray-600">
          <span className="text-xs bg-gray-100 px-2 py-1 rounded">
            {node.productCount} товаров
          </span>

          <button
            onClick={() => onToggleActive(node.id, !node.isActive)}
            className={`text-xs px-2 py-1 rounded font-medium transition-colors ${
              node.isActive
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {node.isActive ? 'Показано' : 'Скрыто'}
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => onReorder(node.id, 'up')}
            disabled={!canMoveUp}
            className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 text-sm"
            title="Переместить выше"
          >
            ↑
          </button>
          <button
            onClick={() => onReorder(node.id, 'down')}
            disabled={!canMoveDown}
            className="px-2 py-1 text-gray-500 hover:bg-gray-100 rounded disabled:opacity-30 text-sm"
            title="Переместить ниже"
          >
            ↓
          </button>
        </div>

        <div className="flex items-center gap-2">
          {depth > 0 && (
            <button
              onClick={() => onMove(node.id, undefined)}
              className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-700 hover:bg-gray-100"
              title="Переместить в корень"
            >
              В корень
            </button>
          )}

          <select
            value={node.parentId || ''}
            onChange={e => {
              const newParentId = e.target.value || undefined
              onMove(node.id, newParentId)
            }}
            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-700 hover:bg-gray-100 focus:outline-none"
            disabled={validParents.length === 0}
          >
            <option value="">{depth > 0 ? 'Переместить в…' : 'Выбрать родителя'}</option>
            {validParents.map(parent => (
              <option key={parent.id} value={parent.id}>
                {parent.name}
              </option>
            ))}
          </select>

          <button
            onClick={() => onEdit(node.id, { ...node })}
            className="text-xs px-2 py-1 rounded border border-gray-200 text-blue-600 hover:bg-blue-50"
          >
            Редактировать
          </button>

          <button
            onClick={() => onAddChild(node.id)}
            className="text-xs px-2 py-1 rounded border border-gray-200 text-gray-700 hover:bg-gray-100"
          >
            + Подкатегория
          </button>

          <button
            onClick={() => onDelete(node.id, node.name)}
            className="text-xs px-2 py-1 rounded border border-red-200 text-red-600 hover:bg-red-50"
          >
            Удалить
          </button>
        </div>
      </div>

      {node.children.map(child => (
        <TreeRow
          key={child.id}
          node={child}
          depth={depth + 1}
          siblings={node.children}
          allNodes={allNodes}
          onEdit={onEdit}
          onToggleActive={onToggleActive}
          onMove={onMove}
          onAddChild={onAddChild}
          onDelete={onDelete}
          onReorder={onReorder}
        />
      ))}
    </>
  )
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryNode[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EditingNode | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const loadCategories = () => {
    setLoading(true)
    setError('')
    categoriesApi.list()
      .then(r => setCategories(r.data.items))
      .catch(() => setError('Не удалось загрузить категории'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadCategories()
  }, [])

  const handleEdit = (id: string, data: Partial<Category>) => {
    setEditing({ id, data })
    setError('')
  }

  const handleAddChild = (parentId: string) => {
    setEditing({ id: null, data: empty(parentId), parentId })
    setError('')
  }

  const handleAddRoot = () => {
    setEditing({ id: null, data: empty(), parentId: undefined })
    setError('')
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !editing) return

    setUploading(true)
    try {
      const res = await bannersApi.uploadImage(file)
      setField('image', res.data.url)
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Ошибка загрузки картинки')
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async () => {
    if (!editing?.data.name) {
      setError('Введите название')
      return
    }

    let slug = editing.data.slug
    if (!slug) {
      slug = autoSlug(editing.data.name)
    }

    const payload = {
      name: editing.data.name,
      slug,
      description: editing.data.description,
      image: editing.data.image,
      seoTitle: editing.data.seoTitle,
      seoDescription: editing.data.seoDescription,
      parentId: editing.data.parentId,
      sortOrder: editing.data.sortOrder ?? 0,
      isActive: editing.data.isActive ?? true,
    }

    setSaving(true)
    setError('')
    try {
      if (editing.id) {
        await categoriesApi.update(editing.id, payload)
      } else {
        await categoriesApi.create(payload)
      }
      loadCategories()
      setEditing(null)
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Удалить категорию "${name}"?`)) return
    try {
      await categoriesApi.delete(id)
      loadCategories()
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Ошибка удаления')
    }
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      await categoriesApi.update(id, { isActive: active })
      loadCategories()
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Ошибка обновления')
    }
  }

  const handleMove = async (id: string, newParentId?: string) => {
    try {
      await categoriesApi.update(id, { parentId: newParentId })
      loadCategories()
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Ошибка перемещения')
    }
  }

  const handleReorder = async (id: string, direction: 'up' | 'down') => {
    // Find all nodes and their siblings
    const allNodesFlat: { node: CategoryNode; parent?: CategoryNode }[] = []
    const traverse = (nodes: CategoryNode[], parent?: CategoryNode) => {
      nodes.forEach(node => {
        allNodesFlat.push({ node, parent })
        traverse(node.children, node)
      })
    }
    traverse(categories)

    const entry = allNodesFlat.find(e => e.node.id === id)
    if (!entry) return

    const siblings = entry.parent ? entry.parent.children : categories
    const idx = siblings.findIndex(s => s.id === id)

    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === siblings.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const swapNode = siblings[swapIdx]

    // Update both sortOrders
    const items = [
      { id: entry.node.id, parentId: entry.node.parentId, sortOrder: swapNode.sortOrder },
      { id: swapNode.id, parentId: swapNode.parentId, sortOrder: entry.node.sortOrder },
    ]

    try {
      await categoriesApi.reorder(items)
      loadCategories()
    } catch (e: any) {
      alert(e?.response?.data?.error || 'Ошибка переупорядочивания')
    }
  }

  const setField = (field: keyof Category, value: unknown) =>
    setEditing(prev => prev ? { ...prev, data: { ...prev.data, [field]: value } } : prev)

  const allNodes = (() => {
    const result: CategoryNode[] = []
    const traverse = (nodes: CategoryNode[]): void => {
      nodes.forEach(node => {
        result.push(node)
        traverse(node.children)
      })
    }
    traverse(categories)
    return result
  })()

  const getValidParents = (nodeId: string): CategoryNode[] => {
    const getAllAncestorIds = (id: string): Set<string> => {
      const ancestors = new Set<string>()
      const find = (nodeId: string) => {
        const parent = allNodes.find(n => n.children.some(c => c.id === nodeId))
        if (parent) {
          ancestors.add(parent.id)
          find(parent.id)
        }
      }
      find(id)
      return ancestors
    }

    const ancestorIds = getAllAncestorIds(nodeId)
    const traverse = (nodes: CategoryNode[]): CategoryNode[] => {
      return nodes.filter(n => n.id !== nodeId && !ancestorIds.has(n.id))
        .map(n => ({
          ...n,
          children: traverse(n.children),
        }))
    }
    return traverse(allNodes)
  }

  const flatParents = (editing?.id ? getValidParents(editing.id) : allNodes).flatMap(n => {
    const flatten = (node: CategoryNode, depth: number): Array<CategoryNode & { depth: number }> => [
      { ...node, depth },
      ...node.children.flatMap(c => flatten(c, depth + 1))
    ]
    return flatten(n, 0)
  })

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-gray-900">Категории</h1>
        <button
          onClick={handleAddRoot}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors"
        >
          + Категория
        </button>
      </div>

      {/* Edit Modal */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-lg p-6 max-w-lg w-full mx-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editing.id ? 'Редактировать категорию' : 'Новая категория'}
            </h2>

            {error && <p className="text-red-500 text-sm mb-3 bg-red-50 px-3 py-2 rounded">{error}</p>}

            <div className="grid gap-3 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Название *</label>
                <input
                  value={editing.data.name ?? ''}
                  onChange={e => {
                    setField('name', e.target.value)
                    if (!editing.id) setField('slug', autoSlug(e.target.value))
                  }}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug *</label>
                <input
                  value={editing.data.slug ?? ''}
                  onChange={e => setField('slug', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Описание</label>
                <input
                  value={editing.data.description ?? ''}
                  onChange={e => setField('description', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SEO Заголовок</label>
                <input
                  value={editing.data.seoTitle ?? ''}
                  onChange={e => setField('seoTitle', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">SEO Описание</label>
                <input
                  value={editing.data.seoDescription ?? ''}
                  onChange={e => setField('seoDescription', e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Родитель</label>
                <select
                  value={editing.data.parentId ?? ''}
                  onChange={e => setField('parentId', e.target.value || undefined)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                >
                  <option value="">Корень</option>
                  {flatParents.map(p => (
                    <option key={p.id} value={p.id}>
                      {'  '.repeat(p.depth)}{p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Порядок</label>
                <input
                  type="number"
                  value={editing.data.sortOrder ?? 0}
                  onChange={e => setField('sortOrder', parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <ImageField
                  label="Картинка"
                  hint="квадрат ≥ 600 px"
                  placeholder="/categories/dogs.png"
                  value={editing.data.image ?? ''}
                  onChange={v => setField('image', v)}
                  onFile={handleImageUpload}
                  uploading={uploading}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Сохраняем...' : 'Сохранить'}
              </button>
              <button
                onClick={() => setEditing(null)}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-xl hover:bg-gray-200"
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tree */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full" />
          </div>
        ) : categories.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400">Категорий пока нет</div>
        ) : (
          <div className="divide-y divide-gray-50">
            {categories.map(node => (
              <TreeRow
                key={node.id}
                node={node}
                depth={0}
                siblings={categories}
                allNodes={allNodes}
                onEdit={handleEdit}
                onToggleActive={handleToggleActive}
                onMove={handleMove}
                onAddChild={handleAddChild}
                onDelete={handleDelete}
                onReorder={handleReorder}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
