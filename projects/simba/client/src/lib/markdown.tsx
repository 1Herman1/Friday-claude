import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * Маленький рендер markdown для статей блога. Без внешних библиотек и без
 * HTML-вставок: текст экранируется самим React, поддерживаются заголовки,
 * абзацы, списки, цитаты, **жирный**, *курсив* и [ссылки](url).
 * Внутренние ссылки (начинаются с «/») идут через react-router.
 */
function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+)\*\*|\*([^*]+)\*/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const k = `${keyBase}-${i++}`
    if (m[1] !== undefined) {
      const href = m[2]
      out.push(
        href.startsWith('/') ? (
          <Link key={k} to={href} className="text-navy-900 underline underline-offset-2">{m[1]}</Link>
        ) : (
          <a key={k} href={href} target="_blank" rel="noopener noreferrer" className="text-navy-900 underline underline-offset-2">{m[1]}</a>
        )
      )
    } else if (m[3] !== undefined) {
      out.push(<strong key={k}>{m[3]}</strong>)
    } else if (m[4] !== undefined) {
      out.push(<em key={k}>{m[4]}</em>)
    }
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function renderMarkdown(src: string): ReactNode {
  const lines = src.replace(/\r\n?/g, '\n').split('\n')
  const blocks: ReactNode[] = []
  let para: string[] = []
  let list: { ordered: boolean; items: string[] } | null = null
  let quote: string[] = []
  let key = 0

  const flushPara = () => {
    if (para.length) {
      blocks.push(<p key={key++}>{inline(para.join(' '), `p${key}`)}</p>)
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      const items = list.items.map((t, i) => <li key={i}>{inline(t, `li${key}-${i}`)}</li>)
      blocks.push(list.ordered ? <ol key={key++}>{items}</ol> : <ul key={key++}>{items}</ul>)
      list = null
    }
  }
  const flushQuote = () => {
    if (quote.length) {
      blocks.push(<blockquote key={key++}>{inline(quote.join(' '), `q${key}`)}</blockquote>)
      quote = []
    }
  }
  const flushAll = () => { flushPara(); flushList(); flushQuote() }

  for (const raw of lines) {
    const line = raw.trimEnd()
    const h = /^(#{1,3})\s+(.*)$/.exec(line)
    if (h) {
      flushAll()
      const text = inline(h[2], `h${key}`)
      blocks.push(h[1].length === 1 ? <h1 key={key++}>{text}</h1> : h[1].length === 2 ? <h2 key={key++}>{text}</h2> : <h3 key={key++}>{text}</h3>)
      continue
    }
    const li = /^(?:[-*]|\d+\.)\s+(.*)$/.exec(line)
    if (li) {
      flushPara(); flushQuote()
      const ordered = /^\d+\./.test(line)
      if (!list || list.ordered !== ordered) { flushList(); list = { ordered, items: [] } }
      list.items.push(li[1])
      continue
    }
    if (line.startsWith('>')) {
      flushPara(); flushList()
      quote.push(line.replace(/^>\s?/, ''))
      continue
    }
    if (line.trim() === '') { flushAll(); continue }
    flushList(); flushQuote()
    para.push(line.trim())
  }
  flushAll()
  return <Fragment>{blocks}</Fragment>
}
