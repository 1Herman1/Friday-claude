-- Один идущий прогон на источник — гарантией базы, а не проверкой в коде.
-- Раньше «слот» занимался в два запроса (посмотреть → создать), и два почти
-- одновременных старта (двойной клик в админке, cron впритык к ручному запуску)
-- проскакивали оба: лок не защищал именно от того случая, ради которого писался.

-- Зависшие прогоны закрываем до создания индекса: процесс мог быть прерван,
-- и такая строка иначе навсегда заблокировала бы свой источник.
UPDATE "sync_runs"
SET "status" = 'failed',
    "finishedAt" = CURRENT_TIMESTAMP,
    "error" = COALESCE("error", 'Прогон не завершился — вероятно, процесс был прерван')
WHERE "status" = 'running'
  AND "startedAt" < CURRENT_TIMESTAMP - INTERVAL '15 minutes';

-- На случай нескольких свежих running у одного источника оставляем самый новый.
UPDATE "sync_runs" s
SET "status" = 'failed',
    "finishedAt" = CURRENT_TIMESTAMP,
    "error" = COALESCE("error", 'Прогон вытеснен более новым запуском того же источника')
WHERE s."status" = 'running'
  AND EXISTS (
    SELECT 1 FROM "sync_runs" n
    WHERE n."source" = s."source"
      AND n."status" = 'running'
      AND (n."startedAt" > s."startedAt" OR (n."startedAt" = s."startedAt" AND n."id" > s."id"))
  );

CREATE UNIQUE INDEX "sync_runs_source_running_key"
  ON "sync_runs"("source")
  WHERE "status" = 'running';
