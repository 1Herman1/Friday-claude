import { useState, useRef, useEffect } from 'react'
import { validateTaxId } from '@ps/shared'
import { useAuth } from '@/context/AuthContext'
import { fetchApi, ApiError } from '@/lib/api'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 МБ
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

interface ProApplicationFormProps {
  onSuccess?: () => void
}

export function ProApplicationForm({ onSuccess }: ProApplicationFormProps) {
  const { user } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [formData, setFormData] = useState({
    companyName: user?.companyName || '',
    inn: user?.inn || '',
    ogrnip: '',
    specialization: user?.specialization || '',
    comment: '',
    consentPd: false,
    consentMarketing: false,
  })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [fileError, setFileError] = useState('')
  const isRejected = user?.proStatus === 'rejected'

  // Очистка object URL при размонтировании или смене файла
  useEffect(() => {
    return () => {
      if (filePreviewUrl && filePreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(filePreviewUrl)
      }
    }
  }, [filePreviewUrl])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      setFormData((prev) => ({
        ...prev,
        [name]: (e.target as HTMLInputElement).checked,
      }))
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }))
    }
  }

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'Файл больше 10 МБ'
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return 'Нужен JPG, PNG или PDF'
    }
    return null
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError('')
    const file = e.target.files?.[0]
    if (!file) {
      setSelectedFile(null)
      setFilePreviewUrl(null)
      return
    }

    const validationError = validateFile(file)
    if (validationError) {
      setFileError(validationError)
      setSelectedFile(null)
      setFilePreviewUrl(null)
      e.target.value = ''
      return
    }

    setSelectedFile(file)

    // Создаём превью
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file)
      setFilePreviewUrl(url)
    } else {
      // PDF: показываем только имя и размер
      setFilePreviewUrl(`pdf:${file.name}:${(file.size / 1024).toFixed(1)}`)
    }
  }

  const handleRemoveFile = () => {
    if (filePreviewUrl && filePreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(filePreviewUrl)
    }
    setSelectedFile(null)
    setFilePreviewUrl(null)
    setFileError('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccessMessage('')
    setFileError('')

    if (!formData.companyName.trim()) {
      setError('Укажите название компании')
      return
    }

    const taxIdValidation = validateTaxId(formData.inn)
    if (!taxIdValidation.ok) {
      setError(taxIdValidation.reason || 'ИНН, ОГРН или ОГРНИП с ошибкой в цифрах — проверьте реквизит')
      return
    }

    if (!formData.specialization.trim()) {
      setError('Укажите специализацию')
      return
    }

    if (!selectedFile) {
      setFileError('Загрузите документ')
      return
    }

    if (!formData.consentPd) {
      setError('Примите условия обработки персональных данных')
      return
    }

    setSubmitting(true)
    try {
      const formDataToSend = new FormData()
      formDataToSend.append('companyName', formData.companyName)
      formDataToSend.append('inn', formData.inn.replace(/\D/g, ''))
      if (formData.ogrnip.trim()) {
        formDataToSend.append('ogrnip', formData.ogrnip.replace(/\D/g, ''))
      }
      formDataToSend.append('specialization', formData.specialization)
      if (formData.comment.trim()) {
        formDataToSend.append('comment', formData.comment)
      }
      formDataToSend.append('consentPd', 'true')
      formDataToSend.append('consentMarketing', formData.consentMarketing ? 'true' : 'false')
      formDataToSend.append('document', selectedFile)

      await fetchApi<void>('/api/v1/pro/apply', {
        method: 'POST',
        body: formDataToSend,
      })

      setSuccessMessage('Заявка отправлена. Проверим данные и откроем оптовые цены — придёт письмо на вашу почту.')
      onSuccess?.()
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'PRO_ALREADY_REQUESTED') {
          setError('Вы уже подали заявку на рассмотрение')
        } else if (err.code === 'PRO_ALREADY_APPROVED') {
          setError('Ваш статус уже одобрен')
        } else if (err.code === 'UNSUPPORTED_FILE') {
          setFileError(err.message)
        } else if (err.code === 'FILE_TOO_LARGE') {
          setFileError('Файл больше 10 МБ')
        } else if (err.code === 'VALIDATION_ERROR') {
          setError(err.message || 'Проверьте введённые данные')
        } else {
          setError(err.message || 'Ошибка при отправке заявки')
        }
      } else {
        setError('Ошибка при отправке заявки')
      }
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {isRejected && (
        <div className="bg-destructive/10 border border-destructive/30 rounded-block p-6 mb-8">
          <h3 className="text-body font-semibold text-destructive mb-2">Заявка отклонена</h3>
          <p className="text-body-sm text-foreground mb-4">
            {user?.proRejectReason || 'Заявка не соответствует критериям'}
          </p>
          <p className="text-body-sm text-muted-foreground">
            Вы можете подать новую заявку, исправив указанные замечания.
          </p>
        </div>
      )}

      <div className="mb-6 p-4 bg-muted rounded-block">
        <p className="text-sm text-muted-foreground">
          Проверяем по открытым реестрам ФНС и вручную.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-destructive/10 border border-destructive/30 rounded-block p-4">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {successMessage && (
          <div className="bg-success/10 border border-success/30 rounded-block p-4">
            <p className="text-sm text-success">{successMessage}</p>
          </div>
        )}

        <div>
          <label htmlFor="companyName" className="block text-sm font-semibold text-foreground mb-2">
            Салон / ИП / организация <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            id="companyName"
            name="companyName"
            value={formData.companyName}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground text-base"
            placeholder="Название вашего учреждения"
            required
          />
        </div>

        <div>
          <label htmlFor="inn" className="block text-sm font-semibold text-foreground mb-2">
            ИНН, ОГРН или ОГРНИП <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            id="inn"
            name="inn"
            value={formData.inn}
            onChange={handleChange}
            inputMode="numeric"
            maxLength={15}
            className="w-full px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground text-base font-mono"
            placeholder="ИНН (10–12 цифр), ОГРН (13 цифр) или ОГРНИП (15 цифр)"
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Используется для верификации. Данные не передаются третьим лицам.
          </p>
        </div>

        <div>
          <label htmlFor="ogrnip" className="block text-sm font-semibold text-foreground mb-2">
            ОГРНИП (для ИП)
          </label>
          <input
            type="text"
            id="ogrnip"
            name="ogrnip"
            value={formData.ogrnip}
            onChange={handleChange}
            inputMode="numeric"
            maxLength={15}
            className="w-full px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground text-base font-mono"
            placeholder="15 цифр"
          />
        </div>

        <div>
          <label htmlFor="specialization" className="block text-sm font-semibold text-foreground mb-2">
            Специализация <span className="text-destructive">*</span>
          </label>
          <input
            type="text"
            id="specialization"
            name="specialization"
            value={formData.specialization}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground text-base"
            placeholder="Косметолог, дерматолог, эстетолог и т.п."
            required
          />
        </div>

        <div>
          <label htmlFor="comment" className="block text-sm font-semibold text-foreground mb-2">
            Комментарий (необязательно)
          </label>
          <textarea
            id="comment"
            name="comment"
            value={formData.comment}
            onChange={handleChange}
            className="w-full px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground text-base min-h-[100px] resize-none"
            placeholder="Расскажите о вашем салоне или кабинете"
          />
        </div>

        <div>
          <label htmlFor="document" className="block text-sm font-semibold text-foreground mb-2">
            Фото или скан сертификата / диплома косметолога <span className="text-destructive">*</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            id="document"
            accept="image/jpeg,image/png,application/pdf"
            onChange={handleFileChange}
            className="w-full px-4 py-3 border border-border-strong rounded-block focus:outline-ring focus:ring-2 focus:ring-ring bg-card text-foreground text-base"
            aria-describedby="document-hint document-error"
            required
          />
          <p id="document-hint" className="text-xs text-muted-foreground mt-2">
            JPG, PNG или PDF до 10 МБ. Документ видят только сотрудники магазина; удаляем его через 30 дней после решения по заявке. Дату рождения, серию и номер документа можно закрыть.
          </p>
          {fileError && (
            <p id="document-error" className="text-sm text-destructive mt-2" role="alert">
              {fileError}
            </p>
          )}

          {/* Превью документа */}
          {selectedFile && filePreviewUrl && (
            <div className="mt-4 p-4 border border-border-strong rounded-block bg-muted">
              {filePreviewUrl.startsWith('pdf:') ? (
                // PDF превью
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 min-h-11">
                    <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center bg-destructive text-destructive-foreground rounded font-semibold text-sm">
                      PDF
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {filePreviewUrl.split(':')[1]}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {filePreviewUrl.split(':')[2]} КБ
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="flex-shrink-0 px-3 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 rounded-pill transition-colors min-h-11"
                  >
                    Заменить
                  </button>
                </div>
              ) : (
                // Картинка превью
                <div className="space-y-3">
                  <img
                    src={filePreviewUrl}
                    alt="Превью документа"
                    className="max-w-full max-h-64 object-contain rounded"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveFile}
                    className="w-full px-3 py-2 text-sm font-semibold text-destructive hover:bg-destructive/10 rounded-pill transition-colors min-h-11"
                  >
                    Заменить файл
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <label className="flex items-start gap-3 cursor-pointer min-h-11">
            <input
              type="checkbox"
              name="consentPd"
              checked={formData.consentPd}
              onChange={handleChange}
              className="mt-1 w-5 h-5 rounded border-border-strong focus:ring-2 focus:ring-ring cursor-pointer flex-shrink-0"
              required
            />
            <span className="text-sm text-muted-foreground">
              Согласен на обработку персональных данных для проверки статуса специалиста{' '}
              <a href="/privacy" target="_blank" rel="noopener" className="text-primary font-semibold hover:underline">
                Политика обработки данных
              </a>
            </span>
          </label>

          <label className="flex items-start gap-3 cursor-pointer min-h-11">
            <input
              type="checkbox"
              name="consentMarketing"
              checked={formData.consentMarketing}
              onChange={handleChange}
              className="mt-1 w-5 h-5 rounded border-border-strong focus:ring-2 focus:ring-ring cursor-pointer flex-shrink-0"
            />
            <span className="text-sm text-muted-foreground">
              Хочу получать новости и предложения для специалистов
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full px-6 py-4 bg-primary text-primary-foreground font-semibold rounded-pill hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity min-h-11"
        >
          {submitting ? 'Отправляю...' : 'Отправить заявку'}
        </button>
      </form>
    </>
  )
}
