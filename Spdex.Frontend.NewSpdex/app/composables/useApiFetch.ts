/**
 * NewSpdex 前端统一 fetch 封装。
 * 1. baseURL 自动取 runtime config 的 apiBase（默认 http://localhost:5010）
 * 2. 使用 HttpOnly cookie 会话，自动携带 credentials
 * 3. 401 自动清除本地登录提示 + 跳 /login
 * 4. 单点登录被踢出（"已在其他设备登录"）提示后再跳
 */

export function useApiFetch<T>(
  path: string | Ref<string> | (() => string),
  opts: Record<string, unknown> = {},
) {
  const config = useRuntimeConfig()
  const token = useNewSpdexTokenCookie()
  const sessionHint = useNewSpdexSessionHintCookie()
  const authVersion = useState<number>('newspdex_auth_version', () => 0)
  const fetchOpts = withAuthVersionWatch(opts, authVersion)

  return useFetch<T>(path as never, {
    ...fetchOpts,
    baseURL: config.public.apiBase as string,
    credentials: 'include',
    onResponseError({ response }: { response: { status: number, _data?: { message?: string } } }) {
      if (response.status === 401) {
        const msg = response._data?.message ?? ''
        token.value = null
        sessionHint.value = null

        if (typeof window !== 'undefined' && msg.includes('已在其他')) {
          alert('您的账号已在其他设备登录，当前会话已失效，请重新登录。')
        }

        navigateTo('/login')
      }
    },
  } as never)
}

function withAuthVersionWatch(opts: Record<string, unknown>, authVersion: Ref<number>) {
  const merged = { ...opts }
  const existingWatch = merged.watch
  if (existingWatch !== false) {
    merged.watch = Array.isArray(existingWatch)
      ? [...existingWatch, authVersion]
      : existingWatch
        ? [existingWatch, authVersion]
        : [authVersion]
  }
  return merged
}

/**
 * $fetch 变体（命令式，用于 onClick、watch 等场景）。
 */
export function $apiFetch<T>(path: string, opts: Record<string, unknown> = {}): Promise<T> {
  const config = useRuntimeConfig()
  const token = useNewSpdexTokenCookie()
  const sessionHint = useNewSpdexSessionHintCookie()

  return $fetch<T>(path, {
    ...opts,
    baseURL: config.public.apiBase as string,
    credentials: 'include',
    onResponseError({ response }: { response: { status: number, _data?: { message?: string } } }) {
      if (response.status === 401) {
        token.value = null
        sessionHint.value = null
        navigateTo('/login')
      }
    },
  } as never)
}
