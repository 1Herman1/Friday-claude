/**
 * Email sender interface and implementations.
 * In development: prints code to console.
 * In production: sends via nodemailer (SMTP).
 */
import nodemailer from 'nodemailer'

export interface MailSender {
  send(email: string, code: string): Promise<void>
}

export class DevMailSender implements MailSender {
  async send(email: string, code: string): Promise<void> {
    console.log(`[EMAIL] Sent to ${email}: ${code}`)
  }
}

export class ProductionMailSender implements MailSender {
  async send(email: string, code: string): Promise<void> {
    const smtpHost = process.env.SMTP_HOST
    if (!smtpHost) {
      throw new Error(
        'SMTP configuration is not set. Set SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, SMTP_FROM in production'
      )
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })

    await transporter.sendMail({
      from: process.env.SMTP_FROM || 'noreply@perfectskin.ru',
      to: email,
      subject: 'Код входа Perfect Skin',
      text: `Ваш код: ${code}. Действует 10 минут.`,
    })
  }
}

export function createMailSender(): MailSender {
  if (process.env.NODE_ENV === 'development') {
    return new DevMailSender()
  }
  return new ProductionMailSender()
}
