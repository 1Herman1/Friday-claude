import json,html,os
B=os.path.dirname(os.path.abspath(__file__)); d=json.load(open(B+'/plan2.json')); P=d['PROD']; rows=d['rows']
f=lambda n: f"{n:,}".replace(',',' ')+' ₽'
e=html.escape
L="background:#F3EEE6;color:#2B2621;font-family:'Manrope', Arial, sans-serif;padding:128px 128px 160px;display:flex;flex-direction:column;gap:40px"
DK="background:#2A211B;color:#EFE6D8;font-family:'Manrope', Arial, sans-serif;padding:128px 128px 160px;display:flex;flex-direction:column;gap:40px"
H=lambda eb,t,c='#7A5A38': f'<div style="display:flex;flex-direction:column;gap:16px"><p style="font-size:24px;letter-spacing:4px;text-transform:uppercase;color:{c}">{eb}</p><h2 style="font-family:\'Cormorant Garamond\', Georgia, serif;font-size:72px;font-weight:500;line-height:1.1">{t}</h2></div>'
FT=lambda t,c='#6B6157': f'<p style="position:absolute;left:128px;bottom:64px;width:1664px;font-size:24px;color:{c}">{t}</p>'
slides={}
def add(i,body,style=L,notes=''):
    slides[i]=f'<section id="{i}" data-transition="fade" style="{style}">\n{body}\n'+(f'<aside>{notes}</aside>\n' if notes else '')+'</section>\n'
add('cover',f'''<p style="font-size:24px;letter-spacing:6px;text-transform:uppercase;color:#D29A6A">H&amp;B team · продюсирование · 12 месяцев</p>
<div style="display:flex;flex-direction:column;gap:36px"><h1 style="font-family:'Cormorant Garamond', Georgia, serif;font-size:140px;font-weight:500;line-height:1.0">Андрей, твой план на год</h1>
<p style="font-size:40px;line-height:1.35;color:#C9BBA8;width:1400px">Тихий люкс на старте, затем выход в медиа. Каждый месяц — понятные действия и одна сумма.</p></div>
<p style="font-size:26px;color:#C9BBA8">3 этапа · съёмки и разборы каждую неделю · отчёт каждый месяц</p>''',
 "background:#2A211B;color:#EFE6D8;font-family:'Manrope', Arial, sans-serif;padding:128px;display:flex;flex-direction:column;justify-content:space-between")
def card3(items,col='#7A5A38',tc='#3E3730'):
    return '<div style="display:flex;gap:48px">'+''.join(f'<div style="flex:1;display:flex;flex-direction:column;gap:12px;border-top:2px solid {col};padding:22px 0 0 0"><p style="font-size:24px;letter-spacing:3px;text-transform:uppercase;color:{col}">{a}</p><h3 style="font-family:\'Cormorant Garamond\', Georgia, serif;font-size:52px;font-weight:500;line-height:1.05">{b}</h3><p style="font-size:26px;line-height:1.45;color:{tc}">{c}</p></div>' for a,b,c in items)+'</div>'
add('path',H('Что ты выбрал','Сначала тихий люкс, потом медиа')+card3([
 ('Месяцы 1–3','Фундамент','Стратегия, упаковка бренда, Instagram и контент со 2-го месяца, ролики, страница'),
 ('Месяцы 4–6','Тихий люкс','Витрина, рекомендатели, встречи с партнёрами, сервис постоянного клиента'),
 ('Месяцы 7–12','Медиа','Telegram и Max, интервью, коллаборации, закрытый клуб «Тот самый массаж»')])
 +'<p style="font-size:28px;line-height:1.45;color:#6B6157">Контент идёт с самого начала: съёмки и разбор плана — каждую неделю, Instagram — со 2-го месяца.</p>'+FT('H&amp;B team · План'))
add('pay',H('Как устроена оплата','Одна сумма в месяц, за конкретные действия')+card3([
 ('Каждый месяц','30 000 ₽ — продюсирование','Съёмки и разборы каждую неделю, команда, сроки, партнёры и площадки, отчёт'),
 ('Каждый месяц','Работы месяца','Стратегия, контент, продакшн, площадки — у каждой работы виден результат'),
 ('Итого','Сумма месяца','Оплата в начале месяца. Сумма каждого месяца указана в плане')])
 +'<p style="font-size:26px;line-height:1.45;background:#E4D9C8;border-radius:12px;padding:20px 28px">Крупные работы — страницу, контент, партнёров — мы разложили по месяцам, чтобы не платить всё сразу.</p>'+FT('H&amp;B team · Оплата'))
add('producer',H('Продюсирование · 30 000 ₽ в месяц','За что именно ты платишь')+'''<div style="display:grid;grid-template-columns:1fr 1fr;gap:28px 56px">'''+''.join(f'<div style="display:flex;flex-direction:column;gap:8px;border-top:2px solid #7A5A38;padding:18px 0 0 0"><h3 style="font-size:30px;font-weight:700">{a}</h3><p style="font-size:26px;line-height:1.45;color:#3E3730">{b}</p></div>' for a,b in [
 ('Съёмка каждую неделю','Со 2-го месяца снимаем материал для роликов и публикаций'),
 ('Разбор каждую неделю','Что сделали, что пошло не так, что улучшаем на следующей неделе'),
 ('Команда','Копирайтер, фотограф, монтажёр, дизайнер: искать и проверять их не нужно'),
 ('Партнёры и площадки','Рекомендатели, подкасты, издания, партнёры для коллабораций')])+'</div>'+FT('Раз в месяц — отчёт: часы, семьи на курсе, откуда пришли клиенты, рост каналов'))
pairs=[rows[i:i+2] for i in range(0,12,2)]
for k,pr in enumerate(pairs,1):
    cards=''
    for r in pr:
        tr=''.join(f'<tr><td style="padding:10px 4px"><b>{e(a)}</b><br><span style="color:#6B6157">{e(b)}</span></td><td style="text-align:right;white-space:nowrap;padding:10px 4px">{f(p)}</td></tr>' for a,b,p in r['items'])
        cards+=f'''<div style="flex:1;display:flex;flex-direction:column;gap:10px;background:#FBF8F3;border:1px solid #DCCFBC;border-radius:12px;padding:28px 32px;min-width:0">
<div style="display:flex;justify-content:space-between"><p style="font-size:24px;letter-spacing:3px;text-transform:uppercase;color:#7A5A38">Месяц {r["n"]} · {r["mon"]}</p><p style="font-size:24px;color:#6B6157">{r["phase"]}</p></div>
<h3 style="font-family:'Cormorant Garamond', Georgia, serif;font-size:44px;font-weight:500;line-height:1.1">{e(r["title"])}</h3>
<table style="font-size:22px;color:#2B2621">{tr}<tr><td style="padding:10px 4px"><b>Продюсирование</b><br><span style="color:#6B6157">{'Разбор плана каждую неделю' if r['n']==1 else 'Съёмки и разборы каждую неделю'}</span></td><td style="text-align:right;padding:10px 4px">{f(P)}</td></tr>
<tr style="background:#E4D9C8"><td style="padding:10px 4px"><b>Итого за месяц</b></td><td style="text-align:right;padding:10px 4px"><b>{f(r["total"])}</b></td></tr></table></div>'''
    add(f'm{k}',f'<p style="font-size:24px;letter-spacing:4px;text-transform:uppercase;color:#7A5A38">План по месяцам · {k} из 6</p>\n<div style="display:flex;gap:40px">{cards}</div>',
        "background:#F3EEE6;color:#2B2621;font-family:'Manrope', Arial, sans-serif;padding:96px 128px 128px;display:flex;flex-direction:column;gap:28px")
add('result',H('Что ты получаешь','Результат по этапам (оценка)')+'''<table style="font-size:26px;color:#2B2621"><tr><th style="width:18%;text-align:left">К концу</th><th style="width:44%;text-align:left">Клиенты и доход</th><th style="width:38%;text-align:left">Медиа</th></tr>
<tr><td>3-го месяца</td><td>Готовы стратегия и стиль; первая семья из твоей базы переходит на курс</td><td>Instagram, ролики каждую неделю</td></tr>
<tr><td>6-го месяца</td><td>Первые постоянные клиенты: 2–3 семьи на курсе, 335–500 тыс. ₽ в месяц</td><td>Instagram, страница, рекомендатели</td></tr>
<tr><td>12-го месяца</td><td>4–5 семей, 670–840 тыс. ₽ в месяц; новые клиенты из медиа; цена для новых +10–15%</td><td>Telegram и Max, Instagram, клуб «Тот самый массаж»</td></tr></table>
<p style="font-size:26px;line-height:1.45;background:#E4D9C8;border-radius:12px;padding:20px 28px"><b>Почему курс, а не разовый сеанс:</b> то, что тело копило годами, за один сеанс не уходит. Семья из трёх человек — 15 часов в месяц ≈ 167 000 ₽</p>'''+FT('Оценка · 1 час = 1 г золота ≈ 11 163 ₽'))
OBJ=[('«Это дорого»','Одна семья на курсе — 15 часов в месяц ≈ 167 000 ₽. Это два месяца нашей работы, всё остальное — твой плюс'),
 ('«У меня и так сарафан»','Сарафан привёл клиентов, но не удержал их после повышения цены. Мы строим его заново под новую цену — через тех, кому доверяют богатые семьи'),
 ('«Сделаю сам»','Можно. Но это 4–15 часов каждую неделю: съёмки, монтаж, тексты, разборы, встречи. По 11 000 ₽ за твой час — дороже, чем мы'),
 ('«Не хочу светиться»','Instagram начинаем с рук и ритуала, без лица. Лицо и голос — когда ты готов, клиентов в кадре нет'),
 ('«А если не будет клиентов?»','Каждый месяц ты видишь отчёт: встречи, заявки, источники. Если этап не работает — меняем план, а не продолжаем вслепую'),
 ('«Боюсь, что украдут технику»','В открытых каналах — философия и ощущения. Технику видят только участники закрытого клуба, которых отбираешь ты')]
add('obj',H('Частые вопросы','Что обычно спрашивают и что мы отвечаем')+'<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:28px 40px">'+''.join(f'<div style="display:flex;flex-direction:column;gap:8px;border-top:2px solid #7A5A38;padding:16px 0 0 0"><h3 style="font-size:28px;font-weight:700">{a}</h3><p style="font-size:24px;line-height:1.45;color:#3E3730">{b}</p></div>' for a,b in OBJ)+'</div>',
 "background:#F3EEE6;color:#2B2621;font-family:'Manrope', Arial, sans-serif;padding:112px 128px 128px;display:flex;flex-direction:column;gap:32px")
add('close','''<p style="font-size:24px;letter-spacing:6px;text-transform:uppercase;color:#D29A6A">Следующий шаг</p>
<div style="display:flex;flex-direction:column;gap:32px"><h2 style="font-family:'Cormorant Garamond', Georgia, serif;font-size:120px;font-weight:500;line-height:1.0">Начинаем со стратегии</h2>
<p style="font-size:36px;line-height:1.4;color:#C9BBA8;width:1300px">Назначаем два интервью: через месяц у тебя стратегия, единый стиль и план контента, со второго — Instagram и съёмки каждую неделю.</p></div>
<div style="display:flex;flex-direction:column;gap:8px"><p style="font-size:32px;font-weight:600">H&amp;B team · Герман Брызгалов</p><p style="font-size:28px;color:#C9BBA8">+7 916 965 56 11 · 1herman1.github.io/hb_landing</p></div>''',
 "background:#2A211B;color:#EFE6D8;font-family:'Manrope', Arial, sans-serif;padding:128px;display:flex;flex-direction:column;justify-content:space-between")
order=['cover','path','pay','producer']+[f'm{k}' for k in range(1,7)]+['result','obj','close']
os.makedirs(B+'/project/slides',exist_ok=True)
for k,v in slides.items(): open(f'{B}/project/slides/{k}.html','w').write(v)
json.dump({"v":4,"createdOnFiles":{"v":1,"at":"2026-10-25T12:00:00Z"},"lists":"css","title":"Андрей: план продюсирования","cover":"cover","order":order,
 "sections":{"s1":{"description":"План и оплата","start":"cover"},"s2":{"description":"План по месяцам","start":"m1"},"s3":{"description":"Результат и вопросы","start":"result"}},
 "faces":{"cormorant-garamond":{"family":"Cormorant Garamond","href":"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600&display=swap"},"manrope":{"family":"Manrope","href":"https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap"}},"designSystems":[]},open(B+'/project/deck.json','w'),ensure_ascii=False)
# plan file
md=['# Андрей: план продюсирования на 12 месяцев','',f'Оплата: продюсирование {f(P)} в месяц + действия месяца. Съёмки и разборы плана — каждую неделю.','']
for r in rows:
    md+= [f'## Месяц {r["n"]} · {r["mon"]} · {r["phase"]} — {r["title"]} · {f(r["total"])}','','| Действие | Результат | Цена | Статус |','|---|---|---|---|']
    md+= [f'| {a} | {b} | {f(p)} | ☐ |' for a,b,p in r['items']]+[f'| Продюсирование: съёмки и разборы каждую неделю, команда | 4 разбора и отчёт за месяц | {f(P)} | ☐ |','']
open(B+'/plan.md','w').write('\n'.join(md))
print(len(order))
