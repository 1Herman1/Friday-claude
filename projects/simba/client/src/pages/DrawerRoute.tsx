import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDrawer } from '../context/DrawerContext'

type Props = {
  which: 'cart' | 'favorites'
}

// Открывает нужную шторку и уводит на /catalog — старые ссылки/закладки на
// /cart и /favorites не дают 404. Переход помечен состоянием skipDrawerClose:
// Layout.tsx закрывает шторку на любую смену пути (страховка от "шторка висит
// над новой страницей"), а этот редирект сам меняет путь сразу после открытия
// шторки — без метки та же страховка тут же закрыла бы её самой.
export default function DrawerRoute({ which }: Props) {
  const { openCart, openFavorites } = useDrawer()
  const navigate = useNavigate()

  useEffect(() => {
    if (which === 'cart') {
      openCart()
    } else {
      openFavorites()
    }
    navigate('/catalog', { replace: true, state: { skipDrawerClose: true } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [which])

  return null
}
