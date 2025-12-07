/**
 * Twilio WhatsApp messaging utility
 *
 * Sends templated WhatsApp messages via Twilio SDK.
 * Uses environment variables for credentials:
 * - TWILIO_ACCOUNT_SID
 * - TWILIO_AUTH_TOKEN
 * - TWILIO_WHATSAPP_FROM (WhatsApp sender number, e.g., whatsapp:+14155238886)
 */

import Twilio from 'twilio'

// Template SID for booker notification
const BOOKER_NOTIFICATION_TEMPLATE_SID = 'HX1e8b8d2770a4bdba14ae846e6ad87b2b'

interface SendBookerNotificationParams {
  toPhone: string // Phone number in E.164 format (e.g., +34612345678)
  venueName: string
  matchTime: string // Formatted time string (e.g., "Friday, Nov 29 at 18:00")
}

/**
 * Creates a Twilio client instance
 */
function getTwilioClient() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  if (!accountSid || !authToken) {
    return null
  }

  return Twilio(accountSid, authToken)
}

/**
 * Sends a WhatsApp message to a booker notifying them of their booking responsibility
 *
 * @param params - The notification parameters
 * @returns Promise resolving to success status and message SID if successful
 */
export async function sendBookerNotification(
  params: SendBookerNotificationParams,
): Promise<{ success: boolean; messageSid?: string; error?: string }> {
  const client = getTwilioClient()
  const fromNumber = process.env.TWILIO_WHATSAPP_FROM

  if (!client || !fromNumber) {
    console.error('Missing Twilio credentials:', {
      hasClient: !!client,
      hasFromNumber: !!fromNumber,
    })
    return {
      success: false,
      error: 'Twilio credentials not configured',
    }
  }

  // Format the recipient phone number for WhatsApp
  const toWhatsApp = `whatsapp:${params.toPhone}`

  try {
    const message = await client.messages.create({
      to: toWhatsApp,
      from: fromNumber,
      contentSid: BOOKER_NOTIFICATION_TEMPLATE_SID,
      contentVariables: JSON.stringify({
        1: params.venueName,
        2: params.matchTime,
      }),
    })

    console.log('WhatsApp message sent successfully:', message.sid)
    return {
      success: true,
      messageSid: message.sid,
    }
  } catch (error) {
    console.error('Error sending WhatsApp message:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * Sends booker notifications to multiple players
 *
 * @param notifications - Array of notification params to send
 * @returns Promise resolving to array of results
 */
export async function sendBookerNotifications(
  notifications: SendBookerNotificationParams[],
): Promise<Array<{ toPhone: string; success: boolean; error?: string }>> {
  const results = await Promise.all(
    notifications.map(async (notification) => {
      const result = await sendBookerNotification(notification)
      return {
        toPhone: notification.toPhone,
        success: result.success,
        error: result.error,
      }
    }),
  )

  return results
}
