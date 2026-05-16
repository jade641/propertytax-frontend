import { AxiosError } from 'axios'
import api from './api'

interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
}

type ReportDataset = {
  label: string
  data: number[]
}

export interface CollectionsReportResponse {
  labels: string[]
  datasets: ReportDataset[]
  summary: {
    totalDue: number
    totalCollected: number
    totalPayments: number
  }
  byBarangay: Array<{
    barangay: string
    totalDue: number
    totalCollected: number
  }>
}

export interface DelinquencyReportResponse {
  labels: string[]
  datasets: ReportDataset[]
  byBarangay: Array<{
    barangay: string
    compliant: number
    late: number
    unpaid: number
    outstandingBalance: number
  }>
  summary: {
    totalDue: number
    totalPaid: number
    outstandingBalance: number
    compliantCount: number
    lateCount: number
    unpaidCount: number
  }
}

export interface PropertiesReportResponse {
  byType: Array<{
    type: string
    count: number
    totalMarketValue: number
  }>
  byBarangay: Array<{
    barangay: string
    count: number
    totalMarketValue: number
  }>
  summary: {
    totalProperties: number
    totalMarketValue: number
    totalAssessedValue: number
  }
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

export async function getCollectionsReport(): Promise<CollectionsReportResponse> {
  try {
    const response = await api.get<ApiResponse<CollectionsReportResponse>>('/report/collections')
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function getDelinquencyReport(): Promise<DelinquencyReportResponse> {
  try {
    const response = await api.get<ApiResponse<DelinquencyReportResponse>>('/report/delinquency')
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function getPropertiesReport(): Promise<PropertiesReportResponse> {
  try {
    const response = await api.get<ApiResponse<PropertiesReportResponse>>('/report/properties')
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}