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
