# WhatsApp Webhook Handler Design

**Date:** 2025-11-15
**Purpose:** Handle incoming Twilio WhatsApp webhooks for Playtomic match link validation and linking

## Overview

Users send WhatsApp messages containing Playtomic match links to validate and link matches. The function validates Twilio webhooks, extracts Playtomic URLs, and prepares data for business logic to validate match details (time, location) before linking.

## Webhook Validation & Security

### Two-Layer Validation

**Layer 1 - Twilio Signature Verification:**
- Validate `X-Twilio-Signature` header using HMAC-SHA1
- Prevents replay attacks and unauthorized requests
- Returns 403 Forbidden if signature invalid

**Layer 2 - Request Structure Validation:**
- Verify required fields: `From`, `Body`, `MessageSid`
- Validate phone number format (E.164)
- Check non-empty message body
- Returns 400 Bad Request if malformed

### Extracted Twilio Data

```typescript
{
  messageId: string       // MessageSid - unique identifier
  from: string           // From - sender's WhatsApp number (whatsapp:+34...)
  body: string           // Body - message text
  timestamp: Date        // DateSent
  accountSid: string     // AccountSid
}
```

## Playtomic Link Extraction

### Supported URL Patterns

1. **Full match URLs:**
   ```
   https://app.playtomic.io/matches/00039cef-9068-4d86-9140-980de97573b4?utm_...
   ```
   - Extract: UUID match ID

2. **Short URLs:**
   ```
   https://app.playtomic.io/t/dWTh34Ub
   ```
   - Extract: Short code

### Extraction Logic

```typescript
{
  url: string | null          // Full extracted URL
  matchId: string | null      // UUID from /matches/ URLs
  shortCode: string | null    // Code from /t/ short URLs
  rawMessage: string          // Original message for context
}
```

## Response Structure

### ValidatedWebhookData Interface

Business logic receives:

```typescript
interface ValidatedWebhookData {
  twilioData: {
    messageId: string
    from: string              // E.164 format
    body: string
    timestamp: Date
    accountSid: string
  }

  playtomicData: {
    url: string | null
    matchId: string | null
    shortCode: string | null
    rawMessage: string
  }

  respond: (message: string) => Response
}
```

### Response Helper

`respond()` creates TwiML response for WhatsApp:

```typescript
respond("✅ Booking validated! Your match has been linked.")
// Returns: <Response><Message>✅ Booking validated...</Message></Response>
```

## Function Architecture

### Main Handler

```typescript
Deno.serve(async (req) => {
  try {
    // 1. Validate Twilio signature
    if (!await validateTwilioSignature(req)) {
      return new Response("Forbidden", { status: 403 })
    }

    // 2. Parse form data
    const formData = await req.formData()
    const twilioData = extractTwilioData(formData)

    // 3. Validate required fields
    if (!twilioData.from || !twilioData.body) {
      return new Response("Bad Request", { status: 400 })
    }

    // 4. Extract Playtomic link
    const playtomicData = extractPlaytomicLink(twilioData.body)

    // 5. Prepare validated data
    const validatedData = {
      twilioData,
      playtomicData,
      respond: (msg: string) => createTwiMLResponse(msg),
    }

    // 6. Business logic handles validation & linking
    return await handleBusinessLogic(validatedData)

  } catch (error) {
    console.error("Webhook error:", error)
    return new Response("Internal Server Error", { status: 500 })
  }
})
```

### Business Logic Handler (Stub)

```typescript
async function handleBusinessLogic(data: ValidatedWebhookData): Promise<Response> {
  const { playtomicData, respond } = data

  // No link found
  if (!playtomicData.matchId && !playtomicData.shortCode) {
    return respond("❌ No Playtomic match link found. Please send a valid match URL.")
  }

  // TODO: Implement
  // 1. Resolve short URL if needed
  // 2. Fetch Playtomic match details via API
  // 3. Find matching match in database (by time + location)
  // 4. Validate match details
  // 5. Link match to Playtomic booking

  return respond("✅ Match validated and linked!")
}
```

## Helper Functions

### validation.ts - Signature Verification

```typescript
export async function validateTwilioSignature(req: Request): Promise<boolean> {
  const signature = req.headers.get("X-Twilio-Signature")
  if (!signature) return false

  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")
  if (!authToken) throw new Error("TWILIO_AUTH_TOKEN not set")

  const url = req.url
  const formData = await req.formData()

  // Build sorted params string
  const params = Array.from(formData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}${value}`)
    .join("")

  // Compute HMAC-SHA1
  const data = url + params
  const encoder = new TextEncoder()
  const keyData = encoder.encode(authToken)
  const messageData = encoder.encode(data)

  const key = await crypto.subtle.importKey(
    "raw", keyData,
    { name: "HMAC", hash: "SHA-1" },
    false, ["sign"]
  )

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData)
  const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  return computedSignature === signature
}
```

### playtomic.ts - Link Extraction

```typescript
export function extractPlaytomicLink(message: string): {
  url: string | null
  matchId: string | null
  shortCode: string | null
  rawMessage: string
} {
  // Pattern 1: Full match URLs
  const matchPattern = /https?:\/\/(?:www\.)?app\.playtomic\.io\/matches\/([a-f0-9-]{36})/i
  const matchResult = message.match(matchPattern)

  if (matchResult) {
    return {
      url: matchResult[0].split('?')[0],
      matchId: matchResult[1],
      shortCode: null,
      rawMessage: message,
    }
  }

  // Pattern 2: Short URLs
  const shortPattern = /https?:\/\/(?:www\.)?app\.playtomic\.io\/t\/([a-zA-Z0-9_-]+)/i
  const shortResult = message.match(shortPattern)

  if (shortResult) {
    return {
      url: shortResult[0],
      matchId: null,
      shortCode: shortResult[1],
      rawMessage: message,
    }
  }

  return {
    url: null,
    matchId: null,
    shortCode: null,
    rawMessage: message,
  }
}
```

### response.ts - TwiML Builder

```typescript
export function createTwiMLResponse(message: string): Response {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapeXml(message)}</Message>
</Response>`

  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
    status: 200,
  })
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
```

## Environment Variables

- `TWILIO_AUTH_TOKEN` - Required for webhook signature validation

## Implementation Checklist

- [ ] Implement Twilio signature validation
- [ ] Extract and validate webhook data
- [ ] Extract Playtomic links (both URL formats)
- [ ] Create TwiML response helper
- [ ] Implement business logic for match validation
- [ ] Handle short URL resolution (if needed)
- [ ] Fetch Playtomic match details
- [ ] Match against database records
- [ ] Link validated matches
- [ ] Add error handling and logging
- [ ] Test with real Twilio webhooks

## Success Criteria

- ✅ Twilio webhooks are validated securely
- ✅ Both Playtomic URL formats are extracted correctly
- ✅ Clean separation between validation and business logic
- ✅ Business logic receives all necessary data
- ✅ WhatsApp responses are sent based on validation results
- ✅ Invalid requests are rejected with appropriate status codes
