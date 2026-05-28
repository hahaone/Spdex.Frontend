export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  traceId?: string
}

export interface PaginatedResult<T> {
  items: T[]
  totalCount: number
  page: number
  pageSize: number
}

export type BottomNavKey = 'football' | 'basketball' | 'live' | 'home' | 'volume' | 'signals' | 'account'
