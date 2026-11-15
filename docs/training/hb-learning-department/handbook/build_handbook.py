"""Reproducible H&B student PDF; original Cyrillic text and local diagrams."""
from pathlib import Path
import argparse
import json
import re
import subprocess
import sys
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak, Preformatted, KeepTogether, Image
from reportlab.platypus.tableofcontents import TableOfContents

BASE = Path(__file__).resolve().parent
FONT_DIR = Path('/System/Library/Fonts/Supplemental')


def fonts():
    for directory in [FONT_DIR, Path('/usr/share/fonts/truetype/dejavu')]:
        for regular, bold, mono in [('Arial.ttf', 'Arial Bold.ttf', 'Courier New.ttf'),
                                     ('DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSansMono.ttf')]:
            if all((directory / name).exists() for name in (regular, bold, mono)):
                for label, name in [('HB', regular), ('HB-Bold', bold), ('HB-Mono', mono)]:
                    pdfmetrics.registerFont(TTFont(label, str(directory / name)))
                pdfmetrics.registerFontFamily('HB', normal='HB', bold='HB-Bold', italic='HB', boldItalic='HB-Bold')
                return
    raise RuntimeError('Cyrillic fonts not found')


def inline(text):
    text = escape(text)
    text = re.sub(r'`([^`]+)`', r'<font name="HB-Mono">\1</font>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<i>\1</i>', text)
    text = re.sub(r'\[([^\]]+)\]\((https?://[^\s)\"<>]+)\)', r'<link href="\2" color="#366b64">\1</link>', text)
    return re.sub(r'\[(\d+)\](?!\()', r'<super><link href="#source-\1" color="#366b64">[\1]</link></super>', text)


class Book(BaseDocTemplate):
    def __init__(self, filename, footer_text='Учебные примеры FORMA. Не руководство к работе с реальными платежами.'):
        self.footer_text = footer_text
        super().__init__(str(filename), pagesize=A4, leftMargin=48, rightMargin=48,
                         topMargin=54, bottomMargin=48, title='H&B — основы AI-веб-разработки',
                         author='H&B Learning Department', pageCompression=1)
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id='normal', leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)
        self.addPageTemplates(PageTemplate(id='body', frames=[frame], onPage=self.decorate))
        self.heading_number = 0

    def beforeDocument(self):
        self.heading_number = 0

    def decorate(self, canvas, doc):
        if doc.page == 1:
            return
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor('#d8e2de'))
        canvas.line(48, A4[1]-34, A4[0]-48, A4[1]-34)
        canvas.setFont('HB', 8)
        canvas.setFillColor(colors.HexColor('#5a6963'))
        canvas.drawString(48, A4[1]-26, 'H&B  /  LEARNING DEPARTMENT')
        canvas.drawString(48, 28, self.footer_text)
        canvas.drawRightString(A4[0]-48, 28, str(doc.page))
        canvas.restoreState()

    def afterFlowable(self, flowable):
        if isinstance(flowable, Paragraph) and flowable.style.name in ('Chapter', 'Section'):
            name = 'heading-%d' % self.heading_number
            self.heading_number += 1
            text = flowable.getPlainText()
            if text in ('Содержание', 'От устройства проекта до проверенного интернет-магазина'):
                return
            self.canv.bookmarkPage(name)
            level = 0 if flowable.style.name == 'Chapter' else 1
            self.notify('TOCEntry', (level, escape(text), self.page, name))
            self.canv.addOutlineEntry(text, name, level=level, closed=True)


def local_image(relative, base_dir=BASE):
    path = Path(relative)
    root = Path(base_dir).resolve()
    if path.is_absolute() or not path.parts or path.parts[0] != 'diagrams' or '..' in path.parts:
        raise ValueError('Diagram must be inside the local diagrams directory')
    full = (root / path).resolve()
    if not full.is_relative_to(root / 'diagrams') or full.suffix.lower() not in ('.png', '.jpg'):
        raise ValueError('Unsupported or unsafe diagram')
    image = Image(str(full))
    factor = min(1, 490 / image.imageWidth, 535 / image.imageHeight)
    image.drawWidth = image.imageWidth * factor
    image.drawHeight = image.imageHeight * factor
    return image


def markdown_flowables(text, styles, base_dir=BASE):
    story, paragraph, code = [], [], []
    in_code = False

    def flush():
        if paragraph:
            story.append(Paragraph(inline(' '.join(paragraph)), styles['body']))
            paragraph.clear()

    for line in text.splitlines():
        if line.startswith('```'):
            flush()
            if in_code:
                longest = max((pdfmetrics.stringWidth(row.expandtabs(2), 'HB-Mono', 8) for row in code), default=0)
                size = min(8, 8 * 480 / longest) if longest else 8
                if size < 7:
                    raise ValueError('Code line too long for readable print: ' + max(code, key=len)[:140])
                style = ParagraphStyle('Code', fontName='HB-Mono', fontSize=size, leading=size * 1.45,
                                       backColor=colors.HexColor('#f0f4f2'), borderPadding=8, spaceBefore=6, spaceAfter=13)
                block = Preformatted('\n'.join(row.expandtabs(2) for row in code), style)
                story.append(KeepTogether([block]) if len(code) <= 12 else block)
                code.clear()
            in_code = not in_code
            continue
        if in_code:
            code.append(line)
            continue
        image = re.fullmatch(r'!\[([^\]]*)\]\(([^)]+)\)', line.strip())
        if image:
            flush()
            story.append(KeepTogether([local_image(image.group(2), base_dir), Spacer(1, 6), Paragraph(inline(image.group(1)), styles['small']), Spacer(1, 10)]))
        elif line.startswith('<!--') or line.startswith('# '):
            continue
        elif line.startswith('## '):
            flush()
            title = line[3:]
            if story and title.startswith(('Глава ', 'Словарь', 'Ответы и разборы')):
                story.append(PageBreak())
            story.append(Paragraph(inline(title), styles['chapter']))
        elif line.startswith('#### '):
            flush()
            story.append(Paragraph(inline(line[5:]), styles.get('subsection', styles['section'])))
        elif line.startswith('### '):
            flush()
            story.append(Paragraph(inline(line[4:]), styles['section']))
        elif not line.strip():
            flush()
        elif re.match(r'^\d+\. ', line) or line.startswith('- '):
            flush()
            story.append(Paragraph(inline(line), styles['body']))
        else:
            paragraph.append(line.strip())
    flush()
    if in_code:
        raise ValueError('Unclosed code block')
    return story


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default=str(BASE / 'HB-Web-Development-Handbook.pdf'))
    args = parser.parse_args()
    fonts()
    v2 = BASE / 'manuscript-v2.md'
    if v2.exists():
        body = v2.read_text()
        answers = (BASE / 'answers-v2.md').read_text()
    else:
        body = (BASE / 'handbook.md').read_text() + '\n\n' + (BASE / 'continuation.md').read_text()
        answers = ''
    ledger = json.loads((BASE / 'citations-ledger.json').read_text())
    source_script = Path.home() / '.hermes/skills/research/grounded-citations/scripts/sources.py'
    rendered = subprocess.check_output([sys.executable, str(source_script), '--ledger', str(BASE / 'citations-ledger.json'), 'render', '--style', 'markdown'], text=True)
    complete = body.rstrip() + '\n\n' + rendered + '\n\n' + answers
    (BASE / 'complete-handbook.md').write_text(complete)
    chapter_count = len(re.findall(r'^## Глава ', body, re.M))
    styles = {
        'body': ParagraphStyle('Body', fontName='HB', fontSize=10, leading=15, spaceAfter=8, textColor=colors.HexColor('#202b29'), allowWidows=0, allowOrphans=0, splitLongWords=True),
        'chapter': ParagraphStyle('Chapter', fontName='HB-Bold', fontSize=18, leading=24, spaceAfter=14, keepWithNext=True, textColor=colors.HexColor('#163a34')),
        'section': ParagraphStyle('Section', fontName='HB-Bold', fontSize=12, leading=17, spaceBefore=9, spaceAfter=7, keepWithNext=True),
        'subsection': ParagraphStyle('Subsection', fontName='HB-Bold', fontSize=10.5, leading=15, spaceBefore=7, spaceAfter=5, keepWithNext=True),
        'small': ParagraphStyle('Small', fontName='HB', fontSize=8.5, leading=13, spaceAfter=8),
        'cover': ParagraphStyle('Cover', fontName='HB-Bold', fontSize=30, leading=40, textColor=colors.HexColor('#163a34'), spaceAfter=20),
    }
    story = [Spacer(1, 45), Paragraph('H&amp;B', styles['cover']),
             Paragraph('ДИЗАЙН И ОСНОВЫ<br/>AI-ВЕБ-РАЗРАБОТКИ', styles['cover']),
             Paragraph('От понятной структуры к собственной концепции и проверенному прототипу', styles['body']),
             Spacer(1, 16), Paragraph('Учебник для начинающего сотрудника без практического опыта', styles['body']),
             Paragraph('%s главы · 100 терминов · наглядные схемы · решённые примеры · самостоятельные упражнения' % chapter_count, styles['body']),
             Spacer(1, 24), Paragraph('Редакция 2 / 15 ноября 2026<br/>H&amp;B Learning Department', styles['small']),
             Paragraph('Сначала понять и повторить похожий пример, затем выполнить свою задачу. Полные ответы — в последнем разделе книги.', styles['body']), PageBreak()]
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle('TOC0', fontName='HB', fontSize=9.5, leading=14, spaceBefore=5), ParagraphStyle('TOC1', fontName='HB', fontSize=8, leading=11, leftIndent=14, firstLineIndent=0, spaceBefore=1)]
    story += [Paragraph('Содержание', styles['chapter']), toc, PageBreak()]
    story += markdown_flowables(body, styles)
    story += [PageBreak(), Paragraph('Источники и дальнейшее чтение', styles['chapter']), Paragraph('Первичные документы и проверенные источники референсов. Ссылки подтверждают соответствующие сведения, но не заменяют самостоятельную практику. Даты и границы проверки материалов указаны в подборке.', styles['body'])]
    entries = ledger['sources']
    for entry in sorted(entries, key=lambda e: int(e['id'])):
        n, url = entry['id'], entry['url']
        story.append(Paragraph('<a name="source-%s"/>[%s] <link href="%s" color="#366b64">%s</link>' % (n, n, escape(url, {'"': '&quot;'}), escape(entry.get('title') or url)), styles['small']))
    if answers:
        story += [PageBreak()] + markdown_flowables(answers, styles)
    book = Book(args.output, footer_text='Основы AI-веб-разработки')
    book.multiBuild(story)
    print(json.dumps({'pdf': args.output, 'chapters': chapter_count,
                     'russian_words': len(re.findall(r'[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*', body + answers)),
                     'exercises': len(re.findall(r'^### Упражнение [0-9.]+', body, re.M)),
                     'answers': len(re.findall(r'^### Ответ [0-9.]+', answers, re.M))}, ensure_ascii=False))

if __name__ == '__main__':
    main()
