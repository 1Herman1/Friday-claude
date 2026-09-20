import { imageSrc } from '../lib/media'

/** Адрес картинки можно и вписать руками, и загрузить файлом: файлы из
    client/public/banners/ лежат в репозитории и не требуют хранилища, а
    загруженные — наоборот. Раньше было только второе, и путь из папки вписать
    было некуда. */
export function ImageField({
  label, hint, placeholder, value, onChange, onFile, uploading,
}: {
  label: string
  hint: string
  placeholder: string
  value: string
  onChange: (value: string) => void
  onFile: (e: React.ChangeEvent<HTMLInputElement>) => void
  uploading: boolean
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-blue-400"
      />
      <div className="flex items-center gap-3 mt-2">
        {/* Родной выбор файла спрятан: браузер рисует в нём английские
            «Choose File» и «No file chosen», а админка русская. */}
        <label className="px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-sm font-medium cursor-pointer hover:bg-blue-100">
          Загрузить файл
          <input type="file" accept="image/*" onChange={onFile} disabled={uploading} className="sr-only" />
        </label>
        <span className="text-xs text-gray-500">{uploading ? 'Загружаем…' : hint}</span>
      </div>
      {value && (
        <img
          src={imageSrc(value)}
          alt=""
          className="mt-2 h-20 rounded-lg object-cover bg-gray-50"
          onError={(e) => { e.currentTarget.style.display = 'none' }}
        />
      )}
    </div>
  )
}
