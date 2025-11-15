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

Deno.test("validateTwilioSignature - returns true for valid signature", async () => {
  // Set up test auth token
  const testAuthToken = "test-auth-token-12345"
  Deno.env.set("TWILIO_AUTH_TOKEN", testAuthToken)

  // Set up known URL and form data
  const url = "https://example.com/webhook"
  const formData = new URLSearchParams({
    Body: "Hello",
    From: "whatsapp:+1234567890",
    MessageSid: "SM123456",
  })

  // Manually compute the expected signature using the same algorithm as validation.ts
  // 1. Sort params alphabetically and concatenate key+value
  const params = Array.from(formData.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}${value}`)
    .join("")

  // 2. Compute HMAC-SHA1: authToken + url + params
  const data = url + params
  const encoder = new TextEncoder()
  const keyData = encoder.encode(testAuthToken)
  const messageData = encoder.encode(data)

  const key = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  )

  const signatureBuffer = await crypto.subtle.sign("HMAC", key, messageData)
  const validSignature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)))

  // Create request with the valid signature
  const req = new Request(url, {
    method: "POST",
    body: formData,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": validSignature,
    },
  })

  const result = await validateTwilioSignature(req)
  assertEquals(result, true)

  // Clean up
  Deno.env.delete("TWILIO_AUTH_TOKEN")
})
