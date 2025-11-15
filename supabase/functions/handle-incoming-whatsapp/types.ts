import type { PlaytomicLinkData } from "./playtomic.ts"

/**
 * Extracted data from Twilio webhook form data
 */
export interface TwilioWebhookData {
  messageId: string
  from: string
  body: string
  timestamp: Date
  accountSid: string
}

/**
 * Validated and processed webhook data passed to business logic
 */
export interface ValidatedWebhookData {
  twilioData: TwilioWebhookData
  playtomicData: PlaytomicLinkData
  respond: (message: string) => Response
}
