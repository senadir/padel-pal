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
