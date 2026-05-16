import { AxiosError } from 'axios'
import type { UserRole } from '../context/AuthContext'
import api from './api'

interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
}

export interface UserDto {
  id: string
  username: string
  email: string
  fullName: string
  role: UserRole | string
  isActive: boolean
  createdAtUtc: string
}

export interface CreateUserPayload {
  username: string
  email: string
  password: string
  fullName: string
  role: UserRole
  isActive: boolean
}

export interface UpdateUserPayload {
  username: string
  email: string
  fullName: string
  role: UserRole
  isActive: boolean
  password?: string
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
    const message = payload?.message ?? error.message ?? 'Request failed.'
    const errors = payload?.errors ?? []

    throw new ApiRequestError(message, errors)
  }

  if (error instanceof Error) {
    throw new ApiRequestError(error.message)
  }

  throw new ApiRequestError('Request failed.')
}

export function getApiErrorMessage(error: unknown): string {
  if (error instanceof ApiRequestError) {
    return error.errors.length > 0
      ? `${error.message} ${error.errors.join(' ')}`
      : error.message
  }

  return error instanceof Error ? error.message : 'Request failed.'
}

export async function getUsers(): Promise<UserDto[]> {
  try {
    const response = await api.get<ApiResponse<UserDto[]>>('/users')
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function createUser(payload: CreateUserPayload): Promise<UserDto> {
  try {
    const response = await api.post<ApiResponse<UserDto>>('/users', payload)
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function updateUser(id: string, payload: UpdateUserPayload): Promise<UserDto> {
  try {
    const response = await api.put<ApiResponse<UserDto>>(`/users/${id}`, payload)
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function deleteUser(id: string): Promise<void> {
  try {
    const response = await api.delete<ApiResponse<null>>(`/users/${id}`)

    if (!response.data.success) {
      throw new ApiRequestError(response.data.message, response.data.errors ?? [])
    }
  } catch (error) {
    normalizeApiError(error)
  }
}