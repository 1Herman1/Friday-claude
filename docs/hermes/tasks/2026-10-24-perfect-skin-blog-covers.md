# Задание Hermes: обложки для трёх статей блога Perfect Skin

Дата: 24.10.2026 · Проект: Perfect Skin · Исполнитель: Hermes (Mac, Nullume)

> **Отменено 25.10.** Обложки генерирует облачная сессия Claude через workflow
> `perfect-skin-bestsellers-media.yml` (stage `blog-covers`). Hermes — только референсы.

## Срочно (25.10)
Статьи уже опубликованы и висят без обложек. Гермес ждёт обложки сейчас.

Ориентир по виду — твои референсы из `docs/projects/perfect-skin/design-system/references/home-sections.md`:
- **1.5 «Radiant Skin»** (`b06b0bbe`): товар на камне в тон фона, кадр 3:2, левая треть пустая;
- **1.2 Serena's** (`8f13e81d`): тёплый светлый фон, много воздуха.

Тёмную заливку из 1.1 не брать.

## Почему ты
Из облака сервис генерации kie.ai недоступен: сетевая политика среды блокирует адрес.
Генерация — у тебя, через Nullume. Остальное делает облачная сессия: проверка brand-guard, сжатие и подключение к статьям.

## Что сделать
Три обложки, формат 3:2, не меньше 1600 px по ширине. Сохранить PNG в
`docs/projects/perfect-skin/media/blog/<slug>.png` и закоммитить.

Опорные фото товаров (официальные, с isseimi.es и glacee.es) лежат в
`docs/projects/perfect-skin/media/blog/refs/`. При желании дополни их фото с официальных
страниц товаров. Модель — с опорой на изображения, чтобы упаковка совпала с настоящей
(nano-banana-edit или nano-banana-pro). Кит — `docs/projects/perfect-skin/brand.md` и
`design-system/MASTER.md`: тёплый камень #F4F2EC, аптечная точность, спокойный свет,
много воздуха. Слева оставь треть кадра пустой: на главной туда ложится плашка с заголовком.

| slug | Статья | Что в кадре | Опорные фото |
|---|---|---|---|
| `hvatit-kormit-kozhu-kollagenom` | «Хватит кормить кожу коллагеном…» (EGF) | ISSEIMI COLLAGEN BOOSTER: флакон-пипетка и коробка, капли сыворотки на камне | `refs/collagen-booster-vosstanavlivayushhaya-syvorotka.jpg` |
| `pochemu-kozha-ne-zadyhaetsya` | «Почему кожа не „задыхается“…» | ISSEIMI SCRUBLOTION, ISSEIMI KERATHOR 50 PLUS, GLACÉE Cleansing Balm на каменных подставках, за ними лёгкая парящая шифоновая ткань («воздух») | `refs/scrub-lotion-…jpg`, `refs/kerathor-plus-…jpg`, `refs/cleansing-balm-…jpg` |
| `yabloko-kotoroe-ne-stareet` | «Яблоко, которое не стареет…» (полифенолы) | Целое яблоко и яблоко в разрезе, рядом стеклянная чашка Петри с каплями золотистой сыворотки. Упаковок и надписей нет: статья не называет товаров | — |

Готовые промпты (английский, можно править):

1. COLLAGEN BOOSTER — «Editorial still-life photograph for a pharmacy-grade skincare journal cover. Use the exact ISSEIMI COLLAGEN BOOSTER frosted glass dropper bottle with gold collar and its white-and-mint box from the reference; keep packaging shape, colors, logo and label text exactly, do not invent or change any text. Bottle slightly right of center, box leaning behind it, on warm stone travertine #F4F2EC, matching background. Soft diffused morning daylight from the left, gentle long shadow, a few glossy serum droplets on the stone. Calm, precise, premium, airy, empty left third. No people, no hands, no extra products, no watermark. Photorealistic.»
2. Три средства — «Editorial still-life photograph for a skincare journal cover about the myth of skin breathing. Use the exact three products from the references: ISSEIMI SCRUBLOTION (white, blue band, silver cap), ISSEIMI KERATHOR 50 PLUS (white, violet band, silver cap), GLACÉE Cleansing Balm white pump bottle. Keep shapes, colors, logos and label text exactly, do not invent text. Calm group on low warm stone travertine blocks #F4F2EC, matching background; sheer translucent white chiffon floating behind as if moved by a light breeze. Soft natural daylight. Premium, minimal, airy, empty left third. No people, no extra products, no watermark. Photorealistic.»
3. Яблоко — «Editorial still-life photograph for a pharmacy-grade skincare journal cover about apple polyphenols. One fresh green-golden apple and one apple cut in half showing clean flesh and seeds, on warm stone travertine #F4F2EC, matching background; a small clear glass petri dish with a few drops of translucent golden serum beside it. Soft morning daylight from the left, fine water droplets on the skin of the apple. Calm, precise, premium, airy, empty left third. No packaging, no labels, no text, no people, no watermark. Photorealistic.»

## Проверь до коммита
- Надписи на упаковках совпадают с опорными фото: без выдуманных букв и чужих логотипов.
- Нет оранжевого и холодного синего фона: только тёплый камень.
- Цена генерации — в коммит-сообщении.

## После
Облачная сессия:
- прогонит brand-guard;
- сделает webp 1600/800;
- пропишет `coverImage` в `projects/perfect-skin/server/assets/posts/<slug>.md`;
- обновит статьи на сайте.
