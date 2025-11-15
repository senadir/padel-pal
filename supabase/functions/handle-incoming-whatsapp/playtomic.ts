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
