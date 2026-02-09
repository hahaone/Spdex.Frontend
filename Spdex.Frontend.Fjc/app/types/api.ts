/**
 * Shared API response & model types.
 * Add types matching Spdex.WebApi DTOs here as the project grows.
 */

/** Standard paginated response from backend */
export interface PaginatedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

/** Standard API error response */
export interface ApiError {
  status: number
  message: string
  errors?: Record<string, string[]>
}
