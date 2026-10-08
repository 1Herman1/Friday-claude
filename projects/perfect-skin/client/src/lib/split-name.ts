// «FLUVIX Сыворотка обновляющая» → латинское имя крупно, русское описание под ним.
export function splitName(name: string) {
  const m = name.match(/^([^А-Яа-яЁё]+?)\s+([А-Яа-яЁё].*)$/)
  return m ? { title: m[1], desc: m[2] } : { title: name, desc: '' }
}
