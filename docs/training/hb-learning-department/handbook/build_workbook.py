"""Create the student workbook from the agreed 24-day curriculum."""
from pathlib import Path
import re
import json
from reportlab.lib import colors
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import Paragraph, Spacer, PageBreak, HRFlowable
from reportlab.platypus.tableofcontents import TableOfContents
from build_handbook import Book, fonts, inline

BASE = Path(__file__).resolve().parent


def student_copy(text):
    """Use a generic curator role in student-facing prose, not internal owner records."""
    text = re.sub(r'\bГерман(ом|а|у|е)?\b', lambda m: 'куратор' + (m.group(1) or ''), text)
    return re.sub(r'(^|[.!?]\s+|\*\*\s+)куратор\b', lambda m: m.group(1) + 'Куратор', text, flags=re.M)


def main():
    fonts()
    source = student_copy((BASE.parent / 'course.md').read_text())
    matches = list(re.finditer(r'^#### День (\d{2}) — (.+)$', source, re.M))
    assert [int(m[1]) for m in matches] == list(range(1,25))
    styles = {
        'body':ParagraphStyle('Body',fontName='HB',fontSize=10,leading=15,spaceAfter=10),
        'chapter':ParagraphStyle('Chapter',fontName='HB-Bold',fontSize=18,leading=23,spaceAfter=14,keepWithNext=True,textColor=colors.HexColor('#163a34')),
        'cover':ParagraphStyle('Cover',fontName='HB-Bold',fontSize=30,leading=40,spaceAfter=22,textColor=colors.HexColor('#163a34')),
        'worksheet':ParagraphStyle('Worksheet',fontName='HB-Bold',fontSize=13,leading=18,spaceBefore=8,spaceAfter=12,keepWithNext=True),
        'small':ParagraphStyle('Small',fontName='HB',fontSize=9,leading=13,spaceAfter=9),
    }
    story=[Spacer(1,60),Paragraph('H&amp;B',styles['cover']),Paragraph('ПРАКТИКУМ<br/>24 УЧЕБНЫХ ДНЯ',styles['cover']),Paragraph('Дизайн и веб-прототипы',styles['body']),Paragraph('Задания, критерии приёмки и место для собственных наблюдений. Читать вместе с редакцией 2 учебника «Дизайн и основы AI-веб-разработки».',styles['body']),Paragraph('Редакция 2 / 15 ноября 2026. 8 недель, 3 дня в неделю. Все данные FORMA вымышленные.',styles['small']),Paragraph('В каждом дне есть дизайн-спринт со ссылкой на разобранный пример. Номера глав учебника не равны номерам дней; ответы к упражнениям книги находятся её последним разделом. Здесь сохраняются собственные наблюдения и артефакты дневной практики.',styles['body']),Paragraph('Сейчас доступны статические HTML/CSS-прототипы. Задания с JS/React, моделью, сетью или публикацией выполняются после подготовки соответствующей среды, а не имитируются ради зачёта. Принятие результата и выпуск — решение куратора.',styles['body']),PageBreak(),Paragraph('Содержание',styles['chapter'])]
    toc=TableOfContents();toc.levelStyles=[ParagraphStyle('TOC0',fontName='HB',fontSize=9,leading=12,spaceBefore=0)]
    story += [toc,PageBreak()]
    for i,m in enumerate(matches):
        end=matches[i+1].start() if i+1<len(matches) else source.index('\n## 6.')
        text=re.split(r'\n### Неделя ',source[m.end():end])[0].strip()
        story.append(Paragraph(inline('День '+m[1]+' — '+m[2]),styles['chapter']))
        for paragraph in text.split('\n\n'):
            story.append(Paragraph(inline(' '.join(paragraph.splitlines())),styles['body']))
        story.append(Paragraph('Мой результат и проверка',styles['worksheet']))
        for label in ['Что изменено и в каких файлах:', 'Проверка: ожидание → фактический результат:', 'Что пока не проверено / где нужна помощь:', 'Моё объяснение решения и следующий шаг:']:
            story.append(Paragraph(label,styles['small']))
            story.append(Spacer(1,14));story.append(HRFlowable(width='100%',thickness=.5,color=colors.HexColor('#b8c8bf')))
            story.append(Spacer(1,9))
        story.append(Paragraph('Дата / версия артефакта: ____________________    Решение куратора: ____________________',styles['small']))
        if i != len(matches)-1:story.append(PageBreak())
    out=BASE/'HB-Student-Workbook-24-Days.pdf'
    book=Book(out, footer_text='Практикум · 24 учебных дня');book.title='H&B — практикум на 24 учебных дня';book.multiBuild(story)
    print(json.dumps({'pdf':str(out),'days':len(matches)},ensure_ascii=False))

if __name__=='__main__':main()
