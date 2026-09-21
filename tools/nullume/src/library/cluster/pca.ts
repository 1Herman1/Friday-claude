/**
 * PCA проекция методом power iteration с дефляцией
 */

interface PCAModel {
  project(v: Float32Array): Float32Array;
  projected: Float32Array[];
}

/**
 * PCA анализ: центрирование → power iteration → дефляция
 * Возвращает объект с методом project и спроецированными векторами
 */
export function pca(vectors: Float32Array[], dims: number = 50): PCAModel {
  if (vectors.length === 0) throw new Error("Empty vectors");
  if (dims <= 0) throw new Error("dims must be positive");

  const n = vectors.length;
  const origDim = vectors[0].length;
  dims = Math.min(dims, origDim);

  // Центрируем векторы
  const mean = computeMean(vectors);
  const centered = vectors.map((v) => subtract(v, mean));

  // Power iteration для поиска главных компонент
  const components: Float32Array[] = [];
  let workingData = centered.map((v) => new Float32Array(v));

  for (let i = 0; i < dims; i++) {
    // Power iteration
    let v = randomVector(origDim);
    for (let iter = 0; iter < 10; iter++) {
      const av = new Float32Array(origDim);
      for (const x of workingData) {
        const dot = dotProduct(x, v);
        for (let d = 0; d < origDim; d++) {
          av[d] += dot * x[d];
        }
      }
      for (let d = 0; d < origDim; d++) {
        av[d] /= workingData.length;
      }

      const norm = norm2(av);
      if (norm < 1e-10) break;
      for (let d = 0; d < origDim; d++) {
        v[d] = av[d] / norm;
      }
    }

    components.push(new Float32Array(v));

    // Дефляция: вычитаем проекцию на найденный компонент
    for (let j = 0; j < workingData.length; j++) {
      const proj = dotProduct(workingData[j], v);
      for (let d = 0; d < origDim; d++) {
        workingData[j][d] -= proj * v[d];
      }
    }
  }

  // Спроецируем исходные векторы на найденные компоненты
  const projected = centered.map((v) => {
    const result = new Float32Array(dims);
    for (let i = 0; i < dims; i++) {
      result[i] = dotProduct(v, components[i]);
    }
    return result;
  });

  return {
    project(v: Float32Array): Float32Array {
      const centered = subtract(v, mean);
      const result = new Float32Array(dims);
      for (let i = 0; i < dims; i++) {
        result[i] = dotProduct(centered, components[i]);
      }
      return result;
    },
    projected,
  };
}

function computeMean(vectors: Float32Array[]): Float32Array {
  const dim = vectors[0].length;
  const mean = new Float32Array(dim);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      mean[i] += v[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    mean[i] /= vectors.length;
  }
  return mean;
}

function subtract(a: Float32Array, b: Float32Array): Float32Array {
  const result = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    result[i] = a[i] - b[i];
  }
  return result;
}

function dotProduct(a: Float32Array, b: Float32Array): number {
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result += a[i] * b[i];
  }
  return result;
}

function norm2(v: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

function randomVector(dim: number): Float32Array {
  const v = new Float32Array(dim);
  for (let i = 0; i < dim; i++) {
    v[i] = Math.random() - 0.5;
  }
  const n = norm2(v);
  for (let i = 0; i < dim; i++) {
    v[i] /= n;
  }
  return v;
}
