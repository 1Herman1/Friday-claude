"""Draw original, readable teaching diagrams; no third-party imagery."""
from pathlib import Path
import json
from PIL import Image, ImageDraw, ImageFont

BASE = Path(__file__).resolve().parent
OUT = BASE / 'diagrams'
FONT = Path('/System/Library/Fonts/Supplemental/Arial.ttf')
BOLD = FONT.with_name('Arial Bold.ttf')
INK = '#183b31'
BG = '#fbfaf6'


def font(size, bold=False):
    return ImageFont.truetype(str(BOLD if bold else FONT), size)


def lines(text, face, width):
    result = []
    for para in text.split('\n'):
        current = ''
        for word in para.split():
            probe = (current + ' ' + word).strip()
            if face.getlength(probe) > width and current:
                result.append(current)
                current = word
            else:
                current = probe
        result.append(current)
    return result


def canvas(title, subtitle, height=1120):
    image = Image.new('RGB', (1500, height), BG)
    draw = ImageDraw.Draw(image)
    draw.text((60, 38), 'H&B / УЧЕБНАЯ СХЕМА', font=font(25, True), fill='#607168')
    for n, line in enumerate(lines(title, font(48, True), 1380)):
        draw.text((60, 95 + n * 58), line, font=font(48, True), fill=INK)
    draw.text((60, 220), subtitle, font=font(29), fill='#52665c')
    return image, draw


def box(draw, xy, title, body, fill='#e9efe5'):
    x, y, w, h = xy
    draw.rounded_rectangle((x, y, x+w, y+h), radius=18, fill=fill, outline='#b8c8ba', width=3)
    title_lines = lines(title, font(36, True), w-44)
    body_lines = lines(body, font(31), w-44)
    total = len(title_lines)*44 + 16 + len(body_lines)*39
    if total > h-40:
        raise ValueError('Diagram text overflow: '+title)
    at = y+20
    for text in title_lines:
        draw.text((x+22, at), text, font=font(36, True), fill=INK); at += 44
    at += 16
    for text in body_lines:
        draw.text((x+22, at), text, font=font(31), fill=INK); at += 39


def arrow(draw, start, end):
    draw.line([start, end], fill='#4b7560', width=6)
    x, y = end
    if abs(end[0]-start[0]) >= abs(end[1]-start[1]):
        direction = 1 if end[0] > start[0] else -1
        draw.polygon([(x,y),(x-18*direction,y-11),(x-18*direction,y+11)],fill='#4b7560')
    else:
        direction = 1 if end[1] > start[1] else -1
        draw.polygon([(x,y),(x-11,y-18*direction),(x+11,y-18*direction)],fill='#4b7560')


def save(image, name):
    OUT.mkdir(exist_ok=True)
    image.save(OUT/name)
    return {'file':name,'width':image.width,'height':image.height}


def main():
    results=[]
    im,d=canvas('Файл, папка и путь — разные вещи', 'Пример карты своего проекта; имя файла не равно его содержимому.')
    box(d,(60,290,460,170),'my-project/','Корневая папка проекта')
    branches=[('index.html','Структура страницы'),('styles/theme.css','Оформление'),('data/products.json','Учебные данные'),('notes/brief.md','Задача и объяснения')]
    for i,(title,body) in enumerate(branches):
        y=290+i*175
        box(d,(650,y,790,145),title,body)
        arrow(d,(520,375),(650,y+72))
    results.append(save(im,'files-tree.png'))

    im,d=canvas('Как запрос становится страницей', 'Упрощённый путь HTTPS: имя, соединение, запрос, обработка, ответ.')
    boxes=[((60,290,430,210),'1. Имя → адрес','DNS помогает найти IP по имени.'),((535,290,430,210),'2. HTTPS-связь','Проверка сертификата и шифрование.'),((1010,290,430,210),'3. HTTP-запрос','Метод, путь, заголовки, иногда тело.'),((1010,640,430,220),'4. Обработка','Сервер читает правила и нужные данные.'),((535,640,430,220),'5. HTTP-ответ','Статус, заголовки, данные или страница.'),((60,640,430,220),'6. Интерфейс','Браузер показывает результат или ошибку.')]
    for xy,t,b in boxes:box(d,xy,t,b)
    for a,b in [((490,395),(535,395)),((965,395),(1010,395)),((1225,500),(1225,640)),((1010,750),(965,750)),((535,750),(490,750))]:arrow(d,a,b)
    d.text((60,960),'DNS не хранит саму страницу. HTTPS не гарантирует честность продавца.',font=font(31),fill=INK)
    results.append(save(im,'http-roundtrip.png'))

    im,d=canvas('Из каких частей состоит веб-проект', 'Смысловая карта помогает поставить задачу, но не раскрывает чужой backend.')
    box(d,(60,290,400,200),'Страница','Целый путь: главная, каталог, товар.')
    box(d,(550,290,400,200),'Секции','Предложение, работы, процесс, контакты.')
    box(d,(1040,290,400,200),'Компоненты','Повторяемые карточки, кнопки, заголовки.')
    arrow(d,(460,390),(550,390));arrow(d,(950,390),(1040,390))
    box(d,(60,620,400,230),'Содержание','Тексты и данные: что именно показываем.')
    box(d,(550,620,400,230),'Оформление','HTML/CSS: как группируем и располагаем.')
    box(d,(1040,620,400,230),'Поведение','JS: что меняется после действия.')
    d.text((60,975),'При необходимости добавляются API и хранилище. Не каждый сайт требует их.',font=font(30),fill=INK)
    results.append(save(im,'site-parts.png'))

    im,d=canvas('Иерархия и сетка направляют взгляд', 'Условная схема: сравни порядок чтения, а не количество украшений.',1050)
    box(d,(60,295,650,620),'Слабая иерархия','Равные акценты и случайные связи.',fill='#f2e8dd')
    box(d,(790,295,650,620),'Понятный приоритет','Заголовок → пояснение → действие.')
    for x,y,w in [(95,490,210),(400,570,250),(180,700,360),(450,795,190)]:
        d.rounded_rectangle((x,y,x+w,y+65),radius=8,fill='#c0b7a8')
    d.text((835,500),'Главное предложение',font=font(40,True),fill=INK)
    d.rectangle((835,585,1350,605),fill='#a5b4a5')
    d.rectangle((835,625,1260,645),fill='#a5b4a5')
    d.rounded_rectangle((835,710,1170,790),radius=10,fill=INK)
    d.text((860,729),'Основное действие',font=font(29,True),fill='white')
    results.append(save(im,'design-grid.png'))

    im,d=canvas('Один учебный цикл — один понятный результат', 'ИИ может помогать, но зачёт и допуск остаются у куратора.')
    stages=[('Задача','Что нужно клиенту?'),('План','Что меняем, что не трогаем?'),('Макет','Свои файлы и понятная композиция.'),('Проверка','Ожидание и фактическое наблюдение.'),('Объяснение','Почему так и что ещё не работает?'),('Приёмка','Куратор принимает или возвращает.')]
    positions=[(60,300),(550,300),(1040,300),(1040,650),(550,650),(60,650)]
    for (title,body),(x,y) in zip(stages,positions):box(d,(x,y,400,240),title,body)
    for a,b in [((460,420),(550,420)),((950,420),(1040,420)),((1240,540),(1240,650)),((1040,770),(950,770)),((550,770),(460,770))]:arrow(d,a,b)
    d.text((60,990),'Есть замечания → новая редакция и повторная проверка. Принято → следующий день.',font=font(28),fill=INK)
    results.append(save(im,'learning-cycle.png'))

    im,d=canvas('Где что находится в приложении', 'Схема локальной версии: это не три разных проекта или диалога.',960)
    box(d,(60,300,320,480),'Слева','Дни курса\nПринятый прогресс\nТекущий урок')
    box(d,(425,300,460,480),'Диалог','Вопросы и отчёты\nИстория сохраняется\nLive-наставник пока off')
    box(d,(930,300,510,480),'Рабочая панель','Урок → прочитать\nФайлы → свой макет\nПриёмка → подать работу')
    results.append(save(im,'app-layout.png'))

    reports=BASE.parents[3]/'projects/hb-learning-department/reports/screenshots'
    with Image.open(reports/'desktop-learning.png') as source:
        source.crop((817,122,1430,325)).save(OUT/'app-learning.png')
    with Image.open(reports/'desktop-workspace.png') as source:
        source.crop((835,305,1425,960)).save(OUT/'app-workspace.png')
    print(json.dumps({'original_diagrams':results,'screenshots':'two cropped, credential-free disposable UI fixtures'},ensure_ascii=False))

if __name__=='__main__':main()
