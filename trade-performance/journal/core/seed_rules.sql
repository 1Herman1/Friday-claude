-- Базовые правила Германа (идемпотентно). kind=rule → «нарушенное правило» в карточке и детектор тильта;
-- kind=checklist → чек-лист перед входом (Ф2). Править текст можно прямо в БД/вебе — код ссылается на code.
INSERT INTO rules (id, organization_id, user_id, code, text, kind, sort_order)
SELECT gen_random_uuid(), o.id, u.id, r.code, r.text, r.kind, r.ord
FROM organizations o, users u,
 (VALUES
  ('stop_set',            'Стоп выставлен сразу при входе',                          'rule', 10),
  ('stop_not_liq',        'Стоп не равен ликвидации (стоп раньше ликвидационной цены)', 'rule', 20),
  ('no_reentry_5m',       'Не входить раньше чем через 5 мин после убытка',          'rule', 30),
  ('no_size_up_after_loss','Не увеличивать объём после убытка',                      'rule', 40),
  ('no_averaging',        'Не усреднять убыточную позицию',                         'rule', 50),
  ('max_trades_day',      'Не больше 5 сделок в день',                               'rule', 60),
  ('setup_only',          'Вход только по сетапу из плейбука',                       'rule', 70),
  ('risk_limit',          'Риск на сделку не больше 2% депозита',                    'rule', 80),
  ('ck_setup',            'Сетап из моего плейбука? (SMC 15m / шорт пампа)',         'checklist', 110),
  ('ck_htf',              'Старший ТФ не против сделки',                             'checklist', 120),
  ('ck_stop',             'Стоп определён и стоит ДО ликвидации',                    'checklist', 130),
  ('ck_risk',             'Риск ≤ 2% депозита, R:R ≥ 2',                             'checklist', 140),
  ('ck_state',            'Я спокоен: нет серии убытков / желания отыграться',       'checklist', 150),
  ('ck_news',             'Нет важных новостей/фандинга в ближайший час',            'checklist', 160)
 ) AS r(code, text, kind, ord)
WHERE o.slug = 'german' AND u.telegram_user_id = 7098788894
ON CONFLICT (organization_id, code) DO NOTHING;
