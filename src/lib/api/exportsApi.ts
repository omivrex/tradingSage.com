import { apiClient } from './client'
import type { ApiErrorResponse } from './types'

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

type ExportStartResponse = {
  job_id?: string
  jobId?: string
  id?: string
}

export type ExportJobStatusResponse = {
  status: 'queued' | 'running' | 'ready' | 'error' | string
  error_message?: string | null
}

const runDownload = async (path: string, fallbackName: string) => {
  const response = await apiClient.get(path, {
    responseType: 'blob',
    timeout: 600000,
  })
  const disposition = response.headers['content-disposition']
  const filename = parseFilename(disposition) || fallbackName
  downloadBlob(response.data, filename)
}

export const exportsApi = {
  startBundleExport: async (sessionId: string) => {
    const { data } = await apiClient.post<ExportStartResponse>(
      `/sessions/${sessionId}/export/bundle.zip`,
      undefined,
      { timeout: 30000 },
    )
    const jobId = data.job_id || data.jobId || data.id
    if (!jobId) {
      throw new Error('Failed to start export: missing job id in response')
    }
    return jobId
  },
  getBundleExportJob: async (sessionId: string, jobId: string) => {
    const { data } = await apiClient.get<ExportJobStatusResponse | ApiErrorResponse>(
      `/sessions/${sessionId}/export/jobs/${jobId}`,
      { timeout: 30000 },
    )
    const typed = data as ExportJobStatusResponse
    return {
      status: typed.status || 'error',
      error_message: typed.error_message ?? null,
    }
  },
  downloadBundleZip: async (sessionId: string, jobId: string) =>
    runDownload(
      `/sessions/${sessionId}/export/jobs/${jobId}/download`,
      `session-${sessionId}-bundle.zip`,
    ),
}
