import { createServerFn } from '@tanstack/react-start'
import { Loader } from '@googlemaps/js-api-loader'
import type { GooglePlacePrediction, GooglePlaceDetails } from './types'

// Singleton loader instance
let loaderInstance: Loader | null = null

function getLoader(): Loader {
  if (!loaderInstance) {
    loaderInstance = new Loader({
      apiKey: import.meta.env.VITE_GOOGLE_PLACES_API_KEY || '',
      version: 'weekly',
      libraries: ['places'],
    })
  }
  return loaderInstance
}

// Helper to ensure Google Maps API is loaded
async function ensureGoogleMapsLoaded(): Promise<typeof google.maps> {
  if (typeof google !== 'undefined' && google.maps) {
    return google.maps
  }

  const loader = getLoader()
  await loader.load()
  return google.maps
}

// Session token for grouping autocomplete + details calls
let sessionToken: google.maps.places.AutocompleteSessionToken | null = null

function getSessionToken(): google.maps.places.AutocompleteSessionToken {
  if (!sessionToken) {
    sessionToken = new google.maps.places.AutocompleteSessionToken()
  }
  return sessionToken
}

function clearSessionToken(): void {
  sessionToken = null
}

/**
 * Search Google Places Autocomplete API (client-side using JS SDK)
 * Uses the new AutocompleteSuggestion API (recommended as of March 2025)
 * Docs: https://developers.google.com/maps/documentation/javascript/place-autocomplete-overview
 */
export async function searchGooglePlaces(
  query: string,
  location?: { lat: number; lng: number },
): Promise<GooglePlacePrediction[]> {
  if (!query || query.length < 3) {
    return []
  }

  try {
    const maps = await ensureGoogleMapsLoaded()

    // Build request options
    const requestOptions: google.maps.places.FetchAutocompleteSuggestionsRequest =
      {
        input: query,
        includedPrimaryTypes: ['gym', 'sports_complex', 'sports_club'],
        sessionToken: getSessionToken(),
      }

    // Add location bias if provided (from browser geolocation)
    if (location) {
      requestOptions.locationBias = {
        center: { lat: location.lat, lng: location.lng },
        radius: 50000, // 50km radius
      }
    }

    // Use new AutocompleteSuggestion API
    const { suggestions } =
      await maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
        requestOptions,
      )

    // Debug: log response structure
    if (suggestions.length > 0) {
      console.log('Google Places API response sample:', suggestions[0])
    }

    // Transform to our format
    const results: GooglePlacePrediction[] = suggestions
      .filter((suggestion) => suggestion?.placePrediction)
      .map((suggestion) => {
        const placePrediction = suggestion.placePrediction
        const text = placePrediction.text?.toString() || ''

        // Safely access structured format with fallback
        const structuredFormat = placePrediction.structuredFormat
        const mainText = structuredFormat?.mainText?.toString() || text
        const secondaryText = structuredFormat?.secondaryText?.toString() || ''

        return {
          place_id: placePrediction.placeId,
          description: text,
          structured_formatting: {
            main_text: mainText,
            secondary_text: secondaryText,
          },
        }
      })

    return results
  } catch (error) {
    console.error('Error searching Google Places:', error)
    console.error('Query:', query)
    console.error('Location:', location)
    return []
  }
}

/**
 * Fetch detailed information about a place (client-side using JS SDK)
 * Uses the new Place class (recommended as of March 2025)
 * Docs: https://developers.google.com/maps/documentation/javascript/place-details
 */
export async function getGooglePlaceDetails(
  placeId: string,
): Promise<GooglePlaceDetails> {
  try {
    const maps = await ensureGoogleMapsLoaded()

    // Create a new Place instance with the place ID
    const place = new maps.places.Place({
      id: placeId,
    })

    // Fetch the required fields using the new API
    await place.fetchFields({
      fields: [
        'id',
        'displayName',
        'formattedAddress',
        'googleMapsURI',
        'location',
      ],
    })

    // Clear session token after getting details
    clearSessionToken()

    // Build Google Maps URL from coordinates if not provided
    const lat = place.location?.lat() || 0
    const lng = place.location?.lng() || 0
    const mapsUrl =
      place.googleMapsURI ||
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

    return {
      place_id: place.id || '',
      name: place.displayName || '',
      formatted_address: place.formattedAddress || '',
      url: mapsUrl,
      geometry: {
        location: {
          lat,
          lng,
        },
      },
    }
  } catch (error) {
    console.error('Error loading Google Maps:', error)
    throw error
  }
}

/**
 * Fetch detailed information about a place (server-side)
 * Used for server functions like session creation
 */
export const getGooglePlaceDetailsServer = createServerFn({ method: 'GET' })
  .inputValidator((placeId: string) => placeId)
  .handler(async ({ data: placeId }): Promise<GooglePlaceDetails> => {
    const apiKey = process.env.VITE_GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      throw new Error('Google Places API key not configured')
    }

    const url = `https://places.googleapis.com/v1/places/${placeId}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask':
          'id,displayName,formattedAddress,googleMapsUri,location',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Failed to fetch place details: ${errorText}`)
    }

    const data = await response.json()

    // Build Google Maps URL from coordinates if not provided
    const lat = data.location?.latitude || 0
    const lng = data.location?.longitude || 0
    const mapsUrl =
      data.googleMapsUri ||
      `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`

    return {
      place_id: data.id,
      name: data.displayName?.text || '',
      formatted_address: data.formattedAddress || '',
      url: mapsUrl,
      geometry: {
        location: {
          lat,
          lng,
        },
      },
    }
  })
