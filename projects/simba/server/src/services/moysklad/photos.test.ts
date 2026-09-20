import { describe, it, expect, vi, afterEach } from 'vitest'
import { mimeFromFilename, fullSizeHref, downloadImage } from './photos'

describe('Фотографии из МоегоСклада', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    delete process.env.MOYSKLAD_TOKEN
  })

  it('берёт полноразмерный файл, а не миниатюру', () => {
    const image = {
      miniature: { downloadHref: 'https://ms/mini.jpg' },
      meta: { downloadHref: 'https://ms/full.jpg' },
    }
    expect(fullSizeHref(image)).toBe('https://ms/full.jpg')
  })

  it('без ссылки на полный размер картинку не берёт вовсе', () => {
    expect(fullSizeHref({ miniature: { downloadHref: 'https://ms/mini.jpg' } })).toBeNull()
  })

  it('определяет тип файла по имени', () => {
    expect(mimeFromFilename('IMG_0421.JPG')).toBe('image/jpeg')
    expect(mimeFromFilename('photo.webp')).toBe('image/webp')
    expect(mimeFromFilename('IMG_0421')).toBeNull()
    expect(mimeFromFilename('scan.pdf')).toBeNull()
  })

  it('подставляет токен в запрос за файлом', async () => {
    process.env.MOYSKLAD_TOKEN = 'test-token'
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } })
    )
    vi.stubGlobal('fetch', fetchMock)

    const file = await downloadImage('https://ms/full.png')

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token')
    expect(file?.mimetype).toBe('image/png')
  })

  it('octet-stream не считает типом картинки — берёт его из имени файла', async () => {
    process.env.MOYSKLAD_TOKEN = 'test-token'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
      new Response(new Uint8Array([1]), { headers: { 'content-type': 'application/octet-stream' } })
    ))

    expect((await downloadImage('https://ms/f', 'cat.jpeg'))?.mimetype).toBe('image/jpeg')
    expect(await downloadImage('https://ms/f', 'cat')).toBeNull()
  })

  it('файл, который МойСклад не отдал, пропускается, а не рушит перенос', async () => {
    process.env.MOYSKLAD_TOKEN = 'test-token'
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 404 })))
    expect(await downloadImage('https://ms/gone.jpg')).toBeNull()
  })

  it('без токена не делает запрос вовсе', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(downloadImage('https://ms/f.jpg')).rejects.toThrow('MOYSKLAD_TOKEN')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
