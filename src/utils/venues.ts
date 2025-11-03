import { createServerFn } from '@tanstack/react-start'
import { getSupabaseServerClient } from './supabase'
import type { PlaceSearchResult } from './types'

/**
 * Get all recently used venues
 * Returns venues ordered by most recently created (newest first)
 */
export const getRecentVenues = createServerFn({ method: 'GET' }).handler(
  async (): Promise<Array<PlaceSearchResult>> => {
    const supabase = getSupabaseServerClient()

    const { data: venues, error } = await supabase
      .from('venues')
      .select('id, label, maps_url, place_id')
      .order('created_at', { ascending: false })
      .limit(50) // Limit to 50 most recent venues

    if (error) {
      console.error('Error fetching venues:', error)
      return []
    }

    // Transform to PlaceSearchResult format
    return venues.map((venue) => ({
      id: venue.id.toString(),
      name: venue.label,
      source: 'database' as const,
      googlePlaceId: venue.place_id || undefined,
      googleMapsUrl: venue.maps_url || undefined,
    }))
  },
)

/**
 * Create venue (simplified schema: label, maps_url, and place_id)
 * Uses upsert to avoid duplicates based on maps_url unique constraint
 */
interface UpsertVenueInput {
  label: string
  mapsUrl: string
  placeId?: string
}

export const upsertVenue = createServerFn({ method: 'POST' })
  .inputValidator((data: UpsertVenueInput) => data)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()

    // Upsert venue (insert or ignore if maps_url already exists)
    const { data: venue, error } = await supabase
      .from('venues')
      .upsert(
        {
          label: data.label,
          maps_url: data.mapsUrl,
          place_id: data.placeId || null,
        },
        {
          onConflict: 'maps_url',
          ignoreDuplicates: true, // Don't error if venue already exists
        },
      )
      .select('id')
      .single()

    if (error || !venue) {
      // If ignoreDuplicates is true and venue exists, we get null data but no error
      // In that case, fetch the existing venue
      const { data: existing, error: fetchError } = await supabase
        .from('venues')
        .select('id')
        .eq('maps_url', data.mapsUrl)
        .single()

      if (existing) {
        return { id: existing.id }
      }

      throw new Error(
        `Failed to upsert venue: ${error ? error.message : fetchError ? fetchError.message : 'Unknown error'}`,
      )
    }

    return { id: venue.id }
  })
