"""Validate both deliverables; render review pages into the ignored previews folder."""
from pathlib import Path
import json
import re
from pypdf import PdfReader
import pypdfium2 as pdfium

BASE = Path(__file__).resolve().parent

def main():
    results = []
    for name in ('HB-Web-Development-Handbook.pdf', 'HB-Student-Workbook-24-Days.pdf'):
        path = BASE / name
        reader = PdfReader(path)
        texts = [page.extract_text() or '' for page in reader.pages]
        assert all(t.strip() for t in texts), 'Empty PDF page'
        assert 'H&B;' not in texts[0], 'Brand markup corruption on cover'
        text = '\n'.join(texts)
        item = {'file': name, 'pages': len(reader.pages), 'bytes': path.stat().st_size, 'all_pages_have_text': True}
        if 'Workbook' in name:
            days = sorted(set(int(n) for n in re.findall(r'День\s+(\d{2})', text)))
            assert days == list(range(1,25))
            item['days'] = len(days)
            render = [0,2]
            prefix = 'workbook'
        else:
            assert all('Глава '+str(n)+'.' in text for n in range(1,19))
            assert '100.' in text and 'Словарь' in text
            urls = {str(a.get_object()['/A']['/URI']) for page in reader.pages for a in page.get('/Annots', []) if a.get_object().get('/A', {}).get('/URI')}
            assert len(urls) == 26
            item.update(chapters=18, terms=100, clickable_external_sources=len(urls))
            render = [0,1,next(i for i,t in enumerate(texts) if i>5 and 'Глава 11.' in t),len(texts)-1]
            prefix = 'handbook'
        doc = pdfium.PdfDocument(str(path))
        out = BASE / 'previews'; out.mkdir(exist_ok=True)
        for index in render:
            doc[index].render(scale=1.3).to_pil().save(out / ('%s-%02d.png' % (prefix,index+1)))
        item['rendered_review_pages'] = [i+1 for i in render]
        results.append(item)
    (BASE / 'verification.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
    print(json.dumps(results,ensure_ascii=False,indent=2))

if __name__ == '__main__':
    main()
