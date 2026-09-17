import { Link } from 'react-router-dom'
import { useMetaTags } from '../hooks/useMetaTags'
import { CONSENT_VERSION } from '@simba/shared'
import { CONTACTS, LEGAL } from '../lib/contacts'

// Черновик студии — формулировки подтверждает юрист владельца.

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-xl font-bold text-navy-900 mb-3">{title}</h2>
      <div className="space-y-3 text-navy-700 leading-relaxed max-w-prose">{children}</div>
    </section>
  )
}

export default function ConsentPage() {
  useMetaTags({
    title: 'Согласие на обработку персональных данных — Симба',
    description: 'Согласие на обработку персональных данных покупателей в зоомагазине Симба.',
  })

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 md:py-14">
      <h1 className="text-[32px] md:text-[40px] leading-tight font-bold text-navy-900 mb-3">
        Согласие на обработку персональных данных
      </h1>
      <p className="text-navy-500 leading-relaxed mb-8">
        Редакция {CONSENT_VERSION}. Этот текст вы подтверждаете галочкой при входе и при
        оформлении заказа. Дата, версия и адрес, с которого дано согласие, сохраняются у
        оператора.
      </p>

      <Section title="1. Кому даётся согласие">
        <p>
          {LEGAL.entity}. По вопросам персональных данных — на{' '}
          <a
            href={CONTACTS.emailHref}
            className="text-primary-hover underline underline-offset-2 hover:opacity-80"
          >
            {CONTACTS.email}
          </a>
          .
        </p>
      </Section>

      <Section title="2. Какие данные обрабатываются">
        <p>
          Фамилия, имя и отчество как указаны при регистрации; адрес электронной почты;
          номер телефона; адрес доставки или адрес пункта выдачи; комментарий к заказу;
          данные питомца; информация о заказах и бонусах; IP-адрес и браузер.
        </p>
      </Section>

      <Section title="3. Цели обработки">
        <ul className="space-y-2 list-disc list-inside text-navy-500 leading-relaxed">
          <li>Вход в аккаунт</li>
          <li>Оформление заказа</li>
          <li>Доставка</li>
          <li>Начисление и учёт бонусов</li>
          <li>Напоминание о подписке</li>
          <li>Ответ на обращение</li>
          <li>Бухгалтерский учёт</li>
        </ul>
      </Section>

      <Section title="4. Способ обработки">
        <p>
          Сбор, запись, систематизация, хранение, уточнение, использование, передача
          сторонним организациям (закрытие доставки: СДЭК, Яндекс.Доставка, курьеры),
          обезличивание, удаление. Сервер в России.
        </p>
        <p>
          Рекламные рассылки этим согласием не охватываются.
        </p>
      </Section>

      <Section title="5. Срок обработки">
        <p>
          Согласие действует до исполнения целей или до его отзыва. По категориям данных —
          сроки в{' '}
          <Link to="/privacy" className="text-primary-hover underline underline-offset-2 hover:opacity-80">
            политике конфиденциальности
          </Link>
          .
        </p>
      </Section>

      <Section title="6. Как отозвать согласие">
        <p>
          Удалить аккаунт — в профиле, раздел «Настройки» → «Мои данные»: кнопка
          «Удалить аккаунт». Удаление мгновенно и необратимо.
        </p>
        <p>
          Если нет доступа к аккаунту — напишите на{' '}
          <a
            href={CONTACTS.emailHref}
            className="text-primary-hover underline underline-offset-2 hover:opacity-80"
          >
            {CONTACTS.email}
          </a>{' '}
          с темой «Отзыв согласия»: ответим в течение 10 рабочих дней. После отзыва ваши
          заказы остаются в обезличенном виде.
        </p>
      </Section>

      <Section title="7. История версий">
        <p>
          Новая редакция опубликована на этой странице с указанием даты и версии. Ваше
          согласие привязано к версии на момент его дачи и сохраняется вечно.
        </p>
      </Section>

      <p className="mt-8 pt-6 border-t border-line text-sm text-navy-500">
        <Link to="/privacy" className="text-primary-hover underline underline-offset-2 hover:opacity-80">
          Полная политика конфиденциальности
        </Link>
      </p>
    </div>
  )
}
