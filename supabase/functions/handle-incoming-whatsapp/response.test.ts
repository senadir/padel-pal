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
