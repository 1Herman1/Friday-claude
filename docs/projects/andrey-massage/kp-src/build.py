import json,html,sys
d=json.load(open(sys.argv[1])); P=d['P']; rows=d['rows']; out=sys.argv[2]
f=lambda n: f"{n:,}".replace(',','\u00a0')+'\u00a0₽'
months=['Ноябрь 2026','Декабрь 2026','Январь 2027','Февраль 2027','Март 2027','Апрель 2027','Май 2027','Июнь 2027','Июль 2027','Август 2027','Сентябрь 2027','Октябрь 2027']
cards=[]
for (i,phase,title,items,s,tot) in rows:
    li=''.join(f'<tr><td>{html.escape(n)}</td><td class="num">{f(p)}</td></tr>' for n,p in items)
    cards.append(f'''<article class="month"><header><span class="mno">Месяц {i}</span><span class="phase">{phase}</span></header>
<h3>{html.escape(title)}</h3><p class="when">{months[i-1]}</p>
<table><tr><td>Продюсирование</td><td class="num">{f(P)}</td></tr>{li}
<tr class="total"><td>Итого за месяц</td><td class="num">{f(tot)}</td></tr></table></article>''')
summ=''.join(f'<tr><td>{i}</td><td>{phase}</td><td class="num">{f(tot)}</td></tr>' for (i,phase,title,items,s,tot) in rows)
t6=sum(r[5] for r in rows[:6]); t12=sum(r[5] for r in rows)
doc=open(sys.argv[3]).read().replace('{{CARDS}}','\n'.join(cards)).replace('{{SUMMARY}}',summ).replace('{{T6}}',f(t6)).replace('{{T12}}',f(t12)).replace('{{AVG}}',f(round(t12/12))).replace('{{P}}',f(P))
open(out,'w').write(doc)
