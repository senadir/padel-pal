# WhatsApp Webhook Handler Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement Twilio WhatsApp webhook handler that validates incoming messages, extracts Playtomic match links, and prepares data for business logic.

**Architecture:** Edge function receives Twilio webhooks via form data, validates signature using HMAC-SHA1, extracts Playtomic URLs (both `/matches/{uuid}` and `/t/{shortCode}` formats), and returns TwiML responses for WhatsApp replies.

**Tech Stack:** Deno, Supabase Edge Functions, Twilio Webhooks, Web Crypto API

---

## Task 1: Create Twilio Signature Validation Helper

**Files:**
- Create: `supabase/functions/handle-incoming-whatsapp/validation.ts`

**Step 1: Write the failing test**

Create: `supabase/functions/handle-incoming-whatsapp/validation.test.ts`

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { validateTwilioSignature } from "./validation.ts"

Deno.test("validateTwilioSignature - returns false when signature header missing", async () => {
  const req = new Request("https://example.com/webhook", {
    method: "POST",
    body: new URLSearchParams({ Body: "test" }),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  })

  const result = await validateTwilioSignature(req)
  assertEquals(result, false)
})

Deno.test("validateTwilioSignature - returns false for invalid signature", async () => {
  const formData = new URLSearchParams({
    From: "whatsapp:+34697745564",
    Body: "Test message",
    MessageSid: "SM123",
  })

  const req = new Request("https://example.com/webhook", {
    method: "POST",
    body: formData,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": "invalid-signature",
    },
  })

  const result = await validateTwilioSignature(req)
  assertEquals(result, false)
})
```

**Step 2: Run test to verify it fails**

```bash
cd supabase/functions/handle-incoming-whatsapp
deno test validation.test.ts
```

Expected: FAIL with "Module not found" or import error

**Step 3: Write minimal implementation**

Create: `supabase/functions/handle-incoming-whatsapp/validation.ts`

```typescript
/**
 * Validates Twilio webhook signature using HMAC-SHA1
 * @see https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export async function validateTwilioSignature(req: Request): Promise<boolean> {
  const signature = req.headers.get("X-Twilio-Signature")
  if (!signature) return false

  const authToken = Deno.env.get("TWILIO_AUTH_TOKEN")
  if (!authToken) {
    console.error("TWILIO_AUTH_TOKEN environment variable not set")
    return false
  }

  try {
    // Clone request to read body multiple times
    const clonedReq = req.clone()
    const formData = await clonedReq.formData()

    // Build params string in Twilio's expected format (sorted alphabetically)
    const params = Array.from(formData.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}${value}`)
      .join("")

    // Compute HMAC-SHA1: authToken + url + params
    const url = req.url
    const data = url + params

    const encoder = new TextEncoder()
    const keyData = encoder.encode(authToken)
    const messageData = encoder.encode(data)

    const key = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-1" },
      false,
      ["sign"]
    )

    const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData)
    const computedSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

    return computedSignature === signature
  } catch (error) {
    console.error("Signature validation error:", error)
    return false
  }
}
```

**Step 4: Run test to verify it passes**

```bash
TWILIO_AUTH_TOKEN=test-token deno test validation.test.ts
```

Expected: First test PASS (missing signature returns false), second test PASS (invalid signature returns false)

**Step 5: Commit**

```bash
git add supabase/functions/handle-incoming-whatsapp/validation.ts supabase/functions/handle-incoming-whatsapp/validation.test.ts
git commit -m "feat(webhook): add Twilio signature validation"
```

---

## Task 2: Create Playtomic Link Extractor

**Files:**
- Create: `supabase/functions/handle-incoming-whatsapp/playtomic.ts`

**Step 1: Write the failing test**

Create: `supabase/functions/handle-incoming-whatsapp/playtomic.test.ts`

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { extractPlaytomicLink } from "./playtomic.ts"

Deno.test("extractPlaytomicLink - extracts full match URL with UUID", () => {
  const message = "Check out this match: https://app.playtomic.io/matches/00039cef-9068-4d86-9140-980de97573b4?utm_medium=share_externally"

  const result = extractPlaytomicLink(message)

  assertEquals(result.url, "https://app.playtomic.io/matches/00039cef-9068-4d86-9140-980de97573b4")
  assertEquals(result.matchId, "00039cef-9068-4d86-9140-980de97573b4")
  assertEquals(result.shortCode, null)
  assertEquals(result.rawMessage, message)
})

Deno.test("extractPlaytomicLink - extracts short URL", () => {
  const message = "Join here: https://app.playtomic.io/t/dWTh34Ub"

  const result = extractPlaytomicLink(message)

  assertEquals(result.url, "https://app.playtomic.io/t/dWTh34Ub")
  assertEquals(result.matchId, null)
  assertEquals(result.shortCode, "dWTh34Ub")
  assertEquals(result.rawMessage, message)
})

Deno.test("extractPlaytomicLink - returns null when no URL found", () => {
  const message = "Just a regular message"

  const result = extractPlaytomicLink(message)

  assertEquals(result.url, null)
  assertEquals(result.matchId, null)
  assertEquals(result.shortCode, null)
  assertEquals(result.rawMessage, message)
})

Deno.test("extractPlaytomicLink - handles mixed case URLs", () => {
  const message = "HTTPS://APP.PLAYTOMIC.IO/matches/00039cef-9068-4d86-9140-980de97573b4"

  const result = extractPlaytomicLink(message)

  assertEquals(result.matchId, "00039cef-9068-4d86-9140-980de97573b4")
})
```

**Step 2: Run test to verify it fails**

```bash
deno test playtomic.test.ts
```

Expected: FAIL with "Module not found"

**Step 3: Write minimal implementation**

Create: `supabase/functions/handle-incoming-whatsapp/playtomic.ts`

```typescript
export interface PlaytomicLinkData {
  url: string | null
  matchId: string | null
  shortCode: string | null
  rawMessage: string
}

/**
 * Extracts Playtomic match links from WhatsApp message
 * Supports two formats:
 * 1. Full: https://app.playtomic.io/matches/{uuid}
 * 2. Short: https://app.playtomic.io/t/{code}
 */
export function extractPlaytomicLink(message: string): PlaytomicLinkData {
  // Pattern 1: Full match URLs with UUID
  const matchPattern = /https?:\/\/(?:www\.)?app\.playtomic\.io\/matches\/([a-f0-9-]{36})/i
  const matchResult = message.match(matchPattern)

  if (matchResult) {
    return {
      url: matchResult[0].split('?')[0], // Remove query params
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

  // No Playtomic link found
  return {
    url: null,
    matchId: null,
    shortCode: null,
    rawMessage: message,
  }
}
```

**Step 4: Run test to verify it passes**

```bash
deno test playtomic.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add supabase/functions/handle-incoming-whatsapp/playtomic.ts supabase/functions/handle-incoming-whatsapp/playtomic.test.ts
git commit -m "feat(webhook): add Playtomic link extraction"
```

---

## Task 3: Create TwiML Response Builder

**Files:**
- Create: `supabase/functions/handle-incoming-whatsapp/response.ts`

**Step 1: Write the failing test**

Create: `supabase/functions/handle-incoming-whatsapp/response.test.ts`

```typescript
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts"
import { createTwiMLResponse } from "./response.ts"

Deno.test("createTwiMLResponse - creates valid TwiML", async () => {
  const response = createTwiMLResponse("Hello world")

  assertEquals(response.status, 200)
  assertEquals(response.headers.get("Content-Type"), "text/xml")

  const body = await response.text()
  assertEquals(body.includes('<?xml version="1.0" encoding="UTF-8"?>'), true)
  assertEquals(body.includes("<Response>"), true)
  assertEquals(body.includes("<Message>Hello world</Message>"), true)
  assertEquals(body.includes("</Response>"), true)
})

Deno.test("createTwiMLResponse - escapes XML special characters", async () => {
  const response = createTwiMLResponse('Test <tag> & "quotes" \'apostrophe\'')

  const body = await response.text()
  assertEquals(body.includes("&lt;tag&gt;"), true)
  assertEquals(body.includes("&amp;"), true)
  assertEquals(body.includes("&quot;"), true)
  assertEquals(body.includes("&apos;"), true)
})

Deno.test("createTwiMLResponse - handles emojis", async () => {
  const response = createTwiMLResponse("✅ Success!")

  const body = await response.text()
  assertEquals(body.includes("✅ Success!"), true)
})
```

**Step 2: Run test to verify it fails**

```bash
deno test response.test.ts
```

Expected: FAIL with "Module not found"

**Step 3: Write minimal implementation**

Create: `supabase/functions/handle-incoming-whatsapp/response.ts`

```typescript
/**
 * Creates a TwiML response for WhatsApp message reply
 * @see https://www.twilio.com/docs/messaging/twiml
 */
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

/**
 * Escapes XML special characters to prevent injection
 */
function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}
```

**Step 4: Run test to verify it passes**

```bash
deno test response.test.ts
```

Expected: All tests PASS

**Step 5: Commit**

```bash
git add supabase/functions/handle-incoming-whatsapp/response.ts supabase/functions/handle-incoming-whatsapp/response.test.ts
git commit -m "feat(webhook): add TwiML response builder"
```

---

## Task 4: Create Types Definition

**Files:**
- Create: `supabase/functions/handle-incoming-whatsapp/types.ts`

**Step 1: Write the types file**

Create: `supabase/functions/handle-incoming-whatsapp/types.ts`

```typescript
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
```

**Step 2: Commit**

```bash
git add supabase/functions/handle-incoming-whatsapp/types.ts
git commit -m "feat(webhook): add TypeScript type definitions"
```

---

## Task 5: Implement Main Webhook Handler

**Files:**
- Modify: `supabase/functions/handle-incoming-whatsapp/index.ts` (replace entire file)

**Step 1: Write the main handler implementation**

Replace entire contents of `supabase/functions/handle-incoming-whatsapp/index.ts`:

```typescript
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
```

**Step 2: Test locally with mock request**

Create test file: `supabase/functions/handle-incoming-whatsapp/manual-test.ts`

```typescript
// Manual integration test - run with: deno run --allow-net --allow-env manual-test.ts

const testMessage = "Check this out: https://app.playtomic.io/matches/00039cef-9068-4d86-9140-980de97573b4"

const formData = new URLSearchParams({
  From: "whatsapp:+34697745564",
  Body: testMessage,
  MessageSid: "SM123456789",
  AccountSid: "AC123",
  DateSent: new Date().toISOString(),
})

// Note: This will fail signature validation unless TWILIO_AUTH_TOKEN is set
// For now, just verify the function structure compiles
console.log("Manual test would send:", formData.toString())
console.log("✅ Test file compiles successfully")
```

Run:
```bash
deno run --allow-net --allow-env manual-test.ts
```

Expected: Script runs and logs test data

**Step 3: Run all tests**

```bash
deno test --allow-env
```

Expected: All previous tests still PASS

**Step 4: Commit**

```bash
git add supabase/functions/handle-incoming-whatsapp/index.ts supabase/functions/handle-incoming-whatsapp/manual-test.ts
git commit -m "feat(webhook): implement main webhook handler with validation"
```

---

## Task 6: Add Environment Variable Documentation

**Files:**
- Create: `supabase/functions/handle-incoming-whatsapp/README.md`

**Step 1: Create README**

Create: `supabase/functions/handle-incoming-whatsapp/README.md`

```markdown
# WhatsApp Webhook Handler

Handles incoming Twilio WhatsApp webhooks for Playtomic match link validation and linking.

## Environment Variables

Required:
- `TWILIO_AUTH_TOKEN` - Twilio auth token for webhook signature validation

Get from: https://console.twilio.com/ → Account → Auth Token

## Local Development

### Set environment variable

```bash
# In supabase/functions/.env (create if doesn't exist)
TWILIO_AUTH_TOKEN=your_auth_token_here
```

### Run tests

```bash
cd supabase/functions/handle-incoming-whatsapp
deno test --allow-env
```

### Deploy function

```bash
npx supabase functions deploy handle-incoming-whatsapp --no-verify-jwt
```

Note: `--no-verify-jwt` is required because Twilio webhooks don't include Supabase JWT tokens.

## Webhook URL

After deployment, configure this URL in Twilio:

```
https://<project-ref>.supabase.co/functions/v1/handle-incoming-whatsapp
```

Configure at: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sender

## Supported Playtomic URL Formats

1. Full match URLs: `https://app.playtomic.io/matches/{uuid}?...`
2. Short URLs: `https://app.playtomic.io/t/{code}`

## Response Flow

1. Validate Twilio signature (HMAC-SHA1)
2. Extract webhook data (sender, message, timestamp)
3. Extract Playtomic link from message
4. Run business logic (validation & linking)
5. Send TwiML response back to user via WhatsApp

## Business Logic TODO

Currently returns placeholder responses. Needs implementation:

1. Resolve short URLs to full match IDs
2. Fetch Playtomic match details from API
3. Find matching match in database (by time + location)
4. Validate match details
5. Link match to Playtomic booking
6. Handle errors and edge cases

See `docs/plans/2025-11-15-whatsapp-webhook-design.md` for full design.
```

**Step 2: Commit**

```bash
git add supabase/functions/handle-incoming-whatsapp/README.md
git commit -m "docs(webhook): add environment setup and usage documentation"
```

---

## Task 7: Configure Supabase Edge Function Secrets

**Files:**
- None (Supabase CLI command)

**Step 1: Set TWILIO_AUTH_TOKEN secret**

Get your Twilio auth token from: https://console.twilio.com/ → Account → Auth Token

Set the secret:
```bash
npx supabase secrets set TWILIO_AUTH_TOKEN=your_actual_auth_token_here
```

Expected: "Finished supabase secrets set."

**Step 2: Verify secret is set**

```bash
npx supabase secrets list
```

Expected: Shows TWILIO_AUTH_TOKEN in the list

**Step 3: Update local .env for testing**

Create or update: `supabase/functions/.env`

```bash
TWILIO_AUTH_TOKEN=your_actual_auth_token_here
```

Note: This file should be in `.gitignore` (already configured)

---

## Task 8: Deploy and Test

**Files:**
- None (deployment commands)

**Step 1: Deploy the function**

```bash
npx supabase functions deploy handle-incoming-whatsapp --no-verify-jwt
```

Expected: "Deployed Function handle-incoming-whatsapp"

Note: `--no-verify-jwt` flag is required because Twilio webhooks don't include Supabase auth tokens

**Step 2: Get the webhook URL**

```bash
npx supabase status
```

Look for API URL, then construct webhook URL:
```
https://<your-project-ref>.supabase.co/functions/v1/handle-incoming-whatsapp
```

**Step 3: Test with curl (without signature - will fail validation)**

```bash
curl -i --location --request POST 'https://<your-project-ref>.supabase.co/functions/v1/handle-incoming-whatsapp' \
  --header 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'From=whatsapp:+34697745564' \
  --data-urlencode 'Body=Test https://app.playtomic.io/matches/00039cef-9068-4d86-9140-980de97573b4' \
  --data-urlencode 'MessageSid=SM123' \
  --data-urlencode 'AccountSid=AC123'
```

Expected: 403 Forbidden (signature validation fails - this is correct behavior)

**Step 4: Configure Twilio webhook**

1. Go to: https://console.twilio.com/us1/develop/sms/settings/whatsapp-sender
2. Find your WhatsApp sender
3. Set "When a message comes in" webhook to your function URL
4. Save

**Step 5: Test with real WhatsApp message**

Send a message to your Twilio WhatsApp number:
```
https://app.playtomic.io/matches/00039cef-9068-4d86-9140-980de97573b4
```

Expected: Receive reply "✅ Match link received! Validation coming soon..."

**Step 6: Check function logs**

```bash
npx supabase functions logs handle-incoming-whatsapp
```

Expected: See logs showing message received and link extracted

**Step 7: Commit deployment notes**

Update `supabase/functions/handle-incoming-whatsapp/README.md` with actual deployed URL:

```markdown
## Deployed Webhook URL

Production: `https://<your-project-ref>.supabase.co/functions/v1/handle-incoming-whatsapp`

Configured in Twilio: ✅
```

```bash
git add supabase/functions/handle-incoming-whatsapp/README.md
git commit -m "docs(webhook): add deployed URL and configuration status"
```

---

## Summary

**Implemented:**
- ✅ Twilio signature validation (HMAC-SHA1)
- ✅ Playtomic link extraction (both URL formats)
- ✅ TwiML response builder
- ✅ Type definitions
- ✅ Main webhook handler with validation
- ✅ Comprehensive test suite
- ✅ Documentation and deployment guide

**TODO for Business Logic (next steps):**
1. Resolve Playtomic short URLs
2. Fetch Playtomic match details via API
3. Query database for matching matches (time + location)
4. Validate match details
5. Link match to Playtomic booking
6. Handle edge cases (no match found, multiple matches, etc.)

**Testing:**
- Unit tests for each module (validation, extraction, response)
- Integration test via real Twilio webhook
- All tests use Deno's built-in test runner

**Security:**
- Twilio signature validation prevents unauthorized requests
- XML escaping prevents injection attacks
- Environment variable for auth token (not in code)

**Skills Used:**
- @superpowers:test-driven-development - Tests written before implementation
- @superpowers:verification-before-completion - All tests run before commits
- DRY - Helpers separated into modules
- YAGNI - Only implementing validation/extraction, not full business logic yet
