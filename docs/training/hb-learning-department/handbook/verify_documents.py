"""Validate v2 student PDFs and rasterize actual content pages for review."""
from pathlib import Path
import json
import re
from pypdf import PdfReader
import pypdfium2 as pdfium

BASE = Path(__file__).resolve().parent


def main():
    results = []
    content = json.loads((BASE / 'revision-v2/content-verification.json').read_text())
    ledger = json.loads((BASE / 'citations-ledger.json').read_text())['sources']
    expected_urls = {item['url'].rstrip('/') for item in ledger}
    for name in ('HB-Web-Development-Handbook.pdf', 'HB-Student-Workbook-24-Days.pdf'):
        path = BASE / name
        reader = PdfReader(path)
        texts = [page.extract_text() or '' for page in reader.pages]
        assert all(text.strip() for text in texts), 'Empty PDF page'
        assert 'H&B;' not in texts[0], 'Corrupted brand markup'
        text = '\n'.join(texts)
        assert not re.search(r'\bГерман(?:а|у|ом|е)?\b', text)
        assert 'Учебные примеры FORMA. Не руководство к работе с реальными платежами.' not in text
        item = {'file': name, 'pages': len(reader.pages), 'bytes': path.stat().st_size, 'all_pages_have_text': True}
        if 'Workbook' in name:
            days = sorted(set(int(n) for n in re.findall(r'День\s+(\d{2})', text)))
            assert days == list(range(1,25))
            assert text.count('Дизайн-спринт и опора.') == 24
            item.update(days=len(days), daily_design_sprints=24)
            render = [0, 2, len(texts)-1]
            prefix = 'workbook'
        else:
            assert all('Глава '+str(n)+'.' in text for n in range(1, content['chapters']+1))
            assert '100.' in text and 'Словарь' in text
            urls = {str(a.get_object()['/A']['/URI']).rstrip('/') for page in reader.pages for a in page.get('/Annots', []) if a.get_object().get('/A', {}).get('/URI')}
            assert expected_urls <= urls, 'Missing source annotations: '+str(expected_urls-urls)
            answer_at = text.rfind('Ответы и разборы упражнений')
            assert answer_at > text.rfind('Источники и дальнейшее чтение')
            for exercise in content['exercise_ids']:
                assert 'Упражнение '+exercise in text[:answer_at], exercise
                assert re.search(r'Ответ\s+'+re.escape(exercise)+r'\b', text[answer_at:]), exercise
            images = set()
            for page in reader.pages:
                resources = page['/Resources']
                if '/XObject' in resources:
                    for ref in resources['/XObject'].values():
                        if ref.get_object().get('/Subtype') == '/Image':
                            images.add(ref.idnum)
            assert len(images) >= 10, 'Missing diagrams or worked-example screenshots'
            item.update(chapters=content['chapters'], terms=100, exercises=len(content['exercise_ids']), answers=content['answers'], embedded_images=len(images), registered_sources=len(expected_urls), clickable_external_urls=len(urls), answers_are_last=True)
            render = [0, 1]
            for label in ['Глава 1.', 'Глава 2.', 'Глава 4.', 'Глава 15.', 'Глава 19.', 'Глава 20.', 'Глава 21.', 'Глава 22.', 'Ответ 1.1']:
                candidates = [i for i,t in enumerate(texts) if label in t]
                assert candidates, label
                render.append(candidates[-1])
            render.append(next(i for i,page in enumerate(reader.pages) if page.images))
            render.append(len(texts)-1)
            render = sorted(set(render))
            prefix = 'handbook'
        doc = pdfium.PdfDocument(str(path))
        out = BASE / 'previews'; out.mkdir(exist_ok=True)
        for index in render:
            doc[index].render(scale=1.3).to_pil().save(out / ('%s-%03d.png' % (prefix,index+1)))
        item['rendered_review_pages'] = [i+1 for i in render]
        results.append(item)
    (BASE / 'verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(results,ensure_ascii=False,indent=2))

if __name__ == '__main__': main()
