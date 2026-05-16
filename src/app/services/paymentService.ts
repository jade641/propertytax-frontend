import { AxiosError } from 'axios'
import api from './api'

interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
}

export interface PaymentDto {
  id: number
  propertyId: number
  taxpayerId?: number | null
  propertyPin?: string | null
  ownerName?: string | null
  barangay?: string | null
  taxYear: number
  quarter: string
  amountDue: number
  amountPaid: number
  paymentMethod: string
  referenceNumber?: string | null
  bankName?: string | null
  paymentDateUtc?: string | null
  dueDateUtc?: string | null
  status: string
  penalty: number
  officialReceiptNumber?: string | null
  notes?: string | null
  remainingBalance?: number | null
}

export interface PaymentQuoteDto {
  propertyId: number
  propertyPin: string
  ownerName: string
  taxYear: number
  quarter: string
  paymentDateUtc: string
  dueDateUtc: string
  annualTaxDue: number
  totalPaidToDate: number
  outstandingPrincipal: number
  quarterDue: number
  penalty: number
  payableAmount: number
  status: string
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

export async function getPaymentHistory(): Promise<PaymentDto[]> {
  try {
    const response = await api.get<ApiResponse<PaymentDto[]>>('/payment/history')
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function getPaymentQuote(propertyId: number, taxYear: number, quarter: string, paymentDateUtc?: string): Promise<PaymentQuoteDto> {
  try {
    const response = await api.get<ApiResponse<PaymentQuoteDto>>('/payment/quote', {
      params: { propertyId, taxYear, quarter, paymentDateUtc },
    })
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function recordPayment(payload: Omit<PaymentDto, 'id' | 'propertyPin' | 'ownerName' | 'remainingBalance'>): Promise<PaymentDto> {
  try {
    const response = await api.post<ApiResponse<PaymentDto>>('/payment', payload)
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}
