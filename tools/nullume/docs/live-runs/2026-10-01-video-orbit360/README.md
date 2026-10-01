# Видео: эффект Orbit 360 — Higgsfield против Nullume (grok-imagine)

Дата: 2026-10-01. Цель: проверить, воспроизводится ли эффект Higgsfield текстовым ТЗ
на наших моделях.

| | Higgsfield «Orbit 360» (превью пресета) | Nullume, grok-imagine/image-to-video |
|---|---|---|
| Исходник | фото человека | `a1.jpg` (Афиша: банка на травертине) |
| Длина | 9 с, 24 fps | 6 с, 24 fps |
| Формат | 600×1066 (9:16) | 1280×704 (16:9), 720p |
| Движение камеры | полный круг 360° | дуга ≈ 90–120° |
| Объект | заморожен, узнаваем | заморожен, узнаваем, форма и материал целы |
| Параллакс фона | сильный | есть, умеренный |
| Склейки/артефакты | нет | нет |
| Цена | пресет Higgsfield | оценка 4,5 кр; по балансу −27 (см. ниже) |

ТЗ (промпт): «Smooth continuous 360-degree camera orbit around the white glass cream jar.
The camera circles the jar at a slightly low angle at constant speed; the jar stays
perfectly still and centered, frozen in place, sharp in focus the whole time. The stone
surface and the window behind show strong parallax as the camera travels around. One
unbroken move, no cuts, no zoom, no shake, cinematic morning light.»

Вывод: характер эффекта (облёт замершего объекта, параллакс, без склеек) передан;
полный оборот — нет: за 6 секунд grok делает дугу, а не круг. Это ограничение модели и
длины, а не формулировки. Для полного 360° — модель с длительностью ≥ 9–10 с
(kling 2.6 / seedance) или склейка двух дуг.

Баланс до 8619, после 8592 (−27) при оценке 4,5 — расхождение не объяснено этой
генерацией; за ночь баланс снизился с 9951 до 8619 вне этой сессии. Разбор — в status.md.
