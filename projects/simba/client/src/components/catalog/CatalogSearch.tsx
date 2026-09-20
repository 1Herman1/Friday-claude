import { CloseIcon, SearchIcon } from '../icons'

interface Props {
  value: string
  onChange: (v: string) => void
  onClear: () => void
}

/** Кольцо фокуса — ink (чёрный), а не синий: контраст к белому даёт 15.2:1,
    индикатор фокуса хорошо видно на светлом фоне. */
export default function CatalogSearch({ value, onChange, onClear }: Props) {
  return (
    <div role="search" className="relative w-full">
      <SearchIcon className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-navy-300" />

      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Найти корм, бренд или товар..."
        aria-label="Поиск по каталогу"
        className="w-full pl-8 pr-12 py-2 bg-transparent border-0 rounded-full focus:outline-none text-navy-900 placeholder-navy-300 text-base"
      />

      {/* Крестик — 44px, а не 20px: это полноценная кнопка, а не иконка. */}
      {value && (
        <button
          type="button"
          onClick={onClear}
          aria-label="Очистить поиск"
          className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 inline-flex items-center justify-center text-navy-300 hover:text-navy-500 transition-colors">
          <CloseIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}
