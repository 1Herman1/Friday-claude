import { euclid2 } from "../embed/math.js";

interface KMeansResult {
  labels: Int32Array;
  centroids: Float32Array[];
  inertia: number;
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
 * K-means++ инициализация с детерминированным seed
 * Возвращает индексы начальных центроидов
 */
function kmeanspp(
  vectors: Float32Array[],
  k: number,
  seed: number
): number[] {
  if (vectors.length === 0) throw new Error("Empty vectors");
  if (k <= 0 || k > vectors.length) throw new Error("Invalid k");

  const rng = mulberry32(seed);
  const n = vectors.length;
  const chosen: number[] = [];

  // Выбираем первый центроид случайно
  chosen.push(Math.floor(rng() * n));

  // D^2 взвешивание для остальных центроидов
  const minDist = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    minDist[i] = Infinity;
  }

  for (let iter = 1; iter < k; iter++) {
    // Вычисляем минимальные расстояния до уже выбранных центроидов
    const lastCentroid = chosen[chosen.length - 1];
    for (let i = 0; i < n; i++) {
      const dist = euclid2(vectors[i], vectors[lastCentroid]);
      if (dist < minDist[i]) {
        minDist[i] = dist;
      }
    }

    // Выбираем новый центроид с вероятностью D^2
    let totalDist = 0;
    for (let i = 0; i < n; i++) {
      totalDist += minDist[i];
    }

    let cumulDist = 0;
    let target = rng() * totalDist;
    for (let i = 0; i < n; i++) {
      cumulDist += minDist[i];
      if (cumulDist >= target && !chosen.includes(i)) {
        chosen.push(i);
        break;
      }
    }

    // На случай если что-то сломалось с перекрытиями
    if (chosen.length === iter) continue;

    // Если не выбрали, выбираем с максимальным расстоянием
    let maxIdx = 0;
    let maxDist = -1;
    for (let i = 0; i < n; i++) {
      if (!chosen.includes(i) && minDist[i] > maxDist) {
        maxDist = minDist[i];
        maxIdx = i;
      }
    }
    if (chosen.length < iter + 1) {
      chosen.push(maxIdx);
    }
  }

  return chosen;
}

/**
 * K-means с K-means++ инициализацией
 */
export function kmeansPP(
  vectors: Float32Array[],
  k: number,
  opts?: { iters?: number; seed?: number }
): KMeansResult {
  if (vectors.length === 0) throw new Error("Empty vectors");
  if (k <= 0) throw new Error("k must be positive");

  const maxIters = opts?.iters || 50;
  const seed = opts?.seed || 42;
  const n = vectors.length;
  const dim = vectors[0].length;
  const labels = new Int32Array(n);
  let centroids: Float32Array[] = [];

  // K-means++ инициализация
  const chosenIndices = kmeanspp(vectors, k, seed);
  for (const idx of chosenIndices) {
    centroids.push(new Float32Array(vectors[idx]));
  }

  let inertia = 0;

  for (let iter = 0; iter < maxIters; iter++) {
    // Assign points to nearest centroid
    inertia = 0;
    for (let i = 0; i < n; i++) {
      let minDist = Infinity;
      let bestCluster = 0;
      for (let c = 0; c < centroids.length; c++) {
        const dist = euclid2(vectors[i], centroids[c]);
        if (dist < minDist) {
          minDist = dist;
          bestCluster = c;
        }
      }
      labels[i] = bestCluster;
      inertia += minDist;
    }

    // Вычисляем новые центроиды
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
        // Пустой кластер: переинициализируем случайно
        newCentroids.push(new Float32Array(vectors[Math.floor(Math.random() * n)]));
      }
    }

    centroids = newCentroids;
  }

  return { labels, centroids, inertia };
}
