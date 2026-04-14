import { apiClient } from './client'
import type {
  SessionDetail,
  SessionDetailApiResponse,
  SessionStatus,
  SessionSummary,
} from './types'

const toNum = (v: unknown, fallback = 0): number => {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v)
    return Number.isFinite(n) ? n : fallback
  }
  return fallback
}

/**
 * Maps GET /sessions/{id} body to UI model.
 * Backend puts trading params under `config`; `log_text` is at root.
 */
export const normalizeSessionDetail = (raw: unknown): SessionDetail => {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid session detail response')
  }
  const r = raw as SessionDetailApiResponse
  const c = r.config ?? {}

  const summary: SessionSummary = {
    id: String(r.id ?? ''),
    status: (r.status as SessionStatus) ?? 'pending',
    created_at: r.created_at ?? '',
    started_at: r.started_at,
    ended_at: r.ended_at,
    error_message: r.error_message,
  }

  return {
    ...summary,
    asset_id: c.asset_id != null && c.asset_id !== '' ? String(c.asset_id) : '',
    stake_pct: toNum(c.stake_pct, 0),
    session_target_pct: toNum(c.session_target_pct, 0),
    window: c.window ?? '',
    granularity: c.granularity ?? '',
    rolling_liquidity: Boolean(c.rolling_liquidity),
    rolling_scan_every_n_candles: toNum(c.rolling_scan_every_n_candles, 4),
    max_trades_per_session: c.max_trades_per_session != null ? toNum(c.max_trades_per_session, 1) : null,
    log_text: typeof r.log_text === 'string' ? r.log_text : '',
  }
}

export type CreateSessionPayload = {
  asset_id: string | number
  stake_pct: number
  session_target_pct: number
  window?: string
  granularity?: string
  rolling_liquidity?: boolean
  rolling_scan_every_n_candles: number
  max_trades_per_session?: number | null
}

export const sessionsApi = {
  createSession: async (payload: CreateSessionPayload) => {
    const { data } = await apiClient.post<SessionSummary>('/sessions', payload)
    return data
  },
  listSessions: async () => {
    const { data } = await apiClient.get<SessionSummary[]>('/sessions')
    return data
  },
  getSessionById: async (id: string) => {
    const { data } = await apiClient.get<SessionDetailApiResponse>(`/sessions/${id}`)
    return normalizeSessionDetail(data)
  },
  stopSession: async (id: string) => {
    await apiClient.post(`/sessions/${id}/stop`)
  },
}
