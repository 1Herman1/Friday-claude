# F1 — parent verification перед независимым ревью

Coordinator: Джарвис. Base `e9e31fd5b80f48729a87823409c966f9c2b36d42`.

## Текущее состояние

Проверен самостоятельный candidate: четыре принятых без изменений handoff-файла, новый publication regression и минимальные HEAD-based config/пять MD/TOML routes. Чужие dirty версии этих11routing файлов не копировались и не перезаписывались. Proposal не означает native IDE reload или выполненную генерацию.

После F1b родитель обнаружил остаточную несогласованность selector metadata: legacy description обещала «через Artlist», тогда как developer-body уже условно направляет native Codex/Nullume. Добавлен отдельный regression. Первоначальный working probe прошёл (рабочий foreign baseline уже содержит исправленную description), и НЕ засчитан как RED. Настоящий RED воспроизведён на clean F1b proposal:7tests,1failure именно на legacy selector. Затем изменены только description media-generator в proposed config и corresponding TOML. Остальные non-developer TOML fields сохранены; metadata-description — явное обоснованное исключение из исходного blanket preservation. Изображения/видео/музыка/озвучка, budget/rights/owner gates не удалены; доступность backend не заявлена без проверки.

## Свежие parent checks текущей revision

|Проверка|Результат|
|---|---|
|Exact clean candidate Python|79tests PASS|
|Working Python|86tests PASS|
|Clean Node lint/library/isolation|57PASS,0fail/skip|
|Clean selftest|exit0, прежний feature.md source-freshness WARNING|
|Clean role sync|Drift:none|

Выводы привязаны к final candidate в `/Users/germanbryzgalov/.hermes/cache/scratch/design-followup-_9uk291c/final/`: proposal.json/review-map.json и five actual command-result JSON. Historical F1/F1b reports сохраняют собственные counts/revisions, не заменяют эти финальные проверки.

Сохранённая последовательность: HEAD+guard RED → четыре зависимости/guard GREEN → полный clean routing RED →11scoped routes GREEN → selector metadata RED → минимальный metadata fix → current full regression GREEN. Следующий gate — независимое review этой frozen revision, затем точная own-only publication/read-back. F2 пока не начат.
