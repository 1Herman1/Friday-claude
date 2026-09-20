import { useState, useRef } from 'react'
import { productsApi } from '../../lib/api'

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    created: number
    updated: number
    skippedNoPrice: string[]
    skippedNonProduct: string[]
    createdBrands: string[]
    createdCategories: string[]
    errors: string[]
  } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null)
    setResult(null)
  }

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    setResult(null)
    try {
      const res = await productsApi.importCsv(file)
      setResult(res.data)
    } catch (e: any) {
      setResult({
        created: 0,
        updated: 0,
        skippedNoPrice: [],
        skippedNonProduct: [],
        createdBrands: [],
        createdCategories: [],
        errors: [e?.response?.data?.error || 'Ошибка загрузки'],
      })
    } finally { setLoading(false) }
  }

  const csvExample = `name,slug,description,brandSlug,price,oldPrice,stock,weight,sku
Корм для собак Premium,korm-premium,Сухой корм,royal-canin,499,599,50,1.5,RC-001
Корм для кошек Light,korm-light-cat,Диетический корм,,399,,30,0.4,`

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-gray-900 mb-6">Импорт товаров</h1>

      {/* Format description */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
        <h2 className="font-semibold text-blue-900 mb-3 text-sm">Формат файла (CSV или Excel)</h2>
        <div className="space-y-3 text-sm text-blue-700">
          <div>
            <p className="font-medium mb-1">Английский формат (простой):</p>
            <p>Колонки: <code className="bg-blue-100 px-1 rounded text-xs">name, slug, description, brandSlug, price, oldPrice, stock, weight, sku</code></p>
          </div>
          <div>
            <p className="font-medium mb-1">WooCommerce (русский):</p>
            <p>Колонки: <code className="bg-blue-100 px-1 rounded text-xs">Имя, Артикул, Наименование, Цена, Акционная цена, Вес, Запасы, Категории, Изображения, Бренд</code></p>
            <p className="text-xs mt-1">Плюс опционально: <code className="bg-blue-100 px-1 rounded">Название атрибута N, Значение атрибута N</code> (автоматически разберутся)</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-blue-100 p-3 overflow-x-auto mt-3">
          <pre className="text-xs text-gray-700 font-mono whitespace-pre">{csvExample}</pre>
        </div>
        <p className="text-xs text-blue-600 mt-3">
          <span className="font-medium">Цены:</span> в рублях (не копейках), дробные через точку или запятую. Если две цены — меньшая = цена, большая = зачёркнутая.
        </p>
        <p className="text-xs text-blue-600">
          <span className="font-medium">Товары без цены/веса:</span> скрываются из каталога (isActive=false).
        </p>
      </div>

      {/* Upload area */}
      <div
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-blue-300 hover:bg-blue-50/30 transition-colors mb-4"
      >
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
        {file ? (
          <>
            <p className="font-medium text-gray-900">{file.name}</p>
            <p className="text-sm text-gray-500">{(file.size / 1024).toFixed(1)} КБ</p>
          </>
        ) : (
          <>
            <p className="font-medium text-gray-700">Нажмите или перетащите файл</p>
            <p className="text-sm text-gray-400">CSV, XLSX или XLS, до 10 МБ</p>
          </>
        )}
      </div>

      <button
        onClick={handleImport}
        disabled={!file || loading}
        className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 mb-6"
      >
        {loading ? 'Загружаем...' : 'Импортировать товары'}
      </button>

      {result && (
        <div className="space-y-4">
          {/* Summary */}
          <div className={`rounded-xl border p-5 ${
            result.created > 0 || result.updated > 0
              ? 'bg-green-50 border-green-200'
              : 'bg-orange-50 border-orange-200'
          }`}>
            <p className={`font-semibold mb-2 ${
              result.created > 0 || result.updated > 0
                ? 'text-green-800'
                : 'text-orange-800'
            }`}>
              {result.created + result.updated > 0
                ? `Успешно: ${result.created} создано, ${result.updated} обновлено`
                : 'Товары не добавлены'}
            </p>
          </div>

          {/* Skipped (no price/weight) */}
          {result.skippedNoPrice.length > 0 && (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
              <p className="font-semibold text-orange-800 mb-2">
                Загружено без цены ({result.skippedNoPrice.length}) — скрыты из каталога:
              </p>
              <ul className="text-sm text-orange-700 space-y-1">
                {result.skippedNoPrice.map((name, i) => <li key={i}>• {name}</li>)}
              </ul>
            </div>
          )}

          {/* Skipped (non-product) */}
          {result.skippedNonProduct.length > 0 && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 p-5">
              <p className="font-semibold text-purple-800 mb-2">
                Пропущено как не-товар ({result.skippedNonProduct.length}):
              </p>
              <ul className="text-sm text-purple-700 space-y-1">
                {result.skippedNonProduct.map((name, i) => <li key={i}>• {name}</li>)}
              </ul>
            </div>
          )}

          {/* Created brands */}
          {result.createdBrands.length > 0 && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-5">
              <p className="font-semibold text-blue-800 mb-2">
                Создано брендов ({result.createdBrands.length}):
              </p>
              <ul className="text-sm text-blue-700 space-y-1">
                {result.createdBrands.map((name, i) => <li key={i}>• {name}</li>)}
              </ul>
            </div>
          )}

          {/* Created categories */}
          {result.createdCategories.length > 0 && (
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-5">
              <p className="font-semibold text-teal-800 mb-2">
                Создано категорий ({result.createdCategories.length}):
              </p>
              <ul className="text-sm text-teal-700 space-y-1">
                {result.createdCategories.map((name, i) => <li key={i}>• {name}</li>)}
              </ul>
            </div>
          )}

          {/* Errors */}
          {result.errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5">
              <p className="font-semibold text-red-800 mb-2">
                Ошибки ({result.errors.length}):
              </p>
              <ul className="text-sm text-red-600 space-y-1">
                {result.errors.map((e, i) => <li key={i}>• {e}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
