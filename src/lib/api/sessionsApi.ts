import { apiClient } from './client'
import type { SessionDetail, SessionSummary } from './types'

export type CreateSessionPayload = {
  asset_id: string | number
  stake_pct: number
  session_target_pct: number
  window?: string
  granularity?: string
  aggregate?: boolean
  rolling_liquidity?: boolean
  pg?: string | null
  tick_chunk_cooldown: number
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
    const { data } = await apiClient.get<SessionDetail>(`/sessions/${id}`)
    return data
  },
  stopSession: async (id: string) => {
    await apiClient.post(`/sessions/${id}/stop`)
  },
}
