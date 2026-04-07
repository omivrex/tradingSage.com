import axios, { AxiosError } from 'axios'
import { enqueueSnackbar } from 'notistack'
import { clearAuthToken, getAuthToken } from '../../store/authStore'
import { runUnauthorizedHandler } from '../navigation'
import type { ApiErrorResponse } from './types'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL,
})

export const getApiErrorMessage = (error: unknown) => {
  const fallback = 'Request failed. Please try again.'
  if (!axios.isAxiosError(error)) return fallback
  const response = error.response?.data as ApiErrorResponse | undefined
  return response?.detail || response?.message || error.message || fallback
}

apiClient.interceptors.request.use((config) => {
  const token = getAuthToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    const status = error.response?.status
    if (status === 401) {
      clearAuthToken()
      runUnauthorizedHandler()
      enqueueSnackbar('Session expired. Please login again.', { variant: 'warning' })
      return Promise.reject(error)
    }

    if (status && status >= 400) {
      enqueueSnackbar(getApiErrorMessage(error), { variant: 'error' })
    }

    return Promise.reject(error)
  },
)
