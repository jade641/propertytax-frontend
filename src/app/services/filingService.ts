import { AxiosError } from 'axios'
import api from './api'

interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
}

export interface PropertyDocumentDto {
  id: number
  propertyId: number
  propertyPin?: string | null
  fileName: string
  originalFileName: string
  relativePath: string
  contentType: string
  sizeInBytes: number
  folder: string
  uploadedAtUtc: string
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

export async function getDocuments(): Promise<PropertyDocumentDto[]> {
  try {
    const response = await api.get<ApiResponse<PropertyDocumentDto[]>>('/filing')
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function uploadDocument(propertyId: number, folder: string, file: File): Promise<PropertyDocumentDto> {
  try {
    const payload = new FormData()
    payload.append('propertyId', String(propertyId))
    payload.append('folder', folder)
    payload.append('file', file)

    const response = await api.post<ApiResponse<PropertyDocumentDto>>('/filing/upload', payload, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function deleteDocument(id: number): Promise<void> {
  try {
    const response = await api.delete<ApiResponse<null>>(`/filing/documents/${id}`)

    if (!response.data.success) {
      throw new ApiRequestError(response.data.message, response.data.errors ?? [])
    }
  } catch (error) {
    normalizeApiError(error)
  }
}
