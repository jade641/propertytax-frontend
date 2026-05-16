import { AxiosError } from 'axios'
import api from './api'

interface ApiResponse<T> {
  success: boolean
  message: string
  data?: T
  errors?: string[]
}

export interface ProvinceOption {
  id: number
  psgcCode: string
  name: string
}

export interface CityMunicipalityOption {
  id: number
  provinceId: number
  psgcCode: string
  name: string
  lguType: string
}

export interface BarangayOption {
  id: number
  cityMunicipalityId: number
  psgcCode: string
  name: string
  cityMunicipalityName: string
  provinceName: string
}

const barangayNameCollator = new Intl.Collator('en', {
  numeric: true,
  sensitivity: 'base',
})

class LocationRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'LocationRequestError'
  }
}

function unwrapResponse<T>(payload: ApiResponse<T>): T {
  if (!payload.success || payload.data === undefined) {
    throw new LocationRequestError(payload.message || 'Location request failed.')
  }

  return payload.data
}

function normalizeApiError(error: unknown): never {
  if (error instanceof AxiosError) {
    const payload = error.response?.data as ApiResponse<unknown> | undefined
    throw new LocationRequestError(payload?.message ?? error.message ?? 'Location request failed.')
  }

  throw error instanceof Error ? new LocationRequestError(error.message) : new LocationRequestError('Location request failed.')
}

export async function getProvinces(): Promise<ProvinceOption[]> {
  try {
    const response = await api.get<ApiResponse<ProvinceOption[]>>('/location/provinces')
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function getCities(provinceId: number): Promise<CityMunicipalityOption[]> {
  try {
    const response = await api.get<ApiResponse<CityMunicipalityOption[]>>(`/location/cities/${provinceId}`)
    return unwrapResponse(response.data)
  } catch (error) {
    normalizeApiError(error)
  }
}

export async function searchBarangays(cityId: number, search: string): Promise<BarangayOption[]> {
  try {
    const response = await api.get<ApiResponse<BarangayOption[]>>('/location/barangays', {
      params: { cityId, search },
    })
    return unwrapResponse(response.data)
      .slice()
      .sort((left, right) => barangayNameCollator.compare(left.name, right.name))
  } catch (error) {
    normalizeApiError(error)
  }
}