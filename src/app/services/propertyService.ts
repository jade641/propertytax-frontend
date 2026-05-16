import { AxiosError } from 'axios'
import api from './api'

interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
}

export interface PropertyDto {
  id: number
  taxpayerId?: number
  provinceId?: number | null
  cityMunicipalityId?: number | null
  barangayId?: number | null
  ownerName: string
  ownerEmail?: string | null
  ownerPhone?: string | null
  ownerAddress?: string | null
  taxIdentificationNumber?: string | null
  pin: string
  taxDeclarationNumber?: string | null
  barangay: string
  municipality: string
  address: string
  propertyType: string
  lotNumber: string
  areaSquareMeters: number
  marketValue: number
  assessmentLevel: number
  taxRate: number
  zoningClassification?: string | null
  remarks?: string | null
  status: string
  dateRegisteredUtc?: string | null
}

export interface RegisterPropertyPayload {
  ownerName: string
  ownerEmail?: string
  ownerPhone?: string
  ownerAddress?: string
  taxIdentificationNumber?: string
  provinceId: number
  cityMunicipalityId: number
  barangayId: number
  propertyType: string
  lotNumber: string
  areaSquareMeters: number
  marketValue: number
  taxDeclarationNumber?: string
  zoningClassification?: string
  remarks?: string
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

export async function getProperties(): Promise<PropertyDto[]> {
  try {
    const response = await api.get<ApiResponse<PropertyDto[]>>('/property')
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function createProperty(payload: Omit<PropertyDto, 'id'>): Promise<PropertyDto> {
  try {
    const response = await api.post<ApiResponse<PropertyDto>>('/property', payload)
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function registerProperty(payload: RegisterPropertyPayload): Promise<PropertyDto> {
  try {
    const response = await api.post<ApiResponse<PropertyDto>>('/property/register', payload)
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function updateProperty(id: number, payload: Omit<PropertyDto, 'id'>): Promise<PropertyDto> {
  try {
    const response = await api.put<ApiResponse<PropertyDto>>(`/property/${id}`, payload)
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function deleteProperty(id: number): Promise<void> {
  try {
    const response = await api.delete<ApiResponse<null>>(`/property/${id}`)

    if (!response.data.success) {
      throw new ApiRequestError(response.data.message, response.data.errors ?? [])
    }
  } catch (error) {
    normalizeApiError(error)
  }
}
