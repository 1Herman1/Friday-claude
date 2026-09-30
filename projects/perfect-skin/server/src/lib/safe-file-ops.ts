import { resolve } from 'path'

/**
 * Безопасное удаление файла: проверяет, что путь находится в разрешённом каталоге.
 * Защита от directory traversal атак.
 *
 * @param filename - имя файла без пути (например, "uuid.jpg")
 * @param allowedDir - разрешённый каталог (например, "/var/www/uploads/products")
 * @returns true если файл безопасен и находится в разрешённом каталоге, false иначе
 */
export function isFileSafeToDelete(filename: string, allowedDir: string): boolean {
  if (!filename || !allowedDir) {
    return false
  }

  // Защита от directory traversal: не допускаем / или ..
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return false
  }

  // Строим полный путь и проверяем, что он внутри разрешённого каталога
  const filepath = resolve(allowedDir, filename)
  const allowedPath = resolve(allowedDir)

  // Путь должен начинаться с разрешённого каталога
  return filepath.startsWith(allowedPath + '/') || filepath.startsWith(allowedPath + '\\') || filepath === allowedPath
}
