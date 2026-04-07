import { apiClient } from './client'
import type { CatalogAsset } from './types'

export const assetsApi = {
  getCatalogAssets: async () => {
    const { data } = await apiClient.get<CatalogAsset[]>('/assets')
    return data
  },
}
