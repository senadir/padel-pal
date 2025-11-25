// Coordinate information for location
interface Coordinate {
  lat: number
  lon: number
}

// Address details
interface Address {
  street: string
  postal_code: string | null
  city: string | null
  sub_administrative_area: string
  administrative_area: string
  country: string
  country_code: string
  coordinate: Coordinate
  timezone: string
}

// Player information
interface MatchPlayer {
  name: string
  user_id: string
  contact_id: string | null
  merchant_player_id: string | null
  picture: string | null
  referrer_user_id: string | null
  email: string | null
  gender: 'MALE' | 'FEMALE' | null
  phone: string | null
  level_value: number | null
  level_confidence: number | null
  preferred_position: string | null
  is_premium: boolean
}

// Team details
interface Team {
  team_id: string
  players: MatchPlayer[]
  min_players: number
  max_players: number
  team_result: 'WON' | 'LOST' | 'DRAWN' | null
}

interface MatchScore {
  team_id: '0' | '1'
  score: number | null
}

// Match result set
interface ResultSet {
  name: string
  scores: MatchScore[]
}

// Tenant information
interface Tenant {
  tenant_id: string
  tenant_name: string
  tenant_type: string
  playtomic_status: string | null
  address: Address
  tenant_hostname: string
  url: string
  resources: unknown
  default_currency: string | null
  tenant_billing_information_list: unknown[]
  booking_type: 'PUBLIC' | null
  tenant_images: string[]
}

// Location information
interface LocationInfo {
  id: string
  type: string
  name: string
  address: Address
  images: string[] | null
}

// Resource properties
interface ResourceProperties {
  resource_type: string
  resource_size: string
  resource_feature: string
}

// Product extra item
interface ProductExtra {
  product_extra_id: string
  product_extra_type: string
  price_per_unit: string
  vat_rate: number
}

interface ProductExtraData {
  product_extra: ProductExtra
  amount: number
  price: string
}

interface ProductExtrasInfo {
  product_extras_data: ProductExtraData[]
  product_extras_total_price: string
}

// Applied benefit
interface AppliedBenefit {
  benefit_id: string
  category_id: string
  benefit_description: string | null
}

// Registration details
interface Registration {
  user_id: MatchPlayer['user_id'] | null
  contact_id: string | null
  merchant_player_id: string | null
  price: string | null
  custom_price: string | null
  is_fixed_price: boolean
  payment_price: string | null
  applied_discount: string | null
  applied_voucher_redemption_id: string | null
  payment_id: string | null
  payment_reference: string | null
  payment_b2b_billing_type: string | null
  payment_method_type: 'APPLE_PAY' | 'QUICK_PAY' | string | null
  registration_date: string | null
  payment_date: string | null
  payer_id: MatchPlayer['user_id'] | null
  payable: boolean
  warrantor_id: MatchPlayer['user_id'] | null
  paid_at_merchant: boolean
  product_extras_info: ProductExtrasInfo | null
  applied_benefits_info: AppliedBenefit[] | null
  category_name: string | null
  preauthorized_payment_id: string | null
  preauthorized_payment_status: string | null
  customer_fee: string | null
  host_id: string | null
  mode: string
  payment_commission_model: string | null
  tenant_vat: number | null
  payable_by_player: boolean
  fixed_price: string | null
}

// Registration info
interface RegistrationInfo {
  payment_type: string
  registrations: Registration[]
  debt_status: string
  preauthorization_capture_process_status: string
  card_on_file_status: string
  payments_status: string
}

interface JoinRequest {
  status: 'OPEN' | 'CLOSED'
  requests: Array<{
    user_id: MatchPlayer['user_id']
    votes: Array<{
      user_id: MatchPlayer['user_id']
      approved: boolean
    }>
    status: 'APPROVED' | 'REJECTED' | 'PENDING' | 'CANCELED'
    level_value: number
    level_confidence: number
    voting_allowed: boolean
  }>
}

// Main padel match response
export interface PlaytomicApiMatch {
  match_id: string
  reservation_id: string | null
  lock_id: string | null
  recurring_match_configuration_id: string | null
  merchant_reservation_id: string | null
  location: string
  sport_id: string
  teams: Team[]
  min_players_per_team: number
  max_players_per_team: number
  owner_id: string | null
  status: 'PLAYED' | 'SCHEDULED' | 'CANCELLED' | string
  game_status: 'PLAYED' | 'SCHEDULED' | 'CANCELLED' | string
  results_status: 'WAITING_FOR' | 'CONFIRMED' | string
  results: ResultSet[]
  start_date: string
  end_date: string
  available_at: string | null
  validation_request_user_id: string | null
  validation_request_date: string | null
  reject_user_id: string | null
  rejection_date: string | null
  resource_name: string | null
  resource_id: string | null
  court_id: string | null
  tenant: Tenant | null
  location_info: LocationInfo
  match_type: string
  match_organization: string
  competition_mode: string
  merchant_match_id: string | null
  gender: string | null
  max_level: number | null
  min_level: number | null
  min_level_confidence: number | null
  registration_closing_time: string | null
  price: string | null
  payment_methods_allowed: string | null
  tags: string | null
  description: string | null
  private_notes: string | null
  visibility: string
  payment_required: boolean
  result_confirmation_user_id: string | null
  result_confirmation_date: string | null
  player_reviews: unknown
  merchant_access_code: string | null
  resource_properties: ResourceProperties
  cancellation_reason_code: string | null
  is_playtomic_managed: boolean
  registration_info: RegistrationInfo
  match_origin: string
  registration_type: string
  registration_status: string
  product_type: string
  join_requests_info: JoinRequest
  coach_id: string | null
  league_id: string | null
  is_premium: boolean
  is_booked: boolean
  created_at: string
  published_at: string | null
}

export interface PlaytomicApiUser
  extends Pick<MatchPlayer, 'user_id' | 'picture'> {
  full_name: string
  is_validated: boolean
  is_email_verified: boolean
  is_phone_verified: boolean
  bio: string
  communications_language: string
  country_code: string
  facebook_id: string | null
  privacy_profile: 'PUBLIC'
  is_premium: boolean
  tenant_tags: string[]
  email: string | null
  phone: string | null
}

// POST https://api.playtomic.io/v1/short_urls with Auth and { full_url: long_url } and reverse at GET https://api.playtomic.io/v1/short_urls/$short_url_id
export interface PlaytomicApiURL {
  short_url_id: string
  full_url: string
  short_url: string
  created_at: string
  expiration_date: string | null
}
