/**
 * SMS sender interface and implementations.
 * In development: prints code to console.
 * In production: delegates to configured provider.
 */

export interface SmsSender {
  send(phone: string, code: string): Promise<void>
}

export class DevSmsSender implements SmsSender {
  async send(phone: string, code: string): Promise<void> {
    console.log(`[SMS] Sent to ${phone}: ${code}`)
  }
}

export class ProductionSmsSender implements SmsSender {
  private apiKey: string
  private sender: string

  constructor(apiKey: string, sender: string) {
    this.apiKey = apiKey
    this.sender = sender
  }

  async send(phone: string, code: string): Promise<void> {
    // TODO: Implement actual SMS provider (e.g., Twillio, AWS SNS).
    // Until a provider is wired, failing loudly beats a 200 that lies:
    // the client would tell the user the code was sent when nothing was.
    throw new Error('SMS provider is not configured: cannot deliver OTP in production')
  }
}

export function createSmsSender(): SmsSender {
  if (process.env.NODE_ENV === 'development') {
    return new DevSmsSender()
  }
  return new ProductionSmsSender(
    process.env.SMS_API_KEY || '',
    process.env.SMS_SENDER || 'PSkin'
  )
}
