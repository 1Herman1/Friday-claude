import { Link } from 'react-router-dom'

const UPDATED_AT = '25 августа 2026 года'

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8" id={id}>
      <h2 className="text-base font-sans font-semibold uppercase tracking-wide text-foreground mb-3">
        {title}
      </h2>
      <div className="space-y-3 text-foreground leading-relaxed">{children}</div>
    </section>
  )
}

export function OfferPage() {
  return (
    <div className="container-app py-12 md:py-16">
      <div className="max-w-prose mx-auto">
        <h1 className="text-h3 md:text-h2 font-heading font-bold uppercase tracking-tight text-foreground mb-6">
          Публичная оферта
        </h1>
        <p className="text-muted-foreground leading-relaxed mb-6">
          Редакция от {UPDATED_AT}. Это предложение заключить договор розничной
          купли-продажи на условиях, описанных ниже. Оформляя заказ, вы
          принимаете его целиком.
        </p>

        {/* Table of Contents */}
        <nav className="bg-muted rounded-block p-4 mb-8 border border-border">
          <p className="text-xs font-semibold text-foreground mb-3">Разделы:</p>
          <ul className="space-y-2 text-sm">
            <li><a href="#section-1" className="text-primary hover:underline">1. Стороны договора</a></li>
            <li><a href="#section-2" className="text-primary hover:underline">2. Как заключается договор</a></li>
            <li><a href="#section-3" className="text-primary hover:underline">3. Товар, цена и оплата</a></li>
            <li><a href="#section-4" className="text-primary hover:underline">4. Доставка</a></li>
            <li><a href="#section-5" className="text-primary hover:underline">5. Отказ от товара, обмен и возврат</a></li>
            <li><a href="#section-6" className="text-primary hover:underline">6. Ответственность</a></li>
            <li><a href="#section-7" className="text-primary hover:underline">7. Персональные данные</a></li>
            <li><a href="#section-8" className="text-primary hover:underline">8. Контакты и споры</a></li>
          </ul>
        </nav>

        <Section id="section-1" title="1. Стороны договора">
          <p>
            Продавец — индивидуальный предприниматель Рыбко Анна Александровна,
            ОГРНИП 321508100460474. Покупатель — любое дееспособное лицо,
            оформившее заказ на сайте perfect-skin.shop. Договор заключается в
            порядке статьи 437 Гражданского кодекса РФ и регулируется Законом
            РФ «О защите прав потребителей» и Правилами продажи товаров по
            договору розничной купли-продажи.
          </p>
        </Section>

        <Section id="section-2" title="2. Как заключается договор">
          <p>
            Договор считается заключённым с момента оформления заказа на сайте:
            покупатель добавляет товары в корзину, указывает способ доставки и
            данные получателя и подтверждает заказ. Заказу присваивается номер
            вида PS-000000, он отображается на сайте в разделе «Мои заказы».
          </p>
          <p>
            Продавец вправе отказать в исполнении заказа при отсутствии товара,
            уведомив покупателя и вернув оплату в полном объёме.
          </p>
        </Section>

        <Section id="section-3" title="3. Товар, цена и оплата">
          <p>
            К продаже предлагается косметическая продукция брендов ISSEIMI и
            GLACÉE Skincare производства фармконцерна Heber Farma (Испания).
            Описания, составы и способы применения указаны на страницах
            товаров.
          </p>
          <p>
            Цены указаны в рублях и включают НДС, если он применим. Цена
            фиксируется в момент оформления заказа. Оплата производится
            онлайн — банковской картой или через Систему быстрых платежей
            (СБП).
          </p>
        </Section>

        <Section id="section-4" title="4. Доставка">
          <p>Доступные способы получения заказа:</p>
          <ul className="list-disc pl-5 space-y-2">
            <li>
              самовывоз — Москва, Звенигородское шоссе, 3Ас1 — бесплатно;
            </li>
            <li>
              СДЭК, пункт выдачи или постамат — бесплатно при сумме заказа от
              6 000 ₽, иначе 200 ₽;
            </li>
            <li>
              СДЭК, курьером до двери — бесплатно при сумме заказа от
              10 000 ₽, иначе 200 ₽.
            </li>
          </ul>
          <p>
            Стоимость доставки рассчитывается на странице оформления заказа и
            входит в итоговую сумму. Сроки доставки зависят от региона и
            сообщаются службой СДЭК при передаче заказа.
          </p>
        </Section>

        <Section id="section-5" title="5. Отказ от товара, обмен и возврат">
          <p>
            Парфюмерно-косметические товары надлежащего качества обмену и
            возврату не подлежат (Постановление Правительства РФ №55 от
            19.01.1998).
          </p>
          <p>
            Покупатель вправе отказаться от заказа до его получения. В этом
            случае оплата возвращается в течение 5 рабочих дней тем же
            способом, которым была произведена.
          </p>
          <p>
            При получении товара ненадлежащего качества покупатель вправе
            требовать замены или возврата денежных средств в порядке,
            установленном Законом РФ «О защите прав потребителей». Обращения —
            по контактам из раздела 8.
          </p>
        </Section>

        <Section id="section-6" title="6. Ответственность">
          <p>
            Продавец отвечает за соответствие товара описанию и его
            надлежащее качество. Косметическая продукция не является
            лекарственным средством; при наличии кожных заболеваний или
            индивидуальной непереносимости компонентов рекомендуем
            проконсультироваться со специалистом до покупки.
          </p>
        </Section>

        <Section id="section-7" title="7. Персональные данные">
          <p>
            Оформляя заказ, покупатель даёт согласие на обработку персональных
            данных (имя, телефон, email, адрес доставки) в объёме, необходимом
            для исполнения договора: оформления, доставки и информирования о
            статусе заказа. Данные не передаются третьим лицам, кроме службы
            доставки и платёжного провайдера в части, необходимой для
            исполнения заказа.
          </p>
        </Section>

        <Section id="section-8" title="8. Контакты и споры">
          <p>
            Телефон:{' '}
            <a href="tel:+74951832848" className="underline underline-offset-2 hover:text-primary transition-colors">
              +7 (495) 183-28-48
            </a>{' '}
            (Пн–Пт 10–21, Сб 11–17). Email:{' '}
            <a href="mailto:mail@perfect-skin.shop" className="underline underline-offset-2 hover:text-primary transition-colors">
              mail@perfect-skin.shop
            </a>
            . Адрес: Москва, Звенигородское шоссе, 3Ас1.
          </p>
          <p>
            Претензии рассматриваются в течение 10 дней с момента получения.
            Споры, не урегулированные переговорами, разрешаются в порядке,
            установленном законодательством РФ. Продавец вправе изменять
            условия оферты; к заказу применяется редакция, действовавшая на
            момент его оформления.
          </p>
        </Section>

        <div className="border-t border-border pt-6 text-sm text-muted-foreground">
          <p>
            Вопросы по условиям — на странице{' '}
            <Link to="/contacts" className="underline underline-offset-2 hover:text-primary transition-colors">
              «Контакты»
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
