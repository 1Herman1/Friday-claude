"""Assemble a consistent v2 manuscript; keep solved examples before exercises."""
from pathlib import Path
import json
import re

BASE = Path(__file__).resolve().parent
REV = BASE / 'revision-v2'


def section_blocks(text):
    return [(m.group(1), m.group(2).strip()) for m in re.finditer(r'^## ([^\n]+)\n(.*?)(?=^## |\Z)', text, re.M | re.S)]


def normalize(text):
    child = bool(re.match(r'# Глава ', text))
    result = []
    for line in text.splitlines():
        if child and line.startswith('# '):
            line = '#' + line
        elif child and line.startswith('## '):
            line = '#' + line
        elif child and line.startswith('### '):
            line = '#' + line
        exercise = re.match(r'^#{2,4}\s+(?:Самостоятельное\s+)?[Уу]пражнение\s+(\d+\.\d+)(.*)$', line)
        bold = re.match(r'^\*\*Упражнение\s+(\d+\.\d+)([^*]*)\*\*\s*(.*)$', line)
        if exercise:
            line = '### Упражнение ' + exercise[1] + exercise[2]
        elif bold:
            line = '### Упражнение ' + bold[1] + bold[2].rstrip('.') + '\n\n' + bold[3]
        example = re.match(r'^#{2,4}\s+(?:Разобранный пример перед упражнением|Разобранный пример|Пример)\s+(\d+\.\d+)(.*)$', line)
        if example:
            line = '### Разобранный пример ' + example[1] + example[2].split('→')[0].rstrip()
        result.append(line)
    return '\n'.join(result).strip()


def clean(text):
    text = text.replace('`answers-design.md`', 'последнем разделе «Ответы и разборы упражнений»')
    text = text.replace('В учебной версии действие ведёт к разделу подготовки, а не к неработающей форме.', 'В плане страницы действие направляет к разделу подготовки, а не к форме; в нынешнем preview якорный переход отключён, раздел читают прокруткой.')
    text = text.replace('Для учебной страницы действие ведёт к разделу подготовки обращения.', 'Для учебного макета задан маршрут к разделу подготовки; в ограниченном preview его читают прокруткой, а не проверяют неработающий переход.')
    text = text.replace('в отдельном файле ответов', 'выше в разборе примера')
    for title, source_id in [('WebGL', 43), ('position', 44), ('Video', 45), ('CSS transitions', 48)]:
        text = text.replace('MDN «'+title+'»', 'MDN «'+title+'»['+str(source_id)+']')
    text = text.replace(' Новые числовые номера источникам не присваиваются.', '')
    text = text.replace('`source-notes.md`', 'разделе «Источники и дальнейшее чтение»')
    return re.sub(r'\bГерман(ом|а|у|е)?\b', lambda m: 'куратор' + (m[1] or ''), text)


def main():
    legacy = (BASE / 'handbook.md').read_text() + '\n\n' + (BASE / 'continuation.md').read_text()
    old = {int(m[1]): m[0] for m in re.finditer(r'^## Глава (\d+)\.[^\n]*\n.*?(?=^## |\Z)', legacy, re.M | re.S)}
    practice = {int(title.split()[-1]): body for title, body in section_blocks((REV / 'core-practice.md').read_text())}
    examples, answers = {}, {}
    for title, body in section_blocks((REV / 'design/answers-design.md').read_text()):
        match = re.match(r'(\d+\.\d+) — (.+)', title)
        if not match:
            continue
        if 'разбор примера' in title:
            examples[match[1]] = body
        else:
            answers[match[1]] = '### Ответ ' + match[1] + '\n\n' + body
    for title, body in section_blocks((REV / 'technical/answers-technical.md').read_text()):
        match = re.match(r'Ответ (\d+\.\d+)', title)
        if match:
            body = re.sub(r'^### ', '#### ', body, flags=re.M)
            answers[match[1]] = '### ' + title + '\n\n' + body
    for m in re.finditer(r'^### Ответ (\d+\.\d+)[^\n]*\n.*?(?=^### Ответ |\Z)', (REV / 'answers-parent.md').read_text(), re.M | re.S):
        answers[m[1]] = m[0].strip()
    chapters = []
    for number in range(1, 23):
        if number in (1, 2, 4):
            text = (REV / 'technical' / ('chapter-%02d.md' % number)).read_text()
        elif number in (15, 19, 21):
            text = (REV / 'design' / ('chapter-%02d.md' % number)).read_text()
            # A worked example must include reasoning HERE, not behind the answer key.
            text = re.sub(r'Полный разбор решений, альтернатив и связей с брифом находится в `answers-design.md`, раздел «[^»]+»\. Здесь изучите сам результат и подписи, затем переходите к другой задаче\.', 'Ниже разобраны структура и причины выбора; затем предлагается похожая задача.', text)
            text = re.sub(r'Их подробное обоснование и сравнение находятся только в `answers-design.md`, раздел «[^»]+»\.', 'Сравнение и обоснование приведены перед самостоятельным упражнением.', text)
            text = re.sub(r'Полный разбор выбора технологии, ракурсов и отвергнутого варианта находится в `answers-design.md`, раздел «[^»]+»\.', 'Выбор технологии и связь с задачей разобраны ниже, до самостоятельной практики.', text)
            text = text.replace('Полная аргументация и отвергнутый вариант — в ответах.', 'Аргументация приведена ниже перед самостоятельным заданием.')
            text = text.replace('Аргументация результата вынесена в ответы.', 'Аргументация результата дана ниже перед самостоятельным заданием.')
            text = text.replace('Полное объяснение выбора и условий будущего ролика — в ответах.', 'Объяснение выбора и условий будущего ролика дано ниже перед самостоятельной практикой.')
            for suffix in (1, 2):
                key = '%s.%s' % (number, suffix)
                marker = re.search(r'(?mi)^(?:#{2,4}\s+(?:Самостоятельное\s+)?Упражнение|\*\*Упражнение)\s+' + re.escape(key) + r'\b', text)
                assert marker, 'Missing design exercise '+key
                text = text[:marker.start()] + '## Почему решение подходит этому брифу\n\n' + examples[key] + '\n\n' + text[marker.start():]
            if number in (15, 19, 21):
                note = '\n\nВажное различие среды: якорные ссылки в HTML-примерах описывают обычную веб-страницу. В текущем ограниченном preview переходы отключены; нужный раздел можно прочитать прокруткой. Не записывайте переход по ссылке как выполненную функцию приложения.\n\n'
                first = text.find('\n\n')
                text = text[:first] + note + text[first+2:]
            # Render the storyboard as readable phases rather than an unsupported wide table.
            text = re.sub(r'^\|\s*Фаза\s*\|.*\n\|\s*---.*\n', '', text, flags=re.M)
            text = re.sub(r'^\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*$', lambda m: '- **'+m[1].strip()+'**. Положение: '+m[2].strip()+'. Предмет: '+m[3].strip()+'. Содержание: '+m[4].strip()+'.', text, flags=re.M)
        elif number in (20, 22):
            text = (REV / ('chapter-%02d.md' % number)).read_text()
        else:
            text = re.split(r'\n\*\*(?:Упражнение|Практика)\s+\d+', old[number])[0].rstrip()
            extra = practice[number]
            answer = re.search(r'^### Ответ (\d+\.\d+)[^\n]*\n.*', extra, re.M | re.S)
            assert answer
            answers[answer[1]] = answer[0].strip()
            text += '\n\n' + extra[:answer.start()].strip()
        chapters.append(clean(normalize(text)))
    ledger = json.loads((BASE / 'citations-ledger.json').read_text())['sources']
    def source_id(url):
        return next(x['id'] for x in ledger if x['url'].rstrip('/') == url.rstrip('/'))
    refs = json.loads((REV / 'research/sources.json').read_text())
    videos = json.loads((REV / 'research/videos.json').read_text())
    assert len(refs) == len({x['url'] for x in refs}) == 10
    assert len(videos) == len({x['youtube_id'] for x in videos}) == 6
    resource_cards = []
    for index, item in enumerate(refs, 1):
        name = item['name'].replace('Recent / бывший Godly', 'Recent — переход с Godly')
        resource_cards.append('#### %s. %s\n\n[Открыть источник](%s).[%s]\n\nЧто изучать: %s\n\nПрактика: %s\n\nДоступ при проверке: %s\n\nОграничение: %s' % (index,name,item['url'],source_id(item['url']),item['skill'],item['use'],item['access'],item['limitation']))
    video_cards=[]
    for index,item in enumerate(videos,1):
        minutes,seconds=divmod(item['duration_seconds'],60)
        practice=item['mini_practice'].replace('Сверстайте в Figma статью', 'Сделайте HTML/CSS-макет статьи или бумажный эскиз')
        if item['topic']=='scroll_motion_gsap':
            practice='Сейчас: подпишите раскадровку входа, основной фазы и выхода; обозначьте статичную замену. После подключения JS-исполнителя: выполните маленькую сцену с одним transform/opacity и проверьте resize/reduced motion по актуальной документации GSAP.[46]'
        if item['topic']=='3d_spline':
            practice='Сейчас: нарисуйте схему из трёх форм, света и камеры и объясните статическую замену. Работа в Spline — дополнительная практика вне нынешнего приложения при отдельно подготовленном доступе; экспорт и embedding не объявляются бесплатными.'
        video_cards.append('#### Видео %s. %s\n\n[%s](%s).[%s] Канал: %s. Длительность: %s:%02d. Уровень: %s.\n\nЧто проверено: %s\n\nЯзык и субтитры: %s\n\nПосле просмотра: %s\n\nПрактика: %s\n\nОграничение: %s' % (index,item['subject'],item['title'],item['url'],source_id(item['url']),item['channel'],minutes,seconds,item['level'],item['evidence']['inspected_scope'],item['language']['status'],' '.join(item['questions']),practice,item['limitation']))
    chapters[19]=chapters[19].replace('<!-- DESIGN_RESOURCE_INDEX -->','\n\n'.join(resource_cards)).replace('<!-- DESIGN_VIDEO_INDEX -->','\n\n'.join(video_cards))
    chapters[19]+='\n\n### Дополнительное публичное текстовое обучение\n\nКурс Google web.dev Learn Responsive Design помогает разбирать адаптивную композицию и устройство макета.[47] Его можно читать отдельно в браузере; сам курс не запускает код в нашей ограниченной учебной среде. Связывайте каждый прочитанный приём со своим HTML/CSS-примером, а не собирайте ещё один список ссылок.'
    glossary=legacy[legacy.index('## Словарь:'):].split('## Итоговая самостоятельная проверка')[0].strip()
    intro='''# H&B — дизайн и основы AI-веб-разработки, редакция 2

## Как пользоваться книгой без опыта

Эта книга учит понимать веб-проект, придумывать собственную концепцию по задаче клиента и доводить небольшой прототип до проверяемого результата. Она не предполагает, что вы уже знаете терминал или умеете читать код. Незнакомое слово объясняется рядом с действием; словарь в конце основной части помогает вспомнить определение.

Порядок работы: сначала прочитайте объяснение и схему, затем повторите полностью разобранный пример и только потом выполните похожее упражнение. Исходные данные находятся в задании. Ответы самостоятельных задач расположены последним разделом; разборы показанных образцов остаются перед упражнениями. Для дизайн-задач возможны разные хорошие решения — ответ объясняет критерии, а не требует копировать единственную картинку.

Номер главы не равен номеру дня курса. Для первого знакомства с инструментом можно сначала открыть главу 22, а затем вернуться к понятиям глав 1–6. Программа определяет учебные дни, приложение хранит личную практику, книга объясняет устройство и способ работы.

FORMA — придуманный учебный магазин; другие клиенты в примерах тоже вымышлены. Их данные даны в условиях, не требуют поиска реального клиента или использования чужих секретов. Референсы служат для анализа принципов, не дают права присваивать код, бренд, тексты или медиа.

Сейчас в приложении работает статический HTML/CSS-предпросмотр. Живой ИИ, терминал, JS/React-исполнитель, внешние ресурсы, отправка форм и публикация не подключены. Поэтому чтение кода, статический макет, будущая реализация и фактически выполненная проверка обозначаются отдельно. Примеры команд объясняют их смысл, а не требуют открыть несуществующий терминал.

'''
    body=intro+'\n\n'.join(chapters)+'\n\n'+glossary+'\n'
    exercise_ids=re.findall(r'^### Упражнение (\d+\.\d+)\b',body,re.M)
    assert len(exercise_ids)==len(set(exercise_ids)), 'Duplicate exercise'
    assert set(exercise_ids)==set(answers), (set(exercise_ids)-set(answers),set(answers)-set(exercise_ids))
    for key in exercise_ids:
        exercise=body.index('### Упражнение '+key)
        assert 0 <= body.find('### Разобранный пример '+key) < exercise, 'Example must precede '+key
    ordered=sorted(answers,key=lambda key:tuple(map(int,key.split('.'))))
    answer_text='## Ответы и разборы упражнений\n\nСначала выполните свою попытку, затем сверяйте ход решения. В открытых задачах оценивается связь с брифом и качество проверки. Книга не заполняет за вас фактические результаты непроведённого теста.\n\n'+'\n\n'.join(clean(answers[key]) for key in ordered)+'\n'
    assert not re.search(r'^\*\*(Ответ|Подсказка)\.',body,re.M)
    assert '<!-- DESIGN_' not in body
    (BASE/'manuscript-v2.md').write_text(body)
    (BASE/'answers-v2.md').write_text(answer_text)
    stats={'chapters':len(chapters),'exercise_ids':exercise_ids,'answers':len(answers),'reference_sources':len(refs),'videos':len(videos),'russian_words':len(re.findall(r'[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*',body+answer_text))}
    (BASE/'revision-v2/content-verification.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2))
    print(json.dumps(stats,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
