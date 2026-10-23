/** Демо секций главной: `?demo=sections`. Вызывать только вместе с `import.meta.env.DEV` */
export function isDemoSections(): boolean {
  return new URLSearchParams(window.location.search).get('demo') === 'sections'
}
