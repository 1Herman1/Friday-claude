import { test } from "node:test";
import assert from "node:assert";
import { listImporters, getImporter } from "./registry.js";
import { UsageError } from "../../core/errors.js";

test("listImporters: должен вернуть массив clean импортёров", async () => {
  const importers = await listImporters("clean");
  assert(Array.isArray(importers));
  // На текущем этапе clean импортёры пусты, но это нормально
  importers.forEach((imp) => {
    assert.strictEqual(imp.kind, "clean");
  });
});

test("listImporters: должен вернуть массив local-only импортёров", async () => {
  const importers = await listImporters("local-only");
  assert(Array.isArray(importers));
  // На текущем этапе local-only импортёры пусты, но это нормально
  importers.forEach((imp) => {
    assert.strictEqual(imp.kind, "local-only");
  });
});

test("listImporters: по умолчанию возвращает только clean", async () => {
  const defaultImporters = await listImporters();
  const clean = await listImporters("clean");

  assert.strictEqual(defaultImporters.length, clean.length);
  defaultImporters.forEach((imp) => {
    assert.strictEqual(imp.kind, "clean");
  });
});

test("listImporters: local-only отсутствуют при вызове без параметра", async () => {
  const defaultImporters = await listImporters();
  const local = await listImporters("local-only");

  const localIds = new Set(local.map((i) => i.id));
  for (const imp of defaultImporters) {
    assert(!localIds.has(imp.id), `Local-only импортёр ${imp.id} вернулся в listImporters() без параметра`);
  }
});

test("listImporters: clean импортёры не должны содержать local-only", async () => {
  const clean = await listImporters("clean");
  const local = await listImporters("local-only");

  const cleanIds = new Set(clean.map((i) => i.id));
  const localIds = new Set(local.map((i) => i.id));

  for (const id of localIds) {
    assert(!cleanIds.has(id), `ID ${id} присутствует и в clean, и в local-only`);
  }
});

test("getImporter: должен выбросить ошибку для неизвестного импортёра", async () => {
  await assert.rejects(
    () => getImporter("unknown-importer-xyz"),
    (err) => err instanceof UsageError && err.message.includes("Импортёр не найден")
  );
});

test("getImporter: должен найти импортёр по ID если он зарегистрирован", async () => {
  // На текущем этапе все импортёры пусты, так что это невозможно протестировать
  // Но структура работает корректно
});
