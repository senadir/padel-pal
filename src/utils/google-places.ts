import type { GooglePlacePrediction, GooglePlaceDetails } from './types'

/**
 * Get the Google Places API key from environment variables
 * Throws an error if the key is not configured
 */
function getApiKey(): string {
  const apiKey = import.meta.env.VITE_GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    throw new Error('Google Places API key not configured')
  }
  return apiKey
}

/**
 * Search Google Places Autocomplete API (direct client-side call)
 * Uses the new Places API (New) with REST endpoint
 * Docs: https://developers.google.com/maps/documentation/places/web-service/autocomplete
 */
export async function searchGooglePlaces(
  query: string,
  location?: { lat: number; lng: number },
): Promise<GooglePlacePrediction[]> {
  if (!query || query.length < 3) {
    return []
  }

  try {
    const apiKey = getApiKey()
    const url = 'https://places.googleapis.com/v1/places:autocomplete'

    const requestBody: any = {
      input: query,
      includedPrimaryTypes: ['gym', 'sports_complex', 'sports_club'],
    }

    // Add location bias if provided
    if (location) {
      requestBody.locationBias = {
        circle: {
          center: {
            latitude: location.lat,
            longitude: location.lng,
          },
          radius: 50000, // 50km
        },
      }
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Google Places API error:', errorText)
      throw new Error(`Google Places API error: ${response.status}`)
    }

    const data = await response.json()

    // Transform to our format
    const results: GooglePlacePrediction[] = (data.suggestions || [])
      .filter((suggestion: any) => suggestion?.placePrediction)
      .map((suggestion: any) => {
        const placePrediction = suggestion.placePrediction
        const mainText =
          placePrediction.structuredFormat?.mainText?.text ||
          placePrediction.text?.text ||
          ''
        const secondaryText =
          placePrediction.structuredFormat?.secondaryText?.text || ''

        return {
          place_id: placePrediction.placeId,
          description: placePrediction.text?.text || '',
          structured_formatting: {
            main_text: mainText,
            secondary_text: secondaryText,
          },
        }
      })

    return results
  } catch (error) {
    console.error('Error searching Google Places:', error)
    throw error
  }
}

/**
 * Fetch detailed information about a place using Places API (New)
 * Docs: https://developers.google.com/maps/documentation/places/web-service/place-details
 */
export async function getGooglePlaceDetails(
  placeId: string,
): Promise<GooglePlaceDetails> {
  if (!placeId) {
    throw new Error('Place ID is required')
  }

  try {
    const apiKey = getApiKey()
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
  } catch (error) {
    console.error('Error fetching place details:', error)
    throw error
  }
}
