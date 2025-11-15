import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { validateTwilioSignature } from "./validation.ts"
import { extractPlaytomicLink } from "./playtomic.ts"
import { createTwiMLResponse } from "./response.ts"
import type { ValidatedWebhookData, TwilioWebhookData } from "./types.ts"

console.log("WhatsApp webhook handler initialized")

Deno.serve(async (req) => {
  try {
    // 1. Validate Twilio signature
    const isValid = await validateTwilioSignature(req)
    if (!isValid) {
      console.error("Invalid Twilio signature")
      return new Response("Forbidden", { status: 403 })
    }

    // 2. Parse form data from Twilio webhook
    const formData = await req.formData()

    const twilioData: TwilioWebhookData = {
      messageId: formData.get("MessageSid") as string,
      from: formData.get("From") as string,
      body: formData.get("Body") as string,
      timestamp: new Date(formData.get("DateSent") as string || Date.now()),
      accountSid: formData.get("AccountSid") as string,
    }

    // 3. Validate required fields
    if (!twilioData.from || !twilioData.body || !twilioData.messageId) {
      console.error("Missing required fields:", twilioData)
      return new Response("Bad Request", { status: 400 })
    }

    console.log("Received message from:", twilioData.from)
    console.log("Message body:", twilioData.body)

    // 4. Extract Playtomic link
    const playtomicData = extractPlaytomicLink(twilioData.body)

    // 5. Prepare validated data for business logic
    const validatedData: ValidatedWebhookData = {
      twilioData,
      playtomicData,
      respond: (message: string) => createTwiMLResponse(message),
    }

    // 6. Handle business logic
    const response = await handleBusinessLogic(validatedData)
    return response

  } catch (error) {
    console.error("Webhook error:", error)
    return new Response("Internal Server Error", { status: 500 })
  }
})

/**
 * Business logic handler - validates and links Playtomic matches
 * TODO: Implement match validation and linking
 */
async function handleBusinessLogic(data: ValidatedWebhookData): Promise<Response> {
  const { twilioData, playtomicData, respond } = data

  // No Playtomic link found
  if (!playtomicData.matchId && !playtomicData.shortCode) {
    console.log("No Playtomic link found in message")
    return respond("❌ No Playtomic match link found. Please send a valid match URL.")
  }

  console.log("Extracted Playtomic data:", playtomicData)

  // TODO: Implement business logic
  // 1. If short URL, resolve to full URL/match ID
  // 2. Fetch Playtomic match details via API
  // 3. Extract time, location, players from response
  // 4. Find matching match in database (by time + location)
  // 5. Validate match details
  // 6. Link match to Playtomic booking in database

  return respond("✅ Match link received! Validation coming soon...")
}
