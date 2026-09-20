/** У подсборки lottie_light своих типов нет — берём их у основного пакета.
    Light-сборка нам нужна ради веса: 164 КБ против 299 КБ, а из возможностей
    полной версии (выражения, эффекты) в наших файлах не используется ничего. */
declare module 'lottie-web/build/player/lottie_light' {
  import type { AnimationConfigWithData, AnimationItem } from 'lottie-web'
  const lottie: {
    loadAnimation(params: AnimationConfigWithData): AnimationItem
  }
  export default lottie
}
