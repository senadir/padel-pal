import { useState, useEffect, useCallback, startTransition, useMemo } from 'react'
import * as Ariakit from '@ariakit/react'
import { matchSorter } from 'match-sorter'
import { Loader2 } from 'lucide-react'
import {
  searchGooglePlaces,
  getGooglePlaceDetails,
} from '@/utils/google-places'
import { getRecentVenues } from '@/utils/venues'
import type { PlaceSearchResult } from '@/utils/types'

interface PlaceSearchComboboxProps {
  value?: { name: string; location: string }
  onSelect: (place: { name: string; location: string }) => void
  placeholder?: string
}

export function PlaceSearchCombobox({
  value,
  onSelect,
  placeholder = 'Search for a venue...',
}: PlaceSearchComboboxProps) {
  const [searchValue, setSearchValue] = useState(value?.name || '')
  const [isSearching, setIsSearching] = useState(false)
  const [isSelecting, setIsSelecting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [googleResults, setGoogleResults] = useState<PlaceSearchResult[]>([])
  const [allVenues, setAllVenues] = useState<PlaceSearchResult[]>([])
  const [userLocation, setUserLocation] = useState<{
    lat: number
    lng: number
  } | null>(null)
  const [hasRequestedLocation, setHasRequestedLocation] = useState(false)

  // Sync searchValue with external value prop
  useEffect(() => {
    if (value?.name) {
      setSearchValue(value.name)
    }
  }, [value?.name])

  // Request user's location when they start typing (only once)
  useEffect(() => {
    if (
      searchValue.length > 0 &&
      !hasRequestedLocation &&
      'geolocation' in navigator
    ) {
      setHasRequestedLocation(true)
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          })
          console.log('User location acquired for venue search')
        },
        (error) => {
          console.warn(
            'Geolocation permission denied, using IP-based location:',
            error.message,
          )
        },
        {
          enableHighAccuracy: false,
          timeout: 5000,
          maximumAge: 300000, // Cache for 5 minutes
        },
      )
    }
  }, [searchValue, hasRequestedLocation])

  // Load all venues on mount
  useEffect(() => {
    const loadVenues = async () => {
      try {
        const venues = await getRecentVenues()
        setAllVenues(venues)
      } catch (error) {
        console.error('Error loading venues:', error)
      }
    }
    loadVenues()
  }, [])

  // Client-side filter venues by search query using match-sorter
  const filteredVenues = useMemo(
    () =>
      searchValue.length >= 2
        ? matchSorter(allVenues, searchValue, {
            keys: ['name', 'address'],
          })
        : allVenues,
    [searchValue, allVenues],
  )

  // Debounced Google Places search
  const performGoogleSearch = useCallback(
    async (query: string) => {
      if (!query || query.length < 3) {
        setGoogleResults([])
        setError(null)
        return
      }

      setIsSearching(true)
      setError(null)

      try {
        // Pass user location to bias search results
        const results = await searchGooglePlaces(
          query,
          userLocation || undefined,
        )

        // Transform Google results to PlaceSearchResult format
        const googlePlaces: PlaceSearchResult[] = results.map((place) => ({
          id: place.place_id,
          name: place.structured_formatting.main_text,
          address: place.structured_formatting.secondary_text,
          source: 'google' as const,
          googlePlaceId: place.place_id,
        }))

        // Filter out Google results that already exist in database
        const uniqueGoogleResults = googlePlaces.filter(
          (gPlace) =>
            !allVenues.some(
              (venue) => venue.googlePlaceId === gPlace.googlePlaceId,
            ),
        )

        setGoogleResults(uniqueGoogleResults)
      } catch (error) {
        console.error('Error searching Google Places:', error)
        setError('Failed to search venues. Please try again.')
        setGoogleResults([])
      } finally {
        setIsSearching(false)
      }
    },
    [allVenues, userLocation],
  )

  // Debounce Google search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performGoogleSearch(searchValue)
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [searchValue, performGoogleSearch])

  // Handle place selection
  const handleSelectPlace = async (place: PlaceSearchResult) => {
    setIsSelecting(true)
    setError(null)

    try {
      let name = place.name
      let location = place.googleMapsUrl || ''

      // If selecting a Google place without full details, fetch them
      if (
        place.source === 'google' &&
        place.googlePlaceId &&
        !place.googleMapsUrl
      ) {
        const details = await getGooglePlaceDetails(place.googlePlaceId)
        name = details.name
        location = details.url
      }

      // Call parent's onSelect
      onSelect({ name, location })

      // Set search value to the selected name
      startTransition(() => {
        setSearchValue(name)
      })
    } catch (error) {
      console.error('Error selecting place:', error)
      setError('Failed to select venue. Please try again.')
    } finally {
      setIsSelecting(false)
    }
  }

  // Show "Recently Used" section when no search query, otherwise show filtered results
  const displayVenues = searchValue.length === 0 ? allVenues : filteredVenues
  const showGoogleResults = searchValue.length >= 3 && googleResults.length > 0
  const hasResults =
    displayVenues.length > 0 || showGoogleResults || isSearching

  return (
    <div className="w-full">
      <Ariakit.ComboboxProvider
        value={searchValue}
        setValue={(value) => {
          startTransition(() => setSearchValue(value))
        }}
      >
        <Ariakit.Combobox
          placeholder={placeholder}
          disabled={isSelecting}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        />

        {error && (
          <div className="mt-2 rounded-md border border-destructive px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {hasResults && (
          <Ariakit.ComboboxPopover
            gutter={8}
            sameWidth
            className="z-50 max-h-[300px] overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md outline-none"
          >
            {isSearching && (
              <div className="flex items-center justify-center p-4">
                <Loader2 className="h-4 w-4 animate-spin" />
              </div>
            )}

            {!isSearching && displayVenues.length > 0 && (
              <div>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  {searchValue.length === 0
                    ? 'Recently Used'
                    : 'Your Saved Venues'}
                </div>
                {displayVenues.map((venue) => (
                  <Ariakit.ComboboxItem
                    key={venue.id}
                    value={venue.name}
                    onClick={() => handleSelectPlace(venue)}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[active-item]:bg-accent data-[active-item]:text-accent-foreground"
                  >
                    <span className="truncate">{venue.name}</span>
                  </Ariakit.ComboboxItem>
                ))}
              </div>
            )}

            {!isSearching && showGoogleResults && (
              <div className={displayVenues.length > 0 ? 'mt-2' : ''}>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Search Google Places
                </div>
                {googleResults.map((place) => (
                  <Ariakit.ComboboxItem
                    key={place.id}
                    value={place.name}
                    onClick={() => handleSelectPlace(place)}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none data-[active-item]:bg-accent data-[active-item]:text-accent-foreground"
                  >
                    <span className="truncate">{place.name}</span>
                  </Ariakit.ComboboxItem>
                ))}
              </div>
            )}

            {!isSearching &&
              searchValue.length > 0 &&
              displayVenues.length === 0 &&
              googleResults.length === 0 && (
                <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                  No venues found.
                </div>
              )}
          </Ariakit.ComboboxPopover>
        )}
      </Ariakit.ComboboxProvider>
    </div>
  )
}
