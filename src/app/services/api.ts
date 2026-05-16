import axios from 'axios'

const productionApiBaseUrl = 'https://propertytax-backend.onrender.com/api'
const defaultApiBaseUrl = import.meta.env.DEV ? '/api' : productionApiBaseUrl

export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? defaultApiBaseUrl).replace(/\/$/, '')

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

api.interceptors.request.use((config) => {
  if (typeof window === 'undefined') {
    return config
  }

  const token = window.localStorage.getItem('taxsync.token')

  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }

  return config
})

export default api