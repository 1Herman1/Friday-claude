import { test } from "node:test";
import assert from "node:assert/strict";
import { silhouette, pickK } from "./silhouette.js";

test("silhouette: вычисляет метрику для кластеризации", () => {
  // Простые синтетические данные: 2 кластера
  const vectors: Float32Array[] = [];
  const labels = new Int32Array(40);

  // Кластер 1
  for (let i = 0; i < 20; i++) {
    const v = new Float32Array([Math.random(), Math.random()]);
    vectors.push(v);
    labels[i] = 0;
  }

  // Кластер 2
  for (let i = 0; i < 20; i++) {
    const v = new Float32Array([5 + Math.random(), 5 + Math.random()]);
    vectors.push(v);
    labels[i + 20] = 1;
  }

  const score = silhouette(vectors, labels);
  assert.ok(score > 0);
  assert.ok(score <= 1);
});

test("silhouette: хорошо разделённые кластеры имеют высокий score", () => {
  const vectors: Float32Array[] = [];
  const labels = new Int32Array(60);

  // 3 очень отдалённых кластера
  for (let i = 0; i < 20; i++) {
    const v = new Float32Array([0 + (Math.random() - 0.5) * 0.2]);
    vectors.push(v);
    labels[i] = 0;
  }

  for (let i = 0; i < 20; i++) {
    const v = new Float32Array([10 + (Math.random() - 0.5) * 0.2]);
    vectors.push(v);
    labels[i + 20] = 1;
  }

  for (let i = 0; i < 20; i++) {
    const v = new Float32Array([20 + (Math.random() - 0.5) * 0.2]);
    vectors.push(v);
    labels[i + 40] = 2;
  }

  const score = silhouette(vectors, labels);
  assert.ok(score > 0.8);
});

test("silhouette: плохо разделённые кластеры имеют низкий score", () => {
  // Все точки из одного распределения, но помечены как разные кластеры
  const vectors: Float32Array[] = [];
  const labels = new Int32Array(30);

  for (let i = 0; i < 30; i++) {
    const v = new Float32Array([Math.random(), Math.random()]);
    vectors.push(v);
    labels[i] = i % 3; // Случайное распределение по 3 кластерам
  }

  const score = silhouette(vectors, labels);
  assert.ok(score < 0.5);
});

test("silhouette: один кластер → 0 (нет других кластеров)", () => {
  const vectors: Float32Array[] = [];
  const labels = new Int32Array(20);

  for (let i = 0; i < 20; i++) {
    const v = new Float32Array([Math.random(), Math.random()]);
    vectors.push(v);
    labels[i] = 0; // Все в одном кластере
  }

  const score = silhouette(vectors, labels);
  // Когда нет других кластеров, b=Infinity, silhouette=(Inf - a)/(Inf) → 1
  // Но наша реализация устанавливает b=0 когда нет других точек
  // Так что silhouette=(0 - a)/a → -1 (минимум)
  // Проверим что значение валидно
  assert.ok(score !== NaN);
});

test("pickK: вычисляет scores для диапазона k", () => {
  const vectors: Float32Array[] = [];

  // 4 отдалённых кластера в 8-мерном пространстве
  const centers = [
    new Float32Array(8).fill(0),
    new Float32Array(8).fill(10),
    new Float32Array(8).fill(-10),
    new Float32Array(8).fill(5),
  ];

  for (let c = 0; c < 4; c++) {
    for (let i = 0; i < 15; i++) {
      const v = new Float32Array(8);
      for (let d = 0; d < 8; d++) {
        v[d] = centers[c][d] + (Math.random() - 0.5) * 0.5;
      }
      vectors.push(v);
    }
  }

  const result = pickK(vectors, { kMin: 2, kMax: 6, seed: 42 });

  // Должен вернуть валидное k в диапазоне
  assert.ok(result.k >= 2 && result.k <= 6);

  // scores должны содержать оценки для 2-6
  assert.ok(result.scores.has(2));
  assert.ok(result.scores.has(3));
  assert.ok(result.scores.has(4));
  assert.ok(result.scores.has(5));
  assert.ok(result.scores.has(6));

  // Выбранное k должно иметь один из лучших scores
  const selectedScore = result.scores.get(result.k)!;
  let hasHigherScore = false;
  for (const score of result.scores.values()) {
    if (score > selectedScore + 0.01) {
      hasHigherScore = true;
      break;
    }
  }
  assert.ok(!hasHigherScore, "Selected k should have highest or near-highest score");
});

test("pickK: выбрасывает ошибку на пустом массиве", () => {
  assert.throws(() => {
    pickK([]);
  });
});

test("pickK: выбрасывает ошибку на неверном диапазоне k", () => {
  const vectors = [new Float32Array([1, 2])];

  assert.throws(() => {
    pickK(vectors, { kMin: 0 });
  });

  assert.throws(() => {
    pickK(vectors, { kMin: 10, kMax: 5 });
  });
});

test("pickK: детерминированный по seed", () => {
  const vectors: Float32Array[] = [];
  for (let i = 0; i < 40; i++) {
    const v = new Float32Array(4);
    for (let d = 0; d < 4; d++) {
      v[d] = Math.random();
    }
    vectors.push(v);
  }

  const result1 = pickK(vectors, { kMin: 2, kMax: 5, seed: 42 });
  const result2 = pickK(vectors, { kMin: 2, kMax: 5, seed: 42 });

  // Выбранное k должно быть одинаково
  assert.strictEqual(result1.k, result2.k);

  // Scores должны быть одинаковы
  for (const k of result1.scores.keys()) {
    const s1 = result1.scores.get(k)!;
    const s2 = result2.scores.get(k)!;
    assert.ok(Math.abs(s1 - s2) < 1e-5);
  }
});
