import type { Database } from './database.types'

export type Player = Database['public']['Tables']['players']['Row']
export type AppRole = Database['public']['Enums']['app_role']
export type UserRole = Database['public']['Tables']['user_roles']['Row']
export type SessionStatus = Database['public']['Enums']['session_status']
export type Level = Database['public']['Enums']['Levels']

export type Option = {
  id: string
  slot: { id: string; range: [Date, Date] }
  level: string
  players: Array<Player & { votedAt: Date }>
}

// Playtomic player data from API
export type PlaytomicPlayer = {
  id: number
  full_name: string
  picture: string | null
  payment_status: 'paid' | 'pending'
}
// Playtomic match stored in database
export type PlaytomicMatchData = {
  id: number
  playtomic_match_id: string
  match_url: string
  club_name: string
  court_name: string
  start_time: string
  end_time: string
  playtomic_players: PlaytomicPlayer[]
  match_status: 'scheduled' | 'played' | 'cancelled' | null
  score: { team1: number; team2: number } | null
  last_synced_at: string
  created_at: string
  updated_at: string
}

// Player sync status for UI
export type PlayerSyncStatus =
  | 'synced_paid' // In both systems + paid (Emerald ring)
  | 'synced_unpaid' // In both systems + unpaid (Amber ring)
  | 'only_local' // Only in our match (Rose ring)
  | 'only_playtomic' // Only in Playtomic (Violet ring)
  | 'unconnected' // Match not connected to Playtomic (Gray ring)

// Extended player for match display
export type MatchPlayer = Player & {
  syncStatus: PlayerSyncStatus
  playtomicPaymentStatus?: 'paid' | 'pending'
}

// Booker information for a match
export interface MatchBooker {
  participantId: number
  playerId: string
  name: string | null
  phone: string | null
  avatar: string | null
}

export interface Match extends Option {
  sessionId: string
  playtomicMatch: PlaytomicMatchData | null
  status: 'played' | 'scheduled' | 'draft' | 'cancelled'
  players: Array<
    Option['players'][number] & { status?: 'paid' | 'pending' | 'draft'; participantId?: number }
  >
  booker: MatchBooker | null
}

export type SessionVenue = {
  name: string
  location: string
  placeId?: string
  isPrimary: boolean
}

export type SessionForm = {
  venues: Array<SessionVenue>
  date: Date
  levels: Array<{
    level: string
    timeSlots: Array<{ id: string; range: [Date, Date] }>
  }>
  timeBlocks: '60' | '90'
  limitPlayers: boolean
  playersPerSlot?: number
  votingClosesAt?: Date
}

export interface TimeSlot {
  id: string
  range: [Date, Date]
  options: TimeSlotOption[]
}
export interface TimeSlotOption {
  id: string
  slot: { id: string; range: [Date, Date] }
  level: string
  players: Array<Player & { votedAt: Date }>
}
export interface Session extends Omit<SessionForm, 'timeBlocks'> {
  id: string
  status?: SessionStatus
  timeSlots: TimeSlot[]
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
  tenant_tags: Array<string>
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
