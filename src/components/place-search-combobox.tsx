import { useState, useEffect, startTransition, useMemo } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
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

// Custom hook for geolocation
function useGeolocation(enabled: boolean) {
  const [location, setLocation] = useState<{
    lat: number
    lng: number
  } | null>(null)

  useEffect(() => {
    if (!enabled || !('geolocation' in navigator)) return

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        })
      },
      (error) => {
        console.warn('Geolocation permission denied:', error.message)
      },
      {
        enableHighAccuracy: false,
        timeout: 5000,
        maximumAge: 300000, // Cache for 5 minutes
      },
    )
  }, [enabled])

  return location
}

// Custom hook for debounced value
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timeoutId = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timeoutId)
  }, [value, delay])

  return debouncedValue
}

export function PlaceSearchCombobox({
  value,
  onSelect,
  placeholder = 'Search for a venue...',
}: PlaceSearchComboboxProps) {
  const [searchValue, setSearchValue] = useState(value?.name || '')
  const debouncedSearch = useDebouncedValue(searchValue, 300)

  // Sync searchValue with external value prop
  useEffect(() => {
    if (value?.name) {
      setSearchValue(value.name)
    }
  }, [value?.name])

  // Request geolocation when user starts typing
  const userLocation = useGeolocation(searchValue.length > 0)

  // Query: Load all venues
  const { data: allVenues = [], isLoading: isLoadingVenues } = useQuery({
    queryKey: ['venues'],
    queryFn: getRecentVenues,
  })

  // Query: Search Google Places (debounced)
  const {
    data: googleResults = [],
    isLoading: isSearchingGoogle,
    error: googleError,
  } = useQuery({
    queryKey: ['google-places', debouncedSearch, userLocation],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 3) return []

      const results = await searchGooglePlaces(
        debouncedSearch,
        userLocation || undefined,
      )

      // Transform and filter duplicates
      const googlePlaces: PlaceSearchResult[] = results.map((place) => ({
        id: place.place_id,
        name: place.structured_formatting.main_text,
        address: place.structured_formatting.secondary_text,
        source: 'google' as const,
        googlePlaceId: place.place_id,
      }))

      return googlePlaces.filter(
        (gPlace) =>
          !allVenues.some(
            (venue) => venue.googlePlaceId === gPlace.googlePlaceId,
          ),
      )
    },
    enabled: debouncedSearch.length >= 3,
  })

  // Mutation: Get place details on selection
  const placeDetailsMutation = useMutation({
    mutationFn: getGooglePlaceDetails,
    onSuccess: (details, placeId) => {
      onSelect({ name: details.name, location: details.url })
      startTransition(() => {
        setSearchValue(details.name)
      })
    },
    onError: (error) => {
      console.error('Error selecting place:', error)
    },
  })

  // Client-side filter venues by search query
  const filteredVenues = useMemo(
    () =>
      searchValue.length >= 2
        ? matchSorter(allVenues, searchValue, {
            keys: ['name', 'address'],
          })
        : allVenues,
    [searchValue, allVenues],
  )

  // Handle place selection
  const handleSelectPlace = (place: PlaceSearchResult) => {
    // If selecting a Google place without full details, fetch them
    if (
      place.source === 'google' &&
      place.googlePlaceId &&
      !place.googleMapsUrl
    ) {
      placeDetailsMutation.mutate(place.googlePlaceId)
    } else {
      // Database venue with all details
      onSelect({
        name: place.name,
        location: place.googleMapsUrl || '',
      })
      startTransition(() => {
        setSearchValue(place.name)
      })
    }
  }

  // Derived state
  const displayVenues = searchValue.length === 0 ? allVenues : filteredVenues
  const showGoogleResults = searchValue.length >= 3 && googleResults.length > 0
  const isSearching = isSearchingGoogle || isLoadingVenues
  const error = googleError || placeDetailsMutation.error
  const hasResults = displayVenues.length > 0 || showGoogleResults || isSearching

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
          disabled={placeDetailsMutation.isPending}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
        />

        {error && (
          <div className="mt-2 rounded-md border border-destructive px-3 py-2 text-sm text-destructive">
            {error instanceof Error ? error.message : 'An error occurred'}
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
