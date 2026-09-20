/**
 * Email sender interface and implementations.
 * In development: prints code to console.
 * In production: sends via nodemailer (SMTP).
 */
import nodemailer from 'nodemailer'
import { isDevelopment } from '../../lib/env.js'
import { maskEmail } from '../../lib/masks.js'

export interface MailSender {
  send(recipient: string, code: string): Promise<void>
  sendPlain(recipient: string, subject: string, text: string): Promise<void>
}

// Development mail sender: prints to console for inspection
// Logs are intentional for dev debugging and do not reach production
export class DevMailSender implements MailSender {
  async send(recipient: string, code: string): Promise<void> {
    const addr = maskEmail(recipient)
    console.log(`[EMAIL] Sent to ${addr}: code sent (${code.length} chars)`)
  }

  async sendPlain(recipient: string, subject: string, text: string): Promise<void> {
    console.log(`[MAIL] Message sent successfully`)
  }
}

export class ProductionMailSender implements MailSender {
  async send(recipient: string, code: string): Promise<void> {
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
      to: recipient,
      subject: 'Код входа Perfect Skin',
      text: `Ваш код: ${code}. Действует 10 минут.`,
    })
  }

  async sendPlain(recipient: string, subject: string, text: string): Promise<void> {
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
      to: recipient,
      subject,
      text,
    })
  }
}

export function createMailSender(): MailSender {
  if (isDevelopment) {
    return new DevMailSender()
  }
  return new ProductionMailSender()
}
