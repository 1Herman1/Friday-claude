export function maskSensitiveUrl(url: string): string {
  return url
    .replace(/\/api\/v1\/review\/[^/?]+/g, '/api/v1/review/[скрыто]')
    .replace(/\/api\/v1\/delivery\/cdek\/webhook\/[^/?]+/g, '/api/v1/delivery/cdek/webhook/[скрыто]')
}
