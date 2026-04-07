import { apiClient } from './client'

const parseFilename = (header?: string | null) => {
  if (!header) return null
  const utfMatch = header.match(/filename\*=UTF-8''([^;]+)/i)
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1])
  const match = header.match(/filename="?([^"]+)"?/i)
  return match?.[1] ?? null
}

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

const runDownload = async (path: string, fallbackName: string) => {
  const response = await apiClient.get(path, { responseType: 'blob' })
  const disposition = response.headers['content-disposition']
  const filename = parseFilename(disposition) || fallbackName
  downloadBlob(response.data, filename)
}

export const exportsApi = {
  downloadLogs: (sessionId: string) =>
    runDownload(`/sessions/${sessionId}/export/logs`, `session-${sessionId}-logs.txt`),
  downloadLiquidity: (sessionId: string) =>
    runDownload(`/sessions/${sessionId}/export/liquidity.csv`, `session-${sessionId}-liquidity.csv`),
  downloadTracks: (sessionId: string) =>
    runDownload(`/sessions/${sessionId}/export/tracks.csv`, `session-${sessionId}-tracks.zip`),
  downloadOrders: (sessionId: string) =>
    runDownload(`/sessions/${sessionId}/export/orders.csv`, `session-${sessionId}-orders.csv`),
}
