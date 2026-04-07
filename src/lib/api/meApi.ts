import { apiClient } from './client'
import type { UserAsset, UserMe } from './types'

export const meApi = {
  getMe: async () => {
    const { data } = await apiClient.get<UserMe>('/me')
    return data
  },
  updateDerivKey: async (deriv_api_token: string) => {
    await apiClient.put('/me/deriv-key', { deriv_api_token })
  },
  getMyAssets: async () => {
    const { data } = await apiClient.get<UserAsset[]>('/me/assets')
    return data
  },
  updateMyAssets: async (asset_symbols: string[]) => {
    await apiClient.put('/me/assets', { asset_symbols })
  },
}
