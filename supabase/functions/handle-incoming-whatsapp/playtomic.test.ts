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
