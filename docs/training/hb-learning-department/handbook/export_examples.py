"""Export the exact self-contained book examples; no repository or credential copy."""
from pathlib import Path
import json
import re
import zipfile

BASE = Path(__file__).resolve().parent
REV = BASE / 'revision-v2'


def first_code(text, language):
    match = re.search(r'^```'+language+r'\n(.*?)\n```', text, re.M | re.S)
    if not match:
        raise ValueError('Missing '+language)
    return match[1]+'\n'


def main():
    files = {}
    for slug, source in [('hero','chapter-22.md'),('ceramics','answers-parent.md')]:
        text = (REV/source).read_text()
        for language, ext in [('html','html'),('css','css')]:
            files['examples/'+slug+'.'+ext] = first_code(text,language)
    files['composition/restoration.html'] = first_code((REV/'design/chapter-15.md').read_text(),'html')
    files['motion/static-storyboard.html'] = first_code((REV/'design/chapter-21.md').read_text(),'html')
    for number, text in enumerate(re.findall(r'^```json\n(.*?)\n```',(REV/'technical/chapter-02.md').read_text(),re.M|re.S),1):
        json.loads(text)
        files['reading-only/manifest-%02d.json' % number] = text+'\n'
    files['README.txt'] = '''H&B — примеры редакции 2

Это точные авторские исходники примеров учебника, не готовый магазин.
Для hero: создайте в своём проекте examples/hero.html и examples/hero.css.
В preview выберите оба пути отдельно. Для ceramics аналогично.
Приложение пока не импортирует ZIP: откройте нужный текстовый файл
локально и скопируйте содержимое в редактор своего учебного проекта.
Папки composition/ и motion/ содержат полные HTML/CSS-макеты.
Якорные переходы в ограниченном preview отключены; разделы читаются прокруткой.
Внешних картинок, скриптов, форм, API-ключей и клиентских данных нет.
reading-only/ — JSON для упражнения на чтение манифеста.
Это не рекомендация устанавливать напечатанные учебные версии пакетов.
Не запускайте npm install и команды из этих файлов в текущей оболочке.
Самостоятельные задания, условия и ответы находятся в PDF-учебнике.
'''
    output = BASE/'HB-Examples-v2.zip'
    with zipfile.ZipFile(output,'w',zipfile.ZIP_DEFLATED) as archive:
        for name,text in files.items():
            assert not name.startswith('/') and '..' not in Path(name).parts
            assert not any(part.startswith('.') for part in Path(name).parts)
            archive.writestr(name,text)
    with zipfile.ZipFile(output) as archive:
        assert archive.testzip() is None
        assert sorted(archive.namelist()) == sorted(files)
    print(json.dumps({'file':str(output),'entries':len(files),'paths':sorted(files)},ensure_ascii=False,indent=2))

if __name__=='__main__':main()
