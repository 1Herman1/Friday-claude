import { Link } from 'react-router-dom'

// Черновик студии — формулировки подтверждает владелец магазина.
const UPDATED_AT = '20 сентября 2026 года'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-h3 font-heading font-bold text-foreground mb-4">{title}</h2>
      <div className="space-y-3 text-foreground leading-body max-w-prose">{children}</div>
    </section>
  )
}

export default function PrivacyPage() {
  return (
    <div className="container-app py-12 md:py-16">
      <div className="max-w-3xl">
        <div className="bg-muted rounded-block p-4 md:p-6 mb-8">
          <p className="text-foreground font-semibold">
            Проект документа. Требует утверждения владельцем магазина.
          </p>
        </div>

        <h1 className="text-h2 font-heading font-bold text-foreground mb-4">
          Политика обработки персональных данных
        </h1>
        <p className="text-body font-sans leading-body text-foreground mb-8">
          Редакция от {UPDATED_AT}. Документ объясняет, какие данные о вас собирает
          интернет-магазин Perfect Skin, зачем они нужны и что вы можете с ними сделать.
        </p>

        <div className="bg-card rounded-block border border-border-strong p-6 space-y-3 mb-10">
          <p className="font-semibold text-foreground">Коротко о главном</p>
          <p className="text-body font-sans leading-body text-foreground">
            Мы собираем только то, что нужно для входа в аккаунт и доставки заказа:
            имя, email, телефон, адрес. Для специалистов дополнительно просим название
            салона и специализацию. Не передаём данные рекламным сетям. Чтобы получить
            копию своих данных или удалить аккаунт, напишите нам — ответим в срок,
            установленный законом.
          </p>
        </div>

        <Section title="1. Кто обрабатывает данные">
          <p>
            Ответственный за организацию обработки — ИП Рыбко Анна Александровна
            (ОГРНИП 321508100460474). По вопросам персональных данных пишите на{' '}
            <a
              href="mailto:mail@perfect-skin.shop"
              className="text-primary underline underline-offset-2 hover:opacity-80"
            >
              mail@perfect-skin.shop
            </a>{' '}
            с темой «Персональные данные» — ответим в течение 10 рабочих дней.
          </p>
        </Section>

        <Section title="2. Какие данные мы собираем">
          <p>
            <strong className="font-semibold text-foreground">При входе:</strong> email,
            на который мы отправляем одноразовый код. Пароль не требуется.
          </p>
          <p>
            <strong className="font-semibold text-foreground">В профиле:</strong> имя,
            телефон, адреса доставки.
          </p>
          <p>
            <strong className="font-semibold text-foreground">При оформлении заказа:</strong>{' '}
            имя, email, телефон, адрес доставки. Реквизиты карты вводятся на стороне
            платёжного провайдера — мы их не получаем.
          </p>
          <p>
            <strong className="font-semibold text-foreground">Для специалистов:</strong> дополнительно
            просим ИНН или ОГРНИП, название салона и основные направления работы
            (косметология, дерматология и т.д.).
          </p>
          <p>
            <strong className="font-semibold text-foreground">Автоматически:</strong> IP
            и браузер — записываются в журнал сервера и в запись о согласии для защиты
            от подбора кодов.
          </p>
        </Section>

        <Section title="3. Цели обработки">
          <p>
            Вход в аккаунт, оформление и доставка заказа, начисление льгот для
            специалистов, ответ на ваше обращение, бухгалтерский учёт.
          </p>
          <p>
            Основание обработки — ваше согласие отдельной галочкой и договор
            купли-продажи (публичная оферта). Рекламных рассылок мы не ведём;
            если начнём — только после отдельного согласия.
          </p>
        </Section>

        <Section title="4. Передача данных третьим лицам">
          <ul className="space-y-3 text-foreground">
            <li>
              <strong className="font-semibold">СДЭК</strong> — доставляет посылку;
              видит имя, телефон и адрес.
            </li>
            <li>
              <strong className="font-semibold">Платёжный провайдер</strong> — обрабатывает
              платёж; видит имя и email.
            </li>
            <li>
              Государственным органам данные передаются только по официальному запросу
              в случаях, предусмотренных законом 152-ФЗ.
            </li>
          </ul>
        </Section>

        <Section title="5. Сроки хранения">
          <ul className="space-y-3 text-foreground">
            <li>
              <strong className="font-semibold">Аккаунт</strong> — пока существует.
            </li>
            <li>
              <strong className="font-semibold">Заказы</strong> — 5 лет с даты заказа;
              после удаления аккаунта обезличены.
            </li>
            <li>
              <strong className="font-semibold">Коды входа</strong> — 10 минут;
              хранится хеш.
            </li>
            <li>
              <strong className="font-semibold">Согласия</strong> — записи о согласии
              и его отзыве хранятся 3 года после отзыва.
            </li>
          </ul>
        </Section>

        <Section title="6. Как удалить аккаунт и отозвать согласие">
          <p>
            Чтобы отозвать согласие, получить копию своих данных или удалить
            аккаунт, напишите нам — отдельной кнопки в личном кабинете пока нет.
          </p>
          <p>
            Письмо отправьте на{' '}
            <a
              href="mailto:mail@perfect-skin.shop"
              className="text-primary underline underline-offset-2 hover:opacity-80"
            >
              mail@perfect-skin.shop
            </a>{' '}
            с темой «Отзыв согласия». Ответим в течение 30 дней — срок установлен
            статьёй 20 Федерального закона № 152-ФЗ. Сведения о заказах закон
            обязывает хранить и после удаления аккаунта, поэтому они останутся
            в обезличенном виде — без имени, телефона и адреса. Если ответ вас не устроит, вы
            вправе обратиться в Роскомнадзор.
          </p>
        </Section>

        <Section title="7. Cookie и локальное хранилище браузера">
          <p>
            Cookie не ставим. В localStorage браузера хранятся только технические ключи:
            токен входа, идентификаторы сессий. Личных данных там нет. Очистить их можно
            в настройках браузера — тогда вы выйдете из аккаунта. Счётчиков посещаемости
            и аналитики нет.
          </p>
        </Section>

        <Section title="8. Защита">
          <p>
            Сервер и база в России. Доступ к данным заказов — только у оператора;
            коды входа — хеш на 10 минут; пароли не нужны. Защита канала связи
            обеспечивается протоколом HTTPS.
          </p>
        </Section>

        <Section title="9. Изменения политики">
          <p>
            Новая редакция публикуется на этой странице с датой обновления вверху.
            Если меняется состав данных или цели обработки, мы попросим согласие заново —
            при следующем входе или заказе.
          </p>
        </Section>

        <p className="mt-10 pt-6 border-t border-border text-body-sm font-sans text-foreground">
          ИП Рыбко Анна Александровна · ОГРНИП 321508100460474
        </p>

        <div className="mt-8">
          <Link
            to="/offer"
            className="text-primary underline underline-offset-2 hover:opacity-80"
          >
            ← К публичной оферте
          </Link>
        </div>
      </div>
    </div>
  )
}
