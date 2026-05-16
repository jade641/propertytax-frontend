import { AxiosError } from 'axios'
import api from './api'

interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
}

export interface TaxDto {
  id: number
  propertyId: number
  propertyPin?: string | null
  ownerName?: string | null
  taxYear: number
  marketValue?: number | null
  assessmentLevel?: number | null
  taxRate?: number | null
  assessedValue: number
  taxDue: number
  createdAtUtc?: string | null
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

export async function getTaxAssessments(): Promise<TaxDto[]> {
  try {
    const response = await api.get<ApiResponse<TaxDto[]>>('/tax/assessments')
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function calculateTax(payload: Omit<TaxDto, 'id' | 'propertyPin' | 'ownerName' | 'assessedValue' | 'taxDue' | 'createdAtUtc'>): Promise<TaxDto> {
  try {
    const response = await api.post<ApiResponse<TaxDto>>('/tax/calculate', payload)
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}
