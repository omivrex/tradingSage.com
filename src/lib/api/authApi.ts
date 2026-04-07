import { apiClient } from './client'
import type { AuthResponse } from './types'

export type RegisterPayload = {
  username: string
  email: string
  password: string
  deriv_api_token: string
}

export type LoginPayload = {
  username: string
  password: string
}

export const authApi = {
  register: async (payload: RegisterPayload) => {
    await apiClient.post('/auth/register', payload)
  },
  login: async (payload: LoginPayload) => {
    const { data } = await apiClient.post<AuthResponse>('/auth/login', payload)
    return data
  },
}
