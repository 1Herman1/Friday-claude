import { test } from "node:test";
import assert from "node:assert/strict";
import { pca } from "./pca.js";

test("pca: проектирует в меньшее число измерений", () => {
  // Создаём векторы с доминантной осью
  const vectors: Float32Array[] = [];
  for (let i = 0; i < 30; i++) {
    const v = new Float32Array(10);
    // Первое измерение содержит основную вариацию
    v[0] = Math.random() * 10;
    // Остальные — шум
    for (let d = 1; d < 10; d++) {
      v[d] = (Math.random() - 0.5) * 0.5;
    }
    vectors.push(v);
  }

  const model = pca(vectors, 3);

  // Проверяем что projected содержит 30 векторов размерности 3
  assert.strictEqual(model.projected.length, 30);
  for (const vec of model.projected) {
    assert.strictEqual(vec.length, 3);
  }
});

test("pca: сохраняет разделение данных с одной доминантной осью", () => {
  // Две группы, разделённые по первому измерению
  const vectors: Float32Array[] = [];

  // Группа 1: v[0] > 5
  for (let i = 0; i < 15; i++) {
    const v = new Float32Array(5);
    v[0] = 7 + Math.random();
    for (let d = 1; d < 5; d++) {
      v[d] = (Math.random() - 0.5) * 0.5;
    }
    vectors.push(v);
  }

  // Группа 2: v[0] < -5
  for (let i = 0; i < 15; i++) {
    const v = new Float32Array(5);
    v[0] = -7 - Math.random();
    for (let d = 1; d < 5; d++) {
      v[d] = (Math.random() - 0.5) * 0.5;
    }
    vectors.push(v);
  }

  const model = pca(vectors, 2);

  // Первый компонент должен разделять две группы
  const projected = model.projected;

  // Группа 1 должна иметь высокие значения первого компонента
  let group1Avg = 0;
  for (let i = 0; i < 15; i++) {
    group1Avg += projected[i][0];
  }
  group1Avg /= 15;

  // Группа 2 должна иметь низкие значения первого компонента
  let group2Avg = 0;
  for (let i = 15; i < 30; i++) {
    group2Avg += projected[i][0];
  }
  group2Avg /= 15;

  // Разница должна быть значительной
  assert.ok(Math.abs(group1Avg - group2Avg) > 1);
});

test("pca: project работает для новой точки", () => {
  const vectors: Float32Array[] = [];
  for (let i = 0; i < 20; i++) {
    const v = new Float32Array(4);
    for (let d = 0; d < 4; d++) {
      v[d] = Math.random();
    }
    vectors.push(v);
  }

  const model = pca(vectors, 2);

  // Новая точка
  const newVec = new Float32Array([0.5, 0.5, 0.5, 0.5]);
  const projected = model.project(newVec);

  // Должна проецироваться в 2 измерения
  assert.strictEqual(projected.length, 2);
});

test("pca: выбрасывает ошибку на пустом массиве", () => {
  assert.throws(() => {
    pca([]);
  });
});

test("pca: выбрасывает ошибку на неверных dims", () => {
  const vectors = [new Float32Array([1, 2, 3])];

  assert.throws(() => {
    pca(vectors, 0);
  });

  assert.throws(() => {
    pca(vectors, -1);
  });
});

test("pca: ограничивает dims на размерность данных", () => {
  const vectors: Float32Array[] = [];
  for (let i = 0; i < 10; i++) {
    vectors.push(new Float32Array([Math.random(), Math.random()]));
  }

  // Запросим больше dimensions чем есть в данных
  const model = pca(vectors, 100);

  // projected должны быть размерности не больше 2
  for (const vec of model.projected) {
    assert.ok(vec.length <= 2);
  }
});
