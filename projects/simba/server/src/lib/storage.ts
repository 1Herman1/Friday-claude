import { createHash } from 'crypto'
import { Readable } from 'stream'
import { Client } from 'minio'

let storageClient: Client | null = null
/** Когда последняя попытка подключиться провалилась. Через RETRY_AFTER_MS
    пробуем снова: раньше ошибка запоминалась навсегда, и если MinIO не успел
    подняться к первому запросу, загрузка картинок оставалась сломанной до
    перезапуска сервера — без единой записи о причине. */
let lastInitFailureAt: number | null = null
const RETRY_AFTER_MS = 30_000

/**
 * Инициализирует MinIO клиент при первом использовании.
 * Если переменные окружения не заданы, оставляет storageClient === null —
 * чтобы сервер мог стартовать без настроенного MinIO на локальной машине.
 */
export async function initStorage(): Promise<void> {
  if (storageClient !== null) return
  if (lastInitFailureAt !== null && Date.now() - lastInitFailureAt < RETRY_AFTER_MS) return

  const endpoint = process.env.MINIO_ENDPOINT
  const port = process.env.MINIO_PORT
  const accessKey = process.env.MINIO_ACCESS_KEY
  const secretKey = process.env.MINIO_SECRET_KEY

  // Если не все переменные заданы, молчим и продолжаем с null
  if (!endpoint || !port || !accessKey || !secretKey) {
    return
  }

  try {
    const client = new Client({
      endPoint: endpoint,
      port: Number(port),
      accessKey,
      secretKey,
      useSSL: false,
    })

    const bucket = process.env.MINIO_BUCKET || 'simba-products'

    // Создаём бакет, если его нет
    const exists = await client.bucketExists(bucket)
    if (!exists) {
      await client.makeBucket(bucket, 'us-east-1')
      console.log(`Created MinIO bucket: ${bucket}`)
    }

    storageClient = client
    lastInitFailureAt = null
  } catch (err) {
    lastInitFailureAt = Date.now()
    const message = err instanceof Error ? err.message : String(err)
    console.error('MinIO init failed (uploads will fail, retry in 30s):', message)
  }
}

/**
 * Сохраняет файл в MinIO. Имя файла базируется на SHA256 хеше содержимого
 * (чтобы одинаковые файлы не дублировались), с сохранением расширения.
 */
export async function saveFile(
  buffer: Buffer,
  mimeType: string,
): Promise<string> {
  await initStorage()

  if (!storageClient) {
    throw new Error('MinIO not configured')
  }

  const ext = mimeType.startsWith('image/') ? extFromMime(mimeType) : 'bin'
  const hash = createHash('sha256').update(buffer).digest('hex')
  const key = `${hash}.${ext}`
  const bucket = process.env.MINIO_BUCKET || 'simba-products'

  try {
    await storageClient.putObject(bucket, key, buffer, buffer.length, { 'Content-Type': mimeType })
  } catch (err) {
    throw new Error(`Failed to upload file to MinIO: ${err instanceof Error ? err.message : String(err)}`)
  }

  return key
}

/**
 * Получает файл из MinIO потоком.
 */
export async function getFileStream(key: string): Promise<Readable> {
  await initStorage()

  if (!storageClient) {
    throw new Error('MinIO not configured')
  }

  const bucket = process.env.MINIO_BUCKET || 'simba-products'

  try {
    const stream = await storageClient.getObject(bucket, key)
    return stream as Readable
  } catch (err) {
    throw new Error(
      `Failed to get file from MinIO: ${err instanceof Error ? err.message : String(err)}`,
    )
  }
}

/**
 * Проверяет, существует ли файл в MinIO.
 */
export async function fileExists(key: string): Promise<boolean> {
  await initStorage()

  if (!storageClient) {
    return false
  }

  const bucket = process.env.MINIO_BUCKET || 'simba-products'

  try {
    await storageClient.statObject(bucket, key)
    return true
  } catch {
    return false
  }
}

/**
 * Расширение файла из MIME-типа.
 */
function extFromMime(mimeType: string): string {
  const mimes: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  return mimes[mimeType] || 'bin'
}
