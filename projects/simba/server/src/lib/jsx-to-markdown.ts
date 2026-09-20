/**
 * Перевод JSX-тела статьи (файлы client/src/content/blog/posts) в markdown
 * для переноса в базу. Покрывает то, что реально встречается в статьях:
 * p, h2, h3, ul/ol/li, strong, em, a/Link. Остальные теги дают чистый текст.
 */
function decode(s: string): string {
  return s
    .replace(/\{'\s*'\}/g, ' ')
    .replace(/\{"\s*"\}/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}

function inline(html: string): string {
  let s = html
  s = s.replace(/<Link\s+to=["']([^"']+)["'][^>]*>([\s\S]*?)<\/Link>/g, (_m, href, text) => `[${decode(text)}](${href})`)
  s = s.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/g, (_m, href, text) => `[${decode(text)}](${href})`)
  s = s.replace(/<strong>([\s\S]*?)<\/strong>/g, (_m, t) => `**${decode(t)}**`)
  s = s.replace(/<b>([\s\S]*?)<\/b>/g, (_m, t) => `**${decode(t)}**`)
  s = s.replace(/<em>([\s\S]*?)<\/em>/g, (_m, t) => `*${decode(t)}*`)
  s = s.replace(/<br\s*\/?>/g, '\n')
  s = s.replace(/<[^>]+>/g, '')
  return decode(s)
}

export function jsxToMarkdown(jsx: string): string {
  const out: string[] = []
  const re = /<(h1|h2|h3|p|ul|ol|blockquote)(?:\s[^>]*)?>([\s\S]*?)<\/\1>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(jsx))) {
    const tag = m[1]
    const body = m[2]
    if (tag === 'ul' || tag === 'ol') {
      const items = [...body.matchAll(/<li(?:\s[^>]*)?>([\s\S]*?)<\/li>/g)].map((x) => inline(x[1]))
      out.push(items.map((t, i) => (tag === 'ol' ? `${i + 1}. ${t}` : `- ${t}`)).join('\n'))
    } else if (tag === 'h1') out.push(`# ${inline(body)}`)
    else if (tag === 'h2') out.push(`## ${inline(body)}`)
    else if (tag === 'h3') out.push(`### ${inline(body)}`)
    else if (tag === 'blockquote') out.push(`> ${inline(body)}`)
    else out.push(inline(body))
  }
  return out.filter(Boolean).join('\n\n')
}
