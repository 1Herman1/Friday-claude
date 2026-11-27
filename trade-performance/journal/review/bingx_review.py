#!/usr/bin/env python3
"""BingX-only visual review of EVERY stored position, including open ones.

Uses Codex subscription. No orders, no deletes. Screenshots must be captured
from the journal first; --dry-run inspects scope without screenshots or writes.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys

import psycopg
import ai_review as ar
import agent_pass as ap

VERSION = 'bingx-visual-codex-v1'
ROOT = Path(__file__).resolve().parents[2]


def context(cur, tid):
    job = ar.build_trade(cur, str(tid))
    cur.execute("""SELECT t.status,t.margin_mode,t.margin_used,t.leverage,t.liquidation_price,
                          i.symbol,t.side FROM trades t JOIN instruments i ON i.id=t.instrument_id
                   WHERE t.id=%s""", (tid,))
    status, mode, margin, lev, liq, symbol, side = cur.fetchone()
    cur.execute("""SELECT r.payload FROM raw_records r JOIN accounts a ON a.id=r.account_id
                   WHERE a.name='BingX Futures' AND r.stream='api:bingx_positions'
                     AND r.external_id='snapshot'""")
    snapshot = (cur.fetchone() or [{}])[0]
    live = [p for p in snapshot.get('positions', [])
            if p['symbol'].replace('-', '') == symbol and p['positionSide'] == side] if status == 'OPEN' else []
    cur.execute("""SELECT r.payload FROM raw_records r JOIN accounts a ON a.id=r.account_id
                   WHERE a.name='BingX Futures' AND r.stream='api:bingx_open_orders'
                     AND r.external_id='snapshot'""")
    order_snapshot = (cur.fetchone() or [{}])[0]
    pending = [o for o in order_snapshot.get('orders', [])
               if o['symbol'].replace('-', '') == symbol and o['positionSide'] == side] if status == 'OPEN' else []
    extra = (f'\n\n## Проверенные дополнительные данные\nБиржа: BingX. Статус {status}. '
             f'Режим маржи {mode or "неизвестен"}. Плечо {lev}. '
             f'Текущая initialMargin из API (не обязательно маржа первоначального входа): {margin}. '
             f'Текущая цена ликвидации: {liq}.\n'
             f'Снимок открытой позиции: {json.dumps(live,ensure_ascii=False,default=str)}\n'
             f'Метка времени снимка Unix ms: {snapshot.get("at")}.\n'
             f'Текущие отложенные ордера этой позиции из openOrders: {json.dumps(pending,ensure_ascii=False,default=str)}\n'
             'Тип TAKE_PROFIT — тейк-профит, а не защитный стоп. Не утверждай отсутствие ордеров, если они перечислены.\n'
             'У открытой сделки NET в дневнике содержит уже реализованный результат частичных закрытий, '
             'комиссии и фандинг; unrealizedProfit из снимка — отдельный плавающий результат. '
             'Не выдавай ни одну из этих величин за окончательный итог открытой сделки. '
             'Кросс-маржа не ограничивает убыток величиной initialMargin.\n'
             'В БД каждое исполнение сохранено отдельно. Для закрывающих исполнений одного ордера '
             'realized PnL распределён пропорционально количеству с сохранением точного итогового PnL ордера.\n'
             'Скрин автоматически снят с карточки дневника. Это НЕ личные рисунки трейдера. '
             'Источник свечей указан на изображении; свечи другой биржи только ориентир. '
             'Реконструкция по исполнениям НЕ рыночные свечи. Не выдумывай отсутствующие свечи, '
             'уровни, стопы, мотивы и виды выхода. Причина входа без заметки — только гипотеза.\n'
             'Принятое правило Германа для сравнения: начальная маржа около $20 при 10x. '
             'Это правило для аудита, не доказательство фактического риска этой позиции. '
             'Доливки количества подтверждай исполнениями; добавление маржи нельзя доказать только количеством.\n')
    task = ('\n## Задача\nДай разбор на русском до 230 слов: Итог; Вход; Выход/текущее состояние; '
            'Риск и доливки; Что хорошо; Ошибки (только подтверждённые); Одно правило. '
            'Для открытой позиции не называй её закрытой и не давай команд купить/продать. '
            'В конце JSON одной строкой: {"tags":[],"rules_broken":[],"tilt_risk":0}.')
    return job, job['ctx'] + extra + task


def select_positions(cur, trade_id=None):
    sql = """WITH o AS (SELECT id,row_number() over(order by opened_at) n FROM trades WHERE deleted_at IS NULL)
          SELECT t.id,o.n,i.base_asset,t.status FROM trades t JOIN o ON o.id=t.id
          JOIN accounts a ON a.id=t.account_id JOIN instruments i ON i.id=t.instrument_id
          WHERE a.name='BingX Futures' AND t.deleted_at IS NULL"""
    params = (trade_id,) if trade_id else ()
    if trade_id:
        sql += " AND t.id=%s"
    cur.execute(sql + " ORDER BY t.opened_at", params)
    return cur.fetchall()


def store_review(cur, tid, status, body, findings, running_review_id=None):
    payload = json.dumps(findings, ensure_ascii=False)
    if running_review_id:
        cur.execute("""UPDATE ai_reviews SET status=%s,content_md=%s,findings=%s
                       WHERE id=%s AND trade_id=%s AND status='running' RETURNING id""",
                    (status, body, payload, running_review_id, tid))
    else:
        cur.execute(f"""INSERT INTO ai_reviews (id,organization_id,user_id,trade_id,kind,status,content_md,findings)
                    VALUES (gen_random_uuid(),{ar.ORG},(SELECT id FROM users WHERE telegram_user_id=7098788894),
                            %s,'trade',%s,%s,%s) RETURNING id""", (tid, status, body, payload))
    row = cur.fetchone()
    if not row:
        raise ValueError('Invalid, unrelated or already completed running review ID')
    return row[0]


def chart_source_label(image):
    meta_path = Path(str(image) + '.json')
    if not meta_path.exists():
        return 'Метаданные отсутствуют: источник определять только по подписи самого изображения.'
    meta = json.loads(meta_path.read_text())
    if meta.get('sha256') != hashlib.sha256(image.read_bytes()).hexdigest():
        raise ValueError('Chart metadata hash mismatch')
    return meta['source_label']


def review(tid, chart_dir, force=False, running_review_id=None):
    with psycopg.connect(os.environ['DATABASE_URL']) as conn, conn.cursor() as cur:
        job, prompt = context(cur, tid)
        image = chart_dir / f'{tid}.png'
        if not image.exists():
            return {'id':str(tid),'ok':False,'error':'chart screenshot missing'}
        prompt += ('\n\n## Проверенная подпись приложенного скриншота\n' + chart_source_label(image) +
                   '\nИсточник свечей бери из этой подписи; не подменяй его биржей из похожих исторических сделок.\n')
        digest = hashlib.sha256((prompt + hashlib.sha256(image.read_bytes()).hexdigest()).encode()).hexdigest()
        cur.execute("""SELECT id FROM ai_reviews WHERE trade_id=%s AND status='done'
                       AND findings->>'agent'=%s AND findings->>'input_hash'=%s""", (tid,VERSION,digest))
        prev=cur.fetchone()
        if prev and not force and not running_review_id:
            return {'id':str(tid),'ok':True,'skipped':True,'review_id':str(prev[0])}
        ap.save_chart(cur, tid, image)
        started = datetime.now(timezone.utc)
        result = ar.call_codex(prompt, ar.SYSTEM, images=[image])
        body, findings = ar.split_json(result.get('text','')) if result['ok'] else (None,{})
        findings = {**(findings or {}),'agent':VERSION,'input_hash':digest,'chart_sha256':hashlib.sha256(image.read_bytes()).hexdigest()}
        rid = store_review(cur, tid, 'done' if result['ok'] else 'failed', body, findings, running_review_id)
        cur.execute(f"""INSERT INTO llm_calls (id,organization_id,ai_review_id,role,provider,model,billing,
                          prompt_version,prompt_hash,prompt,response,input_tokens,output_tokens,cache_tokens,
                          cost_usd,latency_ms,status,error,started_at)
                    VALUES (gen_random_uuid(),{ar.ORG},%s,'post_trade_review','openai-codex',%s,'SUBSCRIPTION',
                            %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                    (rid,result.get('model',ar.MODEL),VERSION,digest,ar.SYSTEM+'\n\n'+prompt,
                     result.get('text'),result.get('in'),result.get('out'),result.get('cache'),result.get('cost'),
                     result['ms'],'ok' if result['ok'] else 'error',result.get('error'),started))
        conn.commit()
        return {'id':str(tid),'ok':result['ok'],'review_id':str(rid),'title':job['title'],
                'ms':result['ms'],'error':result.get('error')}


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--dry-run',action='store_true')
    p.add_argument('--capture',action='store_true')
    p.add_argument('--workers',type=int,default=3)
    p.add_argument('--limit',type=int,default=0)
    p.add_argument('--force',action='store_true')
    p.add_argument('--trade',help='UUID одной позиции BingX, включая открытую')
    p.add_argument('--running-review-id',help='UUID строки running из веб-карточки')
    p.add_argument('--out',type=Path)
    args=p.parse_args();ar.env()
    if args.running_review_id and not args.trade:
        p.error('--running-review-id requires --trade')
    if args.out is None:
        suffix = args.running_review_id or datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        args.out = ROOT / 'journal/data/reports' / ('bingx-' + suffix)
    with psycopg.connect(os.environ['DATABASE_URL']) as conn,conn.cursor() as cur:
        rows = select_positions(cur, args.trade)
        if args.trade and len(rows) != 1:
            p.error('BingX position not found')
        if args.limit:rows=rows[:args.limit]
        if args.dry_run:
            print(json.dumps({'positions':len(rows),'open':sum(r[3]=='OPEN' for r in rows),
                'ids':[str(r[0]) for r in rows],'sample_prompt':context(cur,rows[-1][0])[1] if rows else ''},ensure_ascii=False,default=str,indent=2));return
    args.out.mkdir(parents=True,exist_ok=True);charts=args.out/'charts';charts.mkdir(exist_ok=True)
    (args.out/'manifest.json').write_text(json.dumps([{'id':str(t),'n':n,'symbol':s,'status':st} for t,n,s,st in rows],ensure_ascii=False,indent=2))
    if args.capture:
        ap.shoot([{'id':str(t),'out':str((charts/f'{t}.png').resolve())} for t,_,_,_ in rows])
    missing=[str(t) for t,_,_,_ in rows if not (charts/f'{t}.png').exists()]
    if missing:sys.exit('Missing screenshots: '+json.dumps(missing))
    results=[]
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        jobs={pool.submit(review,t,charts,args.force,args.running_review_id):t for t,_,_,_ in rows}
        for f in as_completed(jobs):
            try:r=f.result()
            except Exception as e:r={'id':str(jobs[f]),'ok':False,'error':str(e)}
            results.append(r)
            with (args.out/'results.jsonl').open('a') as out:out.write(json.dumps(r,ensure_ascii=False)+'\n')
            print(json.dumps({'completed':len(results),'total':len(rows),**r},ensure_ascii=False),flush=True)
    summary={'expected':len(rows),'ok':sum(bool(r['ok']) for r in results),'failed':sum(not r['ok'] for r in results)}
    (args.out/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    print(json.dumps(summary,ensure_ascii=False))
    if summary['failed']:sys.exit(1)


if __name__=='__main__':main()
