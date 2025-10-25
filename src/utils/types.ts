export type Player = {
  id: string
  name: string
  phone: string
  level: string
  avatar: string
  playtomicId?: string
}

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
  date: Date
  time: Date
  levels: Array<string>
  timeBlocks: string
  timeSlots: Array<{ id: string; range: [Date, Date] }>
  limitPlayers: boolean
  playersPerSlot?: number
}

export interface Session extends Omit<SessionForm, 'timeBlocks'> {
  id: string
  timeSlots: Array<{ id: string; range: [Date, Date]; options: Array<Option> }>
}
