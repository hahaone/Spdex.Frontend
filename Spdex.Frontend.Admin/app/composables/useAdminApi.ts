export interface ApiResponse<T> {
  code: number
  message: string
  data: T | null
}

/** 统一后台 API 客户端：调本地 BFF /api/admin/*，BFF 注入 Bearer 转发后端。 */
export function useAdminApi() {
  async function request<T>(path: string, opts: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
    try {
      return await $fetch<ApiResponse<T>>(`/api/admin/${path.replace(/^\/+/, '')}`, opts)
    }
    catch (e: unknown) {
      const err = e as { response?: { status?: number }, data?: { message?: string }, message?: string }
      return {
        code: err?.response?.status ?? 500,
        message: err?.data?.message || err?.message || '请求失败',
        data: null,
      }
    }
  }

  return {
    get: <T>(path: string, query?: Record<string, unknown>) => request<T>(path, { method: 'GET', query }),
    post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
    put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
    del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
  }
}
