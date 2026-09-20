import { SearchIcon } from '../icons'

type Props = {
  open: boolean
  onOpen: () => void
}

export default function HeaderSearch({ open, onOpen }: Props) {
  return (
    <div className="flex-1 max-w-xl mx-4">
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Открыть поиск по каталогу"
        className="btn-press press-wide w-full h-11 pl-4 pr-3 rounded-full border border-line bg-white
                   flex items-center gap-2 text-left
                   hover:border-ink"
      >
        <SearchIcon className="w-5 h-5 text-navy-400 flex-shrink-0" />
        <span className="text-sm text-navy-500 truncate">Найти корм, лакомства, игрушки…</span>
      </button>
    </div>
  )
}
