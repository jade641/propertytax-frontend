import { AxiosError } from 'axios'
import { jwtDecode } from 'jwt-decode'
import api from './api'

export type UserRole = 'Admin' | 'Staff' | 'Accountant' | 'Auditor'

export interface AuthenticatedUser {
  username: string
  displayName: string
  email: string
  role: UserRole
}

export interface LoginCredentials {
  username: string
  password: string
}

export interface ChangePasswordPayload {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
}

interface DecodedToken {
  sub?: string
  name?: string
  email?: string
  preferred_username?: string
  unique_name?: string
  role?: string | string[]
  roles?: string | string[]
  'http://schemas.microsoft.com/ws/2008/06/identity/claims/role'?: string | string[]
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'?: string | string[]
  'http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress'?: string
}

interface LoginResponse {
  token?: string
  accessToken?: string
  jwt?: string
  data?: {
    token?: string
    accessToken?: string
    jwt?: string
  }
}

class AuthRequestError extends Error {
  readonly errors: string[]

  constructor(message: string, errors: string[] = []) {
    super(message)
    this.name = 'AuthRequestError'
    this.errors = errors
  }
}

export const TOKEN_STORAGE_KEY = 'taxsync.token'
const USER_STORAGE_KEY = 'taxsync.user'

const roleMap: Record<string, UserRole> = {
  admin: 'Admin',
  staff: 'Staff',
  accountant: 'Accountant',
  auditor: 'Auditor',
}

function normalizeRole(candidate: unknown): UserRole | null {
  if (Array.isArray(candidate)) {
    for (const value of candidate) {
      const normalized = normalizeRole(value)

      if (normalized) {
        return normalized
      }
    }

    return null
  }

  if (typeof candidate !== 'string') {
    return null
  }

  return roleMap[candidate.trim().toLowerCase()] ?? null
}

function extractRole(decodedToken: DecodedToken): UserRole | null {
  return normalizeRole(decodedToken.role)
    ?? normalizeRole(decodedToken.roles)
    ?? normalizeRole(decodedToken['http://schemas.microsoft.com/ws/2008/06/identity/claims/role'])
    ?? normalizeRole(decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/role'])
}

function parseTokenFromResponse(payload: LoginResponse | null | undefined): string | null {
  return payload?.token
    ?? payload?.accessToken
    ?? payload?.jwt
    ?? payload?.data?.token
    ?? payload?.data?.accessToken
    ?? payload?.data?.jwt
    ?? null
}

export function decodeUserFromToken(token: string): AuthenticatedUser {
  const decodedToken = jwtDecode<DecodedToken>(token)
  const role = extractRole(decodedToken)

  if (!role) {
    throw new Error('The JWT token does not include a supported TaxSync role claim.')
  }

  const username = decodedToken.preferred_username
    ?? decodedToken.unique_name
    ?? decodedToken.sub
    ?? decodedToken.email
    ?? 'taxsync.user'

  return {
    username,
    displayName: decodedToken.name ?? username,
    email: decodedToken.email
      ?? decodedToken['http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress']
      ?? `${username}@taxsync.local`,
    role,
  }
}

export async function loginRequest(credentials: LoginCredentials): Promise<string> {
  try {
    const response = await api.post<LoginResponse>('/auth/login', credentials)
    const token = parseTokenFromResponse(response.data)

    if (!token) {
      throw new Error('The login response did not include a JWT token.')
    }

    return token
  } catch (error) {
    normalizeAuthError(error)
  }
}

function normalizeAuthError(error: unknown): never {
  if (error instanceof AuthRequestError) {
    throw error
  }

  if (error instanceof AxiosError) {
    if (!error.response || [502, 503, 504].includes(error.response.status)) {
      throw new AuthRequestError('TaxSync API is not reachable. Please start the backend service and try again.')
    }

    const payload = error.response?.data as ApiResponse<unknown> | undefined
    throw new AuthRequestError(payload?.message ?? error.message ?? 'Request failed.', payload?.errors ?? [])
  }

  if (error instanceof Error) {
    throw new AuthRequestError(error.message)
  }

  throw new AuthRequestError('Request failed.')
}

export function getAuthApiErrorMessage(error: unknown): string {
  if (error instanceof AuthRequestError) {
    return error.errors.length > 0
      ? `${error.message} ${error.errors.join(' ')}`
      : error.message
  }

  return error instanceof Error ? error.message : 'Request failed.'
}

export async function changePasswordRequest(payload: ChangePasswordPayload): Promise<string> {
  try {
    const response = await api.post<ApiResponse<null>>('/auth/change-password', payload)

    if (!response.data.success) {
      throw new AuthRequestError(response.data.message || 'Password change failed.', response.data.errors ?? [])
    }

    return response.data.message || 'Password updated successfully.'
  } catch (error) {
    normalizeAuthError(error)
  }
}

export function persistAuth(token: string, user: AuthenticatedUser) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
  window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
}

export function clearStoredAuth() {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  window.localStorage.removeItem(USER_STORAGE_KEY)
}

export function readStoredAuth(): { token: string; user: AuthenticatedUser } | null {
  if (typeof window === 'undefined') {
    return null
  }

  const token = window.localStorage.getItem(TOKEN_STORAGE_KEY)

  if (!token) {
    return null
  }

  try {
    const rawUser = window.localStorage.getItem(USER_STORAGE_KEY)
    const user = rawUser ? (JSON.parse(rawUser) as AuthenticatedUser) : decodeUserFromToken(token)

    if (!user.role) {
      throw new Error('Stored user data is missing a role.')
    }

    return { token, user }
  } catch {
    clearStoredAuth()
    return null
  }
}