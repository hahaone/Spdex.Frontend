/**
 * NewSpdex 前端统一 fetch 封装。
 * 1. baseURL 自动取 runtime config 的 apiBase（默认 http://localhost:5010）
 * 2. 自动注入 Authorization: Bearer <token>
 * 3. 401 自动清除 token + 跳 /login
 * 4. 单点登录被踢出（"已在其他设备登录"）提示后再跳
 */

export function useApiFetch<T>(
  path: string | Ref<string> | (() => string),
  opts: Record<string, unknown> = {},
) {
  const config = useRuntimeConfig()
  const token = useNewSpdexTokenCookie()

  return useFetch<T>(path as never, {
    baseURL: config.public.apiBase as string,
    onRequest({ options }: { options: { headers?: HeadersInit } }) {
      if (token.value) {
        const headers = new Headers(options.headers)
        headers.set('Authorization', `Bearer ${token.value}`)
        options.headers = headers
      }
    },
    onResponseError({ response }: { response: { status: number, _data?: { message?: string } } }) {
      if (response.status === 401) {
        const msg = response._data?.message ?? ''
        token.value = null

        if (typeof window !== 'undefined' && msg.includes('已在其他')) {
          alert('您的账号已在其他设备登录，当前会话已失效，请重新登录。')
        }

        navigateTo('/login')
      }
    },
    ...opts,
  } as never)
}

/**
 * $fetch 变体（命令式，用于 onClick、watch 等场景）。
 */
export function $apiFetch<T>(path: string, opts: Record<string, unknown> = {}): Promise<T> {
  const config = useRuntimeConfig()
  const token = useNewSpdexTokenCookie()

  return $fetch<T>(path, {
    baseURL: config.public.apiBase as string,
    onRequest({ options }: { options: { headers?: HeadersInit } }) {
      if (token.value) {
        const headers = new Headers(options.headers)
        headers.set('Authorization', `Bearer ${token.value}`)
        options.headers = headers
      }
    },
    onResponseError({ response }: { response: { status: number, _data?: { message?: string } } }) {
      if (response.status === 401) {
        token.value = null
        navigateTo('/login')
      }
    },
    ...opts,
  } as never)
}
