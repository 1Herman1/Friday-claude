/** Демо видеоотзывов главной: `?demo=sections`. В проде включает только видеоотзывы, статьи и новости — только dev */
export function isDemoSections(): boolean {
  return new URLSearchParams(window.location.search).get('demo') === 'sections'
}

export function hasDemoParam(): boolean {
  return new URLSearchParams(window.location.search).has('demo')
}
