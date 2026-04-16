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
  rolling_liquidity: boolean
  rolling_scan_every_n_candles: number
  max_trades_per_session: number | null
  imbalance_unfavorable_tick_count: number | null
  log_text: string
}

/**
 * GET /sessions/{id} response shape (see backend).
 * Session parameters live under `config`; logs at root `log_text`.
 */
export type SessionConfigApi = {
  window?: string
  asset_id?: number | string
  stake_pct?: number
  granularity?: string
  rolling_liquidity?: boolean
  rolling_scan_every_n_candles?: number
  max_trades_per_session?: number | null
  imbalance_unfavorable_tick_count?: number | null
  session_target_pct?: number
  // legacy keys kept for backward compatibility on old sessions
  aggregate?: boolean
  pg?: string | null
  tick_chunk_cooldown?: number
}

export type SessionDetailApiResponse = {
  id: number | string
  user_id?: number
  status: string
  config?: SessionConfigApi
  created_at: string
  started_at: string | null
  ended_at: string | null
  error_message: string | null
  rq_job_id?: string
  log_text: string
}
