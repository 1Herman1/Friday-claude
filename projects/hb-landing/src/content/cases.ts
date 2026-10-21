import smena from '../assets/cases/smena.jpg';
import atlas from '../assets/cases/atlas.jpg';
import domKeramiki from '../assets/cases/dom-keramiki.jpg';
import primeFitness from '../assets/cases/prime-fitness.jpg';
import potok from '../assets/cases/potok.jpg';
import sovetnik from '../assets/cases/sovetnik.jpg';
import zooMoscow from '../assets/cases/zoo-moscow.jpg';
import proCosmetics from '../assets/cases/pro-cosmetics.jpg';
import vetMoscow from '../assets/cases/vet-moscow.jpg';

import smenaShot1 from '../assets/cases/shots/smena-1.jpg';
import smenaShot2 from '../assets/cases/shots/smena-2.jpg';
import atlasShot1 from '../assets/cases/shots/atlas-1.jpg';
import atlasShot2 from '../assets/cases/shots/atlas-2.jpg';
import domKeramikiShot1 from '../assets/cases/shots/dom-keramiki-1.jpg';
import domKeramikiShot2 from '../assets/cases/shots/dom-keramiki-2.jpg';
import primeFitnessShot1 from '../assets/cases/shots/prime-fitness-1.jpg';
import primeFitnessShot2 from '../assets/cases/shots/prime-fitness-2.jpg';
import potokShot1 from '../assets/cases/shots/potok-1.jpg';
import potokShot2 from '../assets/cases/shots/potok-2.jpg';
import sovetnikShot1 from '../assets/cases/shots/sovetnik-1.jpg';
import sovetnikShot2 from '../assets/cases/shots/sovetnik-2.jpg';
import zooMoscowShot1 from '../assets/cases/shots/zoo-moscow-1.jpg';
import zooMoscowShot2 from '../assets/cases/shots/zoo-moscow-2.jpg';
import zooMoscowShot3 from '../assets/cases/shots/zoo-moscow-3.jpg';
import proCosmeticsShot1 from '../assets/cases/shots/pro-cosmetics-1.jpg';
import proCosmeticsShot2 from '../assets/cases/shots/pro-cosmetics-2.jpg';
import proCosmeticsShot3 from '../assets/cases/shots/pro-cosmetics-3.jpg';
import vetMoscowShot1 from '../assets/cases/shots/vet-moscow-1.jpg';
import vetMoscowShot2 from '../assets/cases/shots/vet-moscow-2.jpg';
import vetMoscowShot3 from '../assets/cases/shots/vet-moscow-3.jpg';

export interface CaseShot {
  src: ImageMetadata;
  caption: string;
  video?: { src: string; poster: string };
}

export interface Case {
  id: string;
  name: string;
  image: ImageMetadata;
  coverTagsRight?: boolean;
  coverPosition?: string;
  mockup?: boolean;
  shots?: CaseShot[];
  tags: string[];
  task: string;
  solution: string;
  result: string;
}

export const cases: Case[] = [
  {
    id: 'zoo-moscow',
    name: 'Зоомагазин, Москва',
    image: zooMoscow,
    coverPosition: 'center 78%',
    shots: [
      { src: zooMoscowShot1, caption: 'Главная' },
      { src: zooMoscowShot2, caption: 'Подбор корма' },
      { src: zooMoscowShot3, caption: 'Версия для телефона' },
    ],
    tags: ['E-commerce', 'МойСклад', 'Подбор корма'],
    task: 'Зоомагазин продавал на маркетплейсах. Нужен был свой магазин с админкой вместо продаж только на площадках: покупатели заказывают напрямую, с бонусами и без комиссии площадок в цене, а цены, остатки и фото сами приходят из складской программы МойСклад.',
    solution: 'Сделали интернет-магазин с нуля: дизайн с упором на мобильную версию · универсальный подбор корма для любого питомца · бонусная система: начисление после каждой покупки · личный кабинет и подписка на корм с дополнительной скидкой · 4 способа доставки с выбором пункта выдачи',
    result: '520 товаров на витрине, 9 брендов, 1 398 фасовок сопоставлены с МойСклад по артикулу, цене и остаткам. Реализована админка из 14 разделов: баннеры, статьи и цены доставки владелец правит сам. Проведено SEO-исследование: собрано семантическое ядро, разработана стратегия выхода в топ поиска и план работ на 12 месяцев с ожидаемым результатом.',
  },
  {
    id: 'pro-cosmetics',
    name: 'Магазин про-косметики',
    image: proCosmetics,
    coverTagsRight: true,
    shots: [
      {
        src: proCosmeticsShot1,
        caption: 'Главная: компьютер и телефон',
        video: { src: 'media/cases/pro-cosmetics-main.mp4', poster: 'media/cases/pro-cosmetics-main.webp' },
      },
      { src: proCosmeticsShot2, caption: 'Подбор ухода: вопросы и программа' },
      {
        src: proCosmeticsShot3,
        caption: 'Сцена «Бестселлеры»',
        video: { src: 'media/cases/pro-cosmetics-bestsellers.mp4', poster: 'media/cases/pro-cosmetics-bestsellers.webp' },
      },
    ],
    tags: ['E-commerce', 'Дизайн', 'Подбор ухода'],
    task: 'Магазин профессиональной косметики работал на WordPress: страницы брендов, на которые вело меню, открывались с ошибкой 404. Покупатели двух типов: розничный видит цены сразу, косметолог — оптовые, и только после проверки документов. Нужен был свой магазин с такими правилами и с подбором ухода по типу кожи и задаче.',
    solution: 'Сделали интернет-магазин с админ-панелью: дизайн-система по запросу клиента — цветовая гамма передаёт идею бизнеса · алгоритм подбора ухода под каждый тип кожи: 6 вопросов, 5 типов кожи, 8 задач · два типа покупателей: косметологам после регистрации открываются оптовые цены, остальным — розничные · автоматическая верификация косметолога: анализ фото диплома или сертификата и сверка ИНН с государственным реестром · бонусная система и уникальный промокод для каждого косметолога-партнёра · подключение 1С и синхронизация товаров · SEO: анализ конкурентов в нише и план развития на 12 месяцев под нужный результат в поиске',
    result: 'Товары кластеризованы: больше 50 позиций в 9 категориях. Работают бонусная система и подбор ухода — он поднял средний чек на 30%. У партнёров уникальные промокоды: продажи каждого косметолога видны, процент начисляется по ним. Собрано семантическое ядро, проработаны стратегия продвижения в поиске и карточка в Яндекс Картах, составлен план на 12 месяцев. Магазин запущен и работает без перебоев.',
  },
  {
    id: 'vet-moscow',
    name: 'Ветклиника, Москва',
    image: vetMoscow,
    shots: [
      { src: vetMoscowShot1, caption: 'Спрос по запросам' },
      { src: vetMoscowShot2, caption: 'Доля справочников в выдаче' },
      { src: vetMoscowShot3, caption: 'Запросы с подтверждённым спросом — фрагмент' },
    ],
    tags: ['SEO', 'Аналитика'],
    task: 'Премиальная ветклиника с упором на хирургию готовится к открытию в Москве, сайта ещё нет. Цель — до запуска понять, по каким запросам у новой клиники реально есть место в поиске, под что строить сайт и во что вкладывать бюджет продвижения.',
    solution: 'Собрали 117 запросов в 11 группах — от операций и симптомов до пород и района. Сняли 193 среза живой выдачи Яндекса и Google (1 871 результат, 331 домен), сверили спрос со статистикой Яндекса и посчитали, какую долю первой тройки держат справочники: Яндекс Карты, Zoon, 2ГИС. Сделали наглядный отчёт, стратегию на 12 месяцев в 4 стадии и коммерческое предложение из 13 пунктов с ценой каждого: стартовый состав и расширения к нему.',
    result: 'Подтверждённый спрос по 20 запросам — 4 055 поисков в месяц. Районные запросы — по 17–36 поисков в месяц, и 66–100% первой тройки там у справочников, поэтому ставку на район мы из плана убрали. Место есть у стерилизации кошек и собак и кастрации собак (1 187 поисков в месяц, справочники 0–16%) и у симптомных запросов (справочников 0%) — на них и строится план сайта.',
  },
  {
    id: 'smena',
    name: 'Смена',
    image: smena,
    mockup: true,
    shots: [
      { src: smenaShot1, caption: 'Неделя по 14 точкам' },
      { src: smenaShot2, caption: 'Автоподбор на смену' },
    ],
    tags: ['SaaS', 'Графики'],
    task: 'Маленькая сеть кофеен (14 точек) тратила 3 часа на составление графика — через Google Sheets, визуализацию в Excel, согласование по email.',
    solution: 'Сделали веб-сервис: менеджер вводит данные о смене (дата, время, позиции), алгоритм подбирает людей с нужными навыками и свободным временем, проверяет ограничения (макс. часы, дни отдыха). Всё хранится в облаке, доступно с мобильного.',
    result: 'График за 20 минут вместо 3 часов. Сервис продаётся по подписке конкурентам.',
  },
  {
    id: 'atlas',
    name: 'Атлас',
    image: atlas,
    mockup: true,
    shots: [
      { src: atlasShot1, caption: 'Карточка договора' },
      { src: atlasShot2, caption: 'Маршрут согласования' },
    ],
    tags: ['Портал', 'Корпоративный'],
    task: 'Строительный холдинг (800 сотрудников) согласовывал договоры вручную: диспетчер создаёт форму, подрядчик заполняет, юрист проверяет, финансы одобряют. Всё по email и доступу на сервер. Средний срок — 9 дней.',
    solution: 'Портал с чётким workflow: форма → экспорт в Word → визуальный чеклист согласования (кто на каком этапе) → уведомления в email и Telegram.',
    result: 'Срок согласования — 2 дня. Юристы видят метрики: кто спит на задачах, какие типы договоров тормозят.',
  },
  {
    id: 'dom-keramiki',
    name: 'Дом Керамики',
    image: domKeramiki,
    mockup: true,
    shots: [
      { src: domKeramikiShot1, caption: 'Карточка плитки' },
      { src: domKeramikiShot2, caption: 'Калькулятор метража' },
    ],
    tags: ['E-commerce', 'Интеграция'],
    task: '12 000 товаров (плитка, керамика), каталог в 1С, нет интернет-магазина. Заказы принимали по телефону. Клиентам нужны фото, цены, расчёт метража для заказа.',
    solution: 'Интернет-магазин на WordPress+WooCommerce с интеграцией 1С (синхронизация каталога, остатков, цен). Специальный калькулятор метража (клиент выбирает плитку → вводит размеры → видит, сколько нужно штук).',
    result: 'Онлайн-выручка выросла в 2,4 раза за полгода. Тепловые карты показывают, какие плитки популярнее — можно оптимизировать закупки.',
  },
  {
    id: 'prime-fitness',
    name: 'Прайм.Фитнес',
    image: primeFitness,
    mockup: true,
    shots: [
      { src: primeFitnessShot1, caption: 'Расписание и запись' },
      { src: primeFitnessShot2, caption: 'Напоминание за час' },
    ],
    tags: ['Мобильное', 'Приложение'],
    task: 'Сеть фитнес-студий (8 филиалов). Посетители записывались к тренеру по телефону (50% звонков), узнавали расписание через WhatsApp-группы, забывали про тренировки.',
    solution: 'Мобильное приложение: расписание, бронь слота, push-напоминания за день и за час, история посещений, бонусы за регулярность.',
    result: '70% записей теперь идёт через приложение вместо звонков. Явка выросла на 12% благодаря напоминаниям.',
  },
  {
    id: 'potok',
    name: 'Поток',
    image: potok,
    mockup: true,
    shots: [
      { src: potokShot1, caption: 'Письмо → сделка в CRM' },
      { src: potokShot2, caption: 'Расхождение в весе' },
    ],
    tags: ['ИИ', 'Логистика'],
    task: 'Логистическая компания получает 400 заявок в день письмами (из разных источников). Диспетчер вручную читает письмо, ищет адрес доставки, вид груза, вес, создаёт запись в CRM, пишет черновик ответа.',
    solution: 'Подключили ИИ (Claude API): письмо с вложениями → ИИ извлекает данные → создаёт сделку в CRM → готовит черновик ответа. Диспетчер только проверяет и отправляет.',
    result: 'Обработка заявки — 2 минуты вместо 20. Пропускная способность +30% при том же штате. Окупилось за 3 месяца.',
  },
  {
    id: 'sovetnik',
    name: 'Советник',
    image: sovetnik,
    mockup: true,
    shots: [
      { src: sovetnikShot1, caption: 'Консультант на сайте' },
      { src: sovetnikShot2, caption: 'Набор из каталога' },
    ],
    tags: ['ИИ', 'E-commerce'],
    task: 'Магазин косметики (3 000 средств). Клиенты не знают, какое средство выбрать: разные типы кожи, назначения, бренды. Служба поддержки — узкое место.',
    solution: 'На сайт встроили чат-бота с ИИ: 4 вопроса о типе кожи и проблемах → персональный набор из каталога → при сложных вопросах переводит на живого консультанта. Бот обучен только на данных магазина.',
    result: 'Конверсия +18%, средняя покупка +12%, нагрузка на поддержку −40% (они теперь консультируют только сложные случаи).',
  },
];
