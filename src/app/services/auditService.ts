import { AxiosError } from 'axios'
import api from './api'

interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
}

export interface AuditLogDto {
  id: number
  action: string
  userId?: string | null
  timestamp: string
  entityName?: string | null
  entityId?: string | null
  performedByUserId?: string | null
  performedByUsername?: string | null
  userRole?: string | null
  ipAddress?: string | null
  description?: string | null
  succeeded: boolean
  createdAtUtc: string
}

export class ApiRequestError extends Error {
  readonly errors: string[]

  constructor(message: string, errors: string[] = []) {
    super(message)
    this.name = 'ApiRequestError'
    this.errors = errors
  }
}

function unwrapResponse<T>(payload: ApiResponse<T>): T {
  if (!payload.success || payload.data === undefined) {
    throw new ApiRequestError(payload.message || 'Request failed.', payload.errors ?? [])
  }

  return payload.data
}

function normalizeApiError(error: unknown): never {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as ApiResponse<unknown> | undefined
    throw new ApiRequestError(payload?.message ?? error.message ?? 'Request failed.', payload?.errors ?? [])
  }

  throw error instanceof Error ? new ApiRequestError(error.message) : new ApiRequestError('Request failed.')
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.errors.length > 0 ? `${error.message} ${error.errors.join(' ')}` : error.message
  }

  return error instanceof Error ? error.message : 'Request failed.'
}

export async function getAuditLogs(): Promise<AuditLogDto[]> {
  try {
    const response = await api.get<ApiResponse<AuditLogDto[]>>('/audit/logs')
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}