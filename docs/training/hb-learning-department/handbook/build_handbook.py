"""Build the original H&B handbook with embedded Cyrillic fonts.
Run with the managed documents Python; no network or credentials required.
"""
from pathlib import Path
import argparse
import html
import json
import re
import subprocess
import sys
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak, Preformatted, KeepTogether
from reportlab.platypus.tableofcontents import TableOfContents

BASE = Path(__file__).resolve().parent
FONT_DIR = Path('/System/Library/Fonts/Supplemental')


def fonts():
    candidates = [FONT_DIR, Path('/usr/share/fonts/truetype/dejavu')]
    for directory in candidates:
        families = [('Arial.ttf', 'Arial Bold.ttf', 'Courier New.ttf'),
                    ('DejaVuSans.ttf', 'DejaVuSans-Bold.ttf', 'DejaVuSansMono.ttf')]
        for regular, bold, mono in families:
            if all((directory / name).exists() for name in (regular, bold, mono)):
                for label, name in [('HB', regular), ('HB-Bold', bold), ('HB-Mono', mono)]:
                    pdfmetrics.registerFont(TTFont(label, str(directory / name)))
                pdfmetrics.registerFontFamily('HB', normal='HB', bold='HB-Bold', italic='HB', boldItalic='HB-Bold')
                return
    raise RuntimeError('Cyrillic fonts not found: install DejaVu fonts or adjust FONT_DIR')


def inline(text):
    text = escape(text)
    text = re.sub(r'`([^`]+)`', r'<font name="HB-Mono">\1</font>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<i>\1</i>', text)
    text = re.sub(r'\[(\d+)\](?!\()', r'<super><link href="#source-\1" color="#366b64">[\1]</link></super>', text)
    return text


class Book(BaseDocTemplate):
    def __init__(self, filename):
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
        canvas.drawString(48, 28, 'Учебные примеры FORMA. Не руководство к работе с реальными платежами.')
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


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--output', default=str(BASE / 'HB-Web-Development-Handbook.pdf'))
    args = ap.parse_args()
    fonts()
    body = (BASE / 'handbook.md').read_text() + '\n\n' + (BASE / 'continuation.md').read_text()
    ledger = json.loads((BASE / 'citations-ledger.json').read_text())
    # The citation script owns source numbering and renders the source list.
    source_script = Path.home() / '.hermes/skills/research/grounded-citations/scripts/sources.py'
    rendered = subprocess.check_output([sys.executable, str(source_script), '--ledger', str(BASE / 'citations-ledger.json'), 'render', '--style', 'markdown'], text=True)
    complete = body.rstrip() + '\n\n' + rendered
    (BASE / 'complete-handbook.md').write_text(complete)
    styles = {
        'body': ParagraphStyle('Body', fontName='HB', fontSize=10, leading=15, spaceAfter=8, textColor=colors.HexColor('#202b29'), allowWidows=0, allowOrphans=0, splitLongWords=True),
        'chapter': ParagraphStyle('Chapter', fontName='HB-Bold', fontSize=18, leading=24, spaceAfter=14, keepWithNext=True, textColor=colors.HexColor('#163a34')),
        'section': ParagraphStyle('Section', fontName='HB-Bold', fontSize=12, leading=17, spaceBefore=9, spaceAfter=7, keepWithNext=True),
        'small': ParagraphStyle('Small', fontName='HB', fontSize=8.5, leading=13, spaceAfter=8),
        'cover': ParagraphStyle('Cover', fontName='HB-Bold', fontSize=33, leading=43, textColor=colors.HexColor('#163a34'), spaceAfter=22),
    }
    story = [Spacer(1, 55), Paragraph('H&amp;B', styles['cover']),
             Paragraph('ОСНОВЫ<br/>AI-ВЕБ-РАЗРАБОТКИ', styles['cover']),
             Paragraph('От устройства проекта до проверенного интернет-магазина', styles['chapter']),
             Spacer(1, 16), Paragraph('Учебник для студента и начинающего сотрудника', styles['body']),
             Paragraph('18 глав · 100 терминов · оригинальные примеры · упражнения и разборы', styles['body']),
             Spacer(1, 26), Paragraph('Редакция 14 ноября 2026<br/>H&amp;B Learning Department', styles['small']),
             Paragraph('Изучать последовательно, применять небольшими шагами. ИИ помогает реализовывать; ответственность за проверку и границы доступа остаётся у человека.', styles['body']), PageBreak()]
    toc = TableOfContents()
    toc.levelStyles = [ParagraphStyle('TOC0', fontName='HB', fontSize=9.5, leading=14, spaceBefore=5, leftIndent=0, firstLineIndent=0), ParagraphStyle('TOC1', fontName='HB', fontSize=8, leading=11, leftIndent=14, firstLineIndent=0, spaceBefore=1)]
    story += [Paragraph('Содержание', styles['chapter']), toc, PageBreak()]
    paragraph = []
    code = []
    in_code = False
    first_chapter = True

    def flush():
        if paragraph:
            story.append(Paragraph(inline(' '.join(paragraph)), styles['body']))
            paragraph.clear()

    for line in body.splitlines():
        if line.startswith('```'):
            flush()
            if in_code:
                longest = max((pdfmetrics.stringWidth(row, 'HB-Mono', 8) for row in code), default=0)
                size = min(8, 8 * 490 / longest) if longest else 8
                code_style = ParagraphStyle('Code', fontName='HB-Mono', fontSize=max(size, 6.5), leading=max(size, 6.5)*1.45, backColor=colors.HexColor('#f0f4f2'), borderPadding=9, spaceBefore=5, spaceAfter=12)
                story.append(Preformatted('\n'.join(code), code_style))
                code.clear()
            in_code = not in_code
            continue
        if in_code:
            code.append(line)
            continue
        if line.startswith('# '):
            continue
        if line.startswith('## '):
            flush()
            title = line[3:]
            if title.startswith('Глава ') or title.startswith('Словарь'):
                if not first_chapter:
                    story.append(PageBreak())
                first_chapter = False
            story.append(Paragraph(inline(title), styles['chapter']))
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
    story += [PageBreak(), Paragraph('Источники и дальнейшее чтение', styles['chapter']), Paragraph('Первичные публичные документы. Изложение, учебные сценарии и примеры подготовлены для H&amp;B. Ссылки кликабельны; источник подтверждает соответствующие сведения, но не означает выполнение практического задания.', styles['body'])]
    entries = ledger.get('sources', []) if isinstance(ledger, dict) else ledger
    if isinstance(entries, dict):
        entries = list(entries.values())
    for entry in sorted(entries, key=lambda e: int(e['id'])):
        n, url = entry['id'], entry['url']
        label = entry.get('title') or url
        story.append(Paragraph('<a name="source-%s"/>[%s] <link href="%s" color="#366b64">%s</link>' % (n, n, escape(url, {'"': '&quot;'}), escape(label)), styles['small']))
    book = Book(args.output)
    book.multiBuild(story)
    print(json.dumps({'pdf': args.output, 'words': len(complete.split()), 'russian_words': len(re.findall(r'[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*', body)), 'chapters': len(re.findall(r'^## Глава ', body, re.M)), 'terms': len(re.findall(r'^\d+\. \*\*', body, re.M))}, ensure_ascii=False))

if __name__ == '__main__':
    main()
