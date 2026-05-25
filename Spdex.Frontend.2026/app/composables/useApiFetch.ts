/**
 * Composable wrapping useFetch with the backend API base URL.
 * Automatically prepends the API base from runtime config.
 * Automatically injects Authorization header from auth cookie.
 * Handles 401 responses by redirecting to login page.
 * All composables should use this instead of raw useFetch.
 */
export function useApiFetch<T>(path: string | Ref<string>, opts: Record<string, unknown> = {}) {
  const config = useRuntimeConfig()
  const token = useCookie('spdex_token')

  return useFetch<T>(path, {
    baseURL: config.public.apiBase as string,
    onRequest({ options }: { options: { headers?: HeadersInit } }) {
      // 自动注入 Authorization header
      if (token.value) {
        const headers = new Headers(options.headers)
        headers.set('Authorization', `Bearer ${token.value}`)
        options.headers = headers
      }
    },
    onResponseError({ response }: { response: { status: number, _data?: { message?: string } } }) {
      // 401 未授权：token 过期或无效，跳转登录页
      if (response.status === 401) {
        const msg = response._data?.message ?? ''
        token.value = null

        // 区分被踢出和普通 token 过期
        if (msg.includes('已在其他')) {
          alert('您的账号已在其他设备登录，当前会话已失效，请重新登录。')
        }

        navigateTo('/login')
      }
    },
    ...opts,
  } as never)
}
