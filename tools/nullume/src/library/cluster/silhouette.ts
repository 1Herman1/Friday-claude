import { euclid2 } from "../embed/math.js";

interface PickKResult {
  k: number;
  scores: Map<number, number>;
}

/**
 * Детерминированный PRNG (Mulberry32)
 */
function mulberry32(a: number): () => number {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Вычислить средний силуэт для данной кластеризации
 * При N > 2000 вычисляем на выборке 2000 точек для скорости
 */
export function silhouette(vectors: Float32Array[], labels: Int32Array): number {
  if (vectors.length === 0) return 0;
  if (vectors.length !== labels.length) {
    throw new Error("Vector and label count mismatch");
  }

  const n = vectors.length;
  let sampleSize = n;
  let indices = Array.from({ length: n }, (_, i) => i);

  // Если много точек, выборка
  if (n > 2000) {
    sampleSize = 2000;
    const rng = mulberry32(42);
    indices.sort(() => rng() - 0.5);
    indices = indices.slice(0, sampleSize);
  }

  let totalScore = 0;

  for (const i of indices) {
    const label = labels[i];

    // Расстояние до других точек в своём кластере
    let intraSum = 0;
    let intraCount = 0;
    for (let j = 0; j < n; j++) {
      if (i !== j && labels[j] === label) {
        intraSum += Math.sqrt(euclid2(vectors[i], vectors[j]));
        intraCount++;
      }
    }
    const a = intraCount > 0 ? intraSum / intraCount : 0;

    // Минимальное среднее расстояние до других кластеров
    const clusterDists = new Map<number, { sum: number; count: number }>();
    for (let j = 0; j < n; j++) {
      if (i !== j && labels[j] !== label) {
        const dist = Math.sqrt(euclid2(vectors[i], vectors[j]));
        const key = labels[j];
        if (!clusterDists.has(key)) {
          clusterDists.set(key, { sum: 0, count: 0 });
        }
        const entry = clusterDists.get(key)!;
        entry.sum += dist;
        entry.count++;
      }
    }

    let b = Infinity;
    for (const { sum, count } of clusterDists.values()) {
      b = Math.min(b, sum / count);
    }
    if (!isFinite(b)) b = 0;

    const s = Math.max(a, b) > 0 ? (b - a) / Math.max(a, b) : 0;
    totalScore += s;
  }

  return totalScore / sampleSize;
}

/**
 * Найти оптимальное количество кластеров
 * Возвращает K с наивысшим силуэтом и все scores
 */
export function pickK(
  vectors: Float32Array[],
  opts?: { kMin?: number; kMax?: number; seed?: number }
): PickKResult {
  const kMin = opts?.kMin || 3;
  const kMax = opts?.kMax || 12;
  const seed = opts?.seed || 42;

  if (vectors.length === 0) throw new Error("Empty vectors");
  if (kMin <= 0 || kMax < kMin) throw new Error("Invalid k range");
  if (kMin > vectors.length) throw new Error("kMin cannot be greater than vector count");

  const rng = mulberry32(seed);
  const scores = new Map<number, number>();
  let bestK = kMin;
  let bestScore = -Infinity;

  for (let k = kMin; k <= kMax; k++) {
    if (k > vectors.length) break;

    // Быстрый K-means для оценки
    const n = vectors.length;
    const dim = vectors[0].length;
    const labels = new Int32Array(n);

    // Инициализация случайно
    const centroids: Float32Array[] = [];
    for (let i = 0; i < k; i++) {
      centroids.push(new Float32Array(vectors[Math.floor(rng() * n)]));
    }

    // 10 итераций K-means
    for (let iter = 0; iter < 10; iter++) {
      for (let i = 0; i < n; i++) {
        let minDist = Infinity;
        let bestCluster = 0;
        for (let c = 0; c < k; c++) {
          const dist = euclid2(vectors[i], centroids[c]);
          if (dist < minDist) {
            minDist = dist;
            bestCluster = c;
          }
        }
        labels[i] = bestCluster;
      }

      // Обновляем центроиды
      const newCentroids: Float32Array[] = [];
      const counts = new Int32Array(k);

      for (let c = 0; c < k; c++) {
        const centroid = new Float32Array(dim);
        for (let i = 0; i < n; i++) {
          if (labels[i] === c) {
            counts[c]++;
            for (let d = 0; d < dim; d++) {
              centroid[d] += vectors[i][d];
            }
          }
        }

        if (counts[c] > 0) {
          for (let d = 0; d < dim; d++) {
            centroid[d] /= counts[c];
          }
          newCentroids.push(centroid);
        } else {
          newCentroids.push(new Float32Array(vectors[Math.floor(rng() * n)]));
        }
      }

      centroids.length = 0;
      centroids.push(...newCentroids);
    }

    // Вычисляем силуэт
    const score = silhouette(vectors, labels);
    scores.set(k, score);

    if (score > bestScore) {
      bestScore = score;
      bestK = k;
    }
  }

  return { k: bestK, scores };
}
