/**
 * NewSpdex 认证状态管理 Composable。
 * 替代旧 useFakeAuth：
 *   - 使用真实 JWT（存 cookie）
 *   - 调 /api/newspdex/auth/{login,me,refresh}
 *   - 自动续期：剩余 < 10 分钟时刷新
 *   - 401/403 自动登出
 *   - 暴露 Entitlements / Tier 给组件
 */

import type { ApiResponse, AuthUser, LoginResponseData } from '~/types/auth'

const TOKEN_COOKIE = 'newspdex_token'

export interface AuthSubmitResult {
  /** 业务是否成功（已登录/已注册，token 已存）。 */
  ok: boolean
  /** 错误信息（ok=false 时）。 */
  error: string | null
  /** 是否因验证码校验失败（后端 code=4001）——验证码开启时据此让滑块重试。 */
  captchaFailed: boolean
}

function getTokenExp(jwt: string): number | null {
  try {
    const parts = jwt.split('.')
    if (parts.length !== 3) return null
    const payload = JSON.parse(atob(parts[1]!.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof payload.exp === 'number' ? payload.exp : null
  }
  catch {
    return null
  }
}

export function useAuth() {
  const config = useRuntimeConfig()
  const token = useCookie<string | null>(TOKEN_COOKIE, {
    maxAge: 60 * 60 * 24,
    sameSite: 'lax',
  })
  const user = useState<AuthUser | null>('newspdex_auth_user', () => null)
  const refreshTimer = useState<ReturnType<typeof setTimeout> | null>('newspdex_refresh_timer', () => null)
  const visibilityBound = useState('newspdex_visibility_bound', () => false)

  const isLoggedIn = computed(() => !!token.value)
  const tier = computed(() => user.value?.tier ?? 'Free')
  const entitlements = computed(() => user.value?.entitlements ?? null)
  const userName = computed(() => user.value?.userName ?? '')

  function tokenStatus(): 'ok' | 'need_refresh' | 'expired' {
    if (!token.value) return 'expired'
    const exp = getTokenExp(token.value)
    if (!exp) return 'expired'
    const nowSec = Math.floor(Date.now() / 1000)
    if (nowSec >= exp) return 'expired'
    if (exp - nowSec < 10 * 60) return 'need_refresh'
    return 'ok'
  }

  function scheduleRefresh() {
    if (import.meta.server) return

    if (refreshTimer.value) {
      clearTimeout(refreshTimer.value)
      refreshTimer.value = null
    }

    if (!token.value) return
    const exp = getTokenExp(token.value)
    if (!exp) return

    const nowSec = Math.floor(Date.now() / 1000)
    const remainMs = (exp - nowSec) * 1000
    const refreshIn = Math.max(remainMs - 10 * 60 * 1000, 0)

    refreshTimer.value = setTimeout(async () => {
      await refreshToken()
    }, refreshIn)

    if (!visibilityBound.value) {
      visibilityBound.value = true
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState !== 'visible') return
        const status = tokenStatus()
        if (status === 'expired') {
          const ok = await refreshToken()
          if (!ok && token.value) {
            token.value = null
            user.value = null
            navigateTo('/login')
          }
        }
        else if (status === 'need_refresh') {
          await refreshToken()
        }
      })
    }
  }

  async function refreshToken(): Promise<boolean> {
    if (!token.value) return false

    try {
      const res = await $fetch<ApiResponse<LoginResponseData>>('/api/newspdex/auth/refresh', {
        baseURL: config.public.apiBase as string,
        method: 'POST',
        headers: { Authorization: `Bearer ${token.value}` },
      })

      if (res.code === 0 && res.data) {
        token.value = res.data.token
        user.value = res.data.user
        scheduleRefresh()
        return true
      }

      token.value = null
      user.value = null
      navigateTo('/login')
      return false
    }
    catch (err: unknown) {
      const fetchErr = err as { statusCode?: number }
      if (fetchErr?.statusCode === 401 || fetchErr?.statusCode === 403) {
        token.value = null
        user.value = null
        navigateTo('/login')
      }
      return false
    }
  }

  async function login(loginName: string, password: string, captchaVerifyParam?: string): Promise<AuthSubmitResult> {
    try {
      const res = await $fetch<ApiResponse<LoginResponseData>>('/api/newspdex/auth/login', {
        baseURL: config.public.apiBase as string,
        method: 'POST',
        body: { userName: loginName, password, captchaVerifyParam },
      })

      if (res.code === 0 && res.data) {
        token.value = res.data.token
        user.value = res.data.user
        scheduleRefresh()
        return { ok: true, error: null, captchaFailed: false }
      }

      return { ok: false, error: res.message || '登录失败', captchaFailed: res.code === 4001 }
    }
    catch (err: unknown) {
      const fetchErr = err as { data?: { message?: string, code?: number } }
      return {
        ok: false,
        error: fetchErr?.data?.message || '登录失败，请检查用户名和密码',
        captchaFailed: fetchErr?.data?.code === 4001,
      }
    }
  }

  async function register(payload: {
    userName: string
    password: string
    email?: string
    mobile?: string
    nickName?: string
    captchaVerifyParam?: string
  }): Promise<AuthSubmitResult> {
    try {
      const res = await $fetch<ApiResponse<LoginResponseData>>('/api/newspdex/auth/register', {
        baseURL: config.public.apiBase as string,
        method: 'POST',
        body: payload,
      })

      if (res.code === 0 && res.data) {
        token.value = res.data.token
        user.value = res.data.user
        scheduleRefresh()
        return { ok: true, error: null, captchaFailed: false }
      }

      return { ok: false, error: res.message || '注册失败', captchaFailed: res.code === 4001 }
    }
    catch (err: unknown) {
      const fetchErr = err as { data?: { message?: string, code?: number } }
      return {
        ok: false,
        error: fetchErr?.data?.message || '注册失败，请稍后重试',
        captchaFailed: fetchErr?.data?.code === 4001,
      }
    }
  }

  function logout() {
    if (refreshTimer.value) {
      clearTimeout(refreshTimer.value)
      refreshTimer.value = null
    }
    token.value = null
    user.value = null
    navigateTo('/login')
  }

  async function fetchUser(): Promise<boolean> {
    if (!token.value) return false

    try {
      const res = await $fetch<ApiResponse<AuthUser>>('/api/newspdex/auth/me', {
        baseURL: config.public.apiBase as string,
        headers: { Authorization: `Bearer ${token.value}` },
      })

      if (res.code === 0 && res.data) {
        user.value = res.data
        scheduleRefresh()
        return true
      }

      token.value = null
      user.value = null
      return false
    }
    catch (err: unknown) {
      const fetchErr = err as { statusCode?: number }
      if (fetchErr?.statusCode === 401 || fetchErr?.statusCode === 403) {
        token.value = null
        user.value = null
      }
      return false
    }
  }

  return {
    token: readonly(token),
    user: readonly(user),
    isLoggedIn,
    tier,
    entitlements,
    userName,
    login,
    register,
    logout,
    fetchUser,
    refreshToken,
  }
}
