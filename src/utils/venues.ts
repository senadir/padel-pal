import { createServerFn } from '@tanstack/react-start'
import { getSupabaseServerClient } from './supabase'
import type { PlaceSearchResult } from './types'

/**
 * Get all venues sorted by usage and recency
 * Client will handle filtering during search
 */
export const getRecentVenues = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PlaceSearchResult[]> => {
    const supabase = getSupabaseServerClient()

    const { data: venues, error } = await supabase
      .from('venues')
      .select('*')
      .order('usage_count', { ascending: false })
      .order('last_used_at', { ascending: false })

    if (error) {
      console.error('Error fetching venues:', error)
      return []
    }

    // Transform to PlaceSearchResult format
    return (venues || []).map((venue) => ({
      id: venue.google_place_id || venue.id.toString(),
      name: venue.name,
      address: venue.formatted_address,
      source: 'database' as const,
      googlePlaceId: venue.google_place_id || undefined,
      googleMapsUrl: venue.google_maps_url || undefined,
      latitude: venue.latitude ? Number(venue.latitude) : undefined,
      longitude: venue.longitude ? Number(venue.longitude) : undefined,
    }))
  },
)

/**
 * Create or update venue (increments usage_count if exists)
 */
interface UpsertVenueInput {
  name: string
  formattedAddress: string
  googlePlaceId?: string
  googleMapsUrl?: string
  latitude?: number
  longitude?: number
}

export const upsertVenue = createServerFn({ method: 'POST' })
  .inputValidator((data: UpsertVenueInput) => data)
  .handler(async ({ data }) => {
    const supabase = getSupabaseServerClient()

    // Check if venue with this place_id already exists
    if (data.googlePlaceId) {
      const { data: existing } = await supabase
        .from('venues')
        .select('id, usage_count')
        .eq('google_place_id', data.googlePlaceId)
        .single()

      if (existing) {
        // Update usage count and last_used_at
        const { error } = await supabase
          .from('venues')
          .update({
            usage_count: existing.usage_count + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq('id', existing.id)

        if (error) {
          throw new Error(`Failed to update venue: ${error.message}`)
        }

        return { id: existing.id }
      }
    }

    // Insert new venue
    const { data: newVenue, error } = await supabase
      .from('venues')
      .insert({
        name: data.name,
        formatted_address: data.formattedAddress,
        location: data.formattedAddress, // Keep legacy field populated
        google_place_id: data.googlePlaceId,
        google_maps_url: data.googleMapsUrl,
        latitude: data.latitude,
        longitude: data.longitude,
      })
      .select('id')
      .single()

    if (error) {
      throw new Error(`Failed to create venue: ${error.message}`)
    }

    return { id: newVenue.id }
  })
