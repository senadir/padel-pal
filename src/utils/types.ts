import { Database } from './database.types'

export type Player = Database['public']['Tables']['players']['Row']
export type AppRole = Database['public']['Enums']['app_role']
export type UserRole = Database['public']['Tables']['user_roles']['Row']
export type SessionStatus = Database['public']['Enums']['session_status']

export type Option = {
  id: string
  slot: { id: string; range: [Date, Date] }
  level: string
  players: Array<Player & { votedAt?: Date }>
}

export type PlaytomicMatch = {
  id: string
  location: string
  court: string
}

export interface Match extends Option {
  sessionId: string
  playtomicMatch: PlaytomicMatch | null
  status: 'played' | 'scheduled' | 'draft' | 'cancelled'
  players: Array<Player & { status?: 'paid' | 'pending' | 'draft' }>
}
export type SessionForm = {
  venueName: string
  venueLocation: string
  venuePlaceId?: string
  date: Date
  levels: Array<string>
  timeBlocks: string
  timeSlots: Array<{ id: string; range: [Date, Date] }>
  limitPlayers: boolean
  playersPerSlot?: number
  votingClosesAt?: Date
}

export interface Session extends Omit<SessionForm, 'timeBlocks'> {
  id: string
  timeSlots: Array<{ id: string; range: [Date, Date]; options: Array<Option> }>
}

export interface PlaytomicProfile {
  user_id: string
  full_name: string
  picture: string
  is_validated: boolean
  is_email_verified: boolean
  is_phone_verified: boolean
  bio: string
  communications_language: string
  country_code: string
  email: string | null
  phone: string | null
  facebook_id: string | null
  privacy_profile: 'PUBLIC' | 'PRIVATE' | 'FRIENDS_ONLY'
  is_premium: boolean
  tenant_tags: string[]
}

export type Venue = Database['public']['Tables']['venues']['Row']

export interface GooglePlacePrediction {
  place_id: string
  description: string
  structured_formatting: {
    main_text: string
    secondary_text: string
  }
}

export interface GooglePlaceDetails {
  place_id: string
  name: string
  formatted_address: string
  url: string // Google Maps URL
  geometry: {
    location: {
      lat: number
      lng: number
    }
  }
}

export interface PlaceSearchResult {
  id: string
  name: string
  source: 'google' | 'database'
  googlePlaceId?: string
  googleMapsUrl?: string
  latitude?: number
  longitude?: number
}
