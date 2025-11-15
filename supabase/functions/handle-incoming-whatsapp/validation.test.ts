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
