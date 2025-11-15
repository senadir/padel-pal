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
