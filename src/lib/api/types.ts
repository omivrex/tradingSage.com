export type ApiErrorResponse = {
  detail?: string
  message?: string
}

export type AuthResponse = {
  access_token: string
  token_type: string
}

export type UserMe = {
  id: string
  username: string
  email: string
}

export type UserAsset = {
  id: string
  symbol: string
  display_name: string
  source: string
}

export type CatalogAsset = {
  id: string
  symbol: string
  display_name: string
  source: string
}

export type SessionStatus = 'pending' | 'running' | 'stopped' | 'completed' | 'failed'

export type SessionSummary = {
  id: string
  status: SessionStatus
  created_at: string
  started_at: string | null
  ended_at: string | null
  error_message: string | null
}

export type SessionDetail = SessionSummary & {
  asset_id: string
  stake_pct: number
  session_target_pct: number
  window: string
  granularity: string
  aggregate: boolean
  rolling_liquidity: boolean
  pg: string | null
  tick_chunk_cooldown: number
  log_text: string
}
