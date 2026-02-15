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
    onResponseError({ response }: { response: { status: number } }) {
      // 401 未授权：token 过期或无效，跳转登录页
      if (response.status === 401) {
        token.value = null
        navigateTo('/login')
      }
    },
    ...opts,
  } as never)
}
