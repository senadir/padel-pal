import { createServerFn } from '@tanstack/react-start'
import type { GooglePlacePrediction, GooglePlaceDetails } from './types'

// Helper to wait for Google Maps API to load
function waitForGoogleMaps(): Promise<typeof google.maps> {
  return new Promise((resolve, reject) => {
    if (typeof google !== 'undefined' && google.maps) {
      resolve(google.maps)
      return
    }

    const checkInterval = setInterval(() => {
      if (typeof google !== 'undefined' && google.maps) {
        clearInterval(checkInterval)
        resolve(google.maps)
      }
    }, 100)

    // Timeout after 10 seconds
    setTimeout(() => {
      clearInterval(checkInterval)
      reject(new Error('Google Maps API failed to load'))
    }, 10000)
  })
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
    const maps = await waitForGoogleMaps()

    // Build request options
    const requestOptions: google.maps.places.FetchAutocompleteSuggestionsRequest = {
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
      await maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(requestOptions)

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
    const maps = await waitForGoogleMaps()

    // Create a new Place instance with the place ID
    const place = new maps.places.Place({
      id: placeId,
    })

    // Fetch the required fields using the new API
    await place.fetchFields({
      fields: ['id', 'displayName', 'formattedAddress', 'googleMapsURI', 'location'],
    })

    // Clear session token after getting details
    clearSessionToken()

    return {
      place_id: place.id || '',
      name: place.displayName || '',
      formatted_address: place.formattedAddress || '',
      url: place.googleMapsURI || '',
      geometry: {
        location: {
          lat: place.location?.lat() || 0,
          lng: place.location?.lng() || 0,
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

    return {
      place_id: data.id,
      name: data.displayName?.text || '',
      formatted_address: data.formattedAddress || '',
      url: data.googleMapsUri || '',
      geometry: {
        location: {
          lat: data.location?.latitude || 0,
          lng: data.location?.longitude || 0,
        },
      },
    }
  })
