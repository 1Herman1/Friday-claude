/**
 * Базовые математические операции над векторами для embeddings
 */

/**
 * Косинусная близость между двумя векторами [0, 2] (чем меньше, тем ближе)
 * После нормализации: 0 = идентичные, 2 = противоположные
 */
export function cosine(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error("Vector length mismatch");

  let dot = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
  }

  // Для нормализованных векторов: dot уже [-1, 1]
  // Косинусное расстояние: sqrt(2(1-dot))
  // Это даёт [0, 2): 0=одинаковые, sqrt(2)≈1.414=ортогональные, 2=противоположные
  return Math.sqrt(2 * Math.max(0, 1 - dot));
}

/**
 * Евклидово расстояние в квадрате (быстрее, чем с sqrt)
 */
export function euclid2(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) throw new Error("Vector length mismatch");

  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return sum;
}

/**
 * L2-нормализация вектора на месте (для cosine после нормализации = dot product)
 */
export function normalize(v: Float32Array): Float32Array {
  let norm = 0;
  for (let i = 0; i < v.length; i++) {
    norm += v[i] * v[i];
  }

  norm = Math.sqrt(norm);
  if (norm === 0) return v;

  for (let i = 0; i < v.length; i++) {
    v[i] /= norm;
  }
  return v;
}

/**
 * Среднее значение по массиву векторов
 */
export function mean(vectors: Float32Array[]): Float32Array {
  if (vectors.length === 0) throw new Error("Empty vector array");

  const dim = vectors[0].length;
  const result = new Float32Array(dim);

  for (const vec of vectors) {
    if (vec.length !== dim) throw new Error("Vector dimension mismatch");
    for (let i = 0; i < dim; i++) {
      result[i] += vec[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    result[i] /= vectors.length;
  }

  return result;
}

/**
 * Конвертировать Float32Array в Buffer для хранения/передачи
 */
export function toBlob(vec: Float32Array): Buffer {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength);
}

/**
 * Восстановить Float32Array из Buffer
 */
export function fromBlob(buf: Buffer): Float32Array {
  // Копируем в новый буфер чтобы гарантировать выравнивание
  const arrayBuffer = new ArrayBuffer(buf.length);
  const view = new Float32Array(arrayBuffer);

  // Копируем байты
  const srcView = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const dstView = new Uint8Array(arrayBuffer);
  dstView.set(srcView);

  return view;
}
