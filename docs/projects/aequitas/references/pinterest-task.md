# Задание для сессии на Mac: референсы Aequitas из Pinterest

Pinterest работает только с Mac владельца (ADR-007: адрес дата-центра Pinterest
считает ботом). Облачная сессия это задание выполнить не может — его выполняет
сессия Claude Code на Mac (`cd ~/Friday-claude && claude remote-control`) или
Hermes.

## Подготовка (один раз)

```
cd ~/Friday-claude && git pull
export NULLUME_LOCAL_IMPORTERS=1
nullume lib session set pinterest-cookies --cookie "_pinterest_sess=ЗНАЧЕНИЕ"   # если сессия устарела
```

## Сбор

Запросы — по-английски (CLIP и поиск Pinterest лучше понимают английский).

```
for q in \
  "law firm website design" \
  "legal website editorial typography" \
  "scales of justice minimal graphic" \
  "balance equilibrium abstract art" \
  "classical marble sculpture minimal website" \
  "lawyer brand identity serif" \
  "premium consulting website dark" \
  "justice themis modern illustration"; do
  nullume lib import pinterest-cookies --query "$q" --limit 30
done
```

Дальше — `taste-curator`: кластеризация (`nullume lib clusters`), семейства с
тегом `aequitas`, по каждому семейству дескриптор (палитра, типографика,
настроение). Результат — в `docs/projects/aequitas/references/moodboard.md`
со списком семейств и 5–8 лучшими пинами на каждое, коммит и пуш в рабочую
ветку. Дашборд для просмотра: `nullume lib dashboard --open`.
