// Сборка минимального docx в памяти для тестов парсера: zip без сжатия + word/document.xml.

const escapeXml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Строка с префиксом «* » — пункт списка (numPr); «\n» внутри строки — перенос <w:br/>.
function paragraphXml(line: string): string {
  const bullet = line.startsWith('* ')
  const text = bullet ? line.slice(2) : line
  const pPr = bullet ? '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr></w:pPr>' : ''
  const runs = text
    .split('\n')
    .map((part) => `<w:r><w:t xml:space="preserve">${escapeXml(part)}</w:t></w:r>`)
    .join('<w:r><w:br/></w:r>')
  return `<w:p>${pPr}${runs}</w:p>`
}

function zipStored(name: string, data: Buffer): Buffer {
  const nameBuf = Buffer.from(name, 'utf8')
  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt32LE(data.length, 18)
  local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(nameBuf.length, 26)
  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt32LE(data.length, 20)
  central.writeUInt32LE(data.length, 24)
  central.writeUInt16LE(nameBuf.length, 28)
  central.writeUInt32LE(0, 42)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(central.length + nameBuf.length, 12)
  end.writeUInt32LE(local.length + nameBuf.length + data.length, 16)
  return Buffer.concat([local, nameBuf, data, central, nameBuf, end])
}

export function makeDocx(lines: string[]): Buffer {
  const body = lines.map(paragraphXml).join('')
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`
  return zipStored('word/document.xml', Buffer.from(xml, 'utf8'))
}
