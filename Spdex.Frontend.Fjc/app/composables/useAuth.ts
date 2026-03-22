/**
 * 认证状态管理 Composable。
 * 管理 JWT token 存储、登录/登出、当前用户信息、令牌激活、自动续期。
 * 使用 useCookie 存储 token，兼容 SSR。
 */

interface AuthUser {
  userId: number
  userName: string
  roleId: number
  roleName: string
  endDate: string | null
  tokenType: string | null
}

interface LoginResponse {
  code: number
  message: string
  data: {
    token: string
    expiresAt: string
    user: AuthUser
  } | null
}

interface MeResponse {
  code: number
  message: string
  data: AuthUser | null
}

interface ActivateTokenResponse {
  code: number
  message: string
  data: {
    token: string
    expiresAt: string
    tokenType: string
  } | null
}

/** Cookie 名称 */
const TOKEN_COOKIE = 'spdex_token'

/**
 * 解析 JWT payload 中的 exp 字段（秒级 Unix 时间戳）。
 * 不验证签名，仅读取过期时间用于刷新判断。
 */
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
  const token = useCookie(TOKEN_COOKIE, { maxAge: 60 * 60 * 24 }) // 1 day
  const user = useState<AuthUser | null>('auth_user', () => null)

  /** 刷新定时器 ID（仅客户端） */
  const refreshTimer = useState<ReturnType<typeof setTimeout> | null>('auth_refresh_timer', () => null)

  const isLoggedIn = computed(() => !!token.value)

  /** 令牌是否已激活 */
  const isActivated = computed(() => !!user.value?.tokenType)

  /** 是否仅限竞彩 */
  const isJcOnly = computed(() => user.value?.tokenType === 'jc')

  /** visibilitychange 是否已注册 */
  const visibilityBound = useState('auth_visibility_bound', () => false)

  /**
   * 检查当前 token 是否即将过期（剩余 < 10 分钟）或已过期。
   * 返回 'ok' | 'need_refresh' | 'expired'
   */
  function tokenStatus(): 'ok' | 'need_refresh' | 'expired' {
    if (!token.value) return 'expired'
    const exp = getTokenExp(token.value)
    if (!exp) return 'expired'
    const nowSec = Math.floor(Date.now() / 1000)
    if (nowSec >= exp) return 'expired'
    if (exp - nowSec < 10 * 60) return 'need_refresh'
    return 'ok'
  }

  /**
   * 根据当前 JWT 的 exp 安排一个自动刷新定时器。
   * 在距离过期还剩 10 分钟时触发刷新。
   * 同时注册 visibilitychange 监听：浏览器标签页从后台切回前台时，
   * 立即检查 token 有效期并按需刷新，避免 setTimeout 被冻结导致掉线。
   */
  function scheduleRefresh() {
    // 仅在客户端执行
    if (import.meta.server) return

    // 清除旧的定时器
    if (refreshTimer.value) {
      clearTimeout(refreshTimer.value)
      refreshTimer.value = null
    }

    if (!token.value) return

    const exp = getTokenExp(token.value)
    if (!exp) return

    // 距离过期还有多少毫秒
    const nowSec = Math.floor(Date.now() / 1000)
    const remainMs = (exp - nowSec) * 1000

    // 提前 10 分钟刷新；如果剩余不足 10 分钟，立即刷新
    const refreshIn = Math.max(remainMs - 10 * 60 * 1000, 0)

    refreshTimer.value = setTimeout(async () => {
      await refreshToken()
    }, refreshIn)

    // 注册 visibilitychange 监听（只绑定一次）
    if (!visibilityBound.value) {
      visibilityBound.value = true
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState !== 'visible') return
        const status = tokenStatus()
        if (status === 'expired') {
          // token 已过期，尝试刷新；失败则不强制踢出，让路由守卫处理
          const ok = await refreshToken()
          if (!ok && token.value) {
            // token 存在但过期且刷新失败 → 清除登录态
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

  /**
   * 调用后端 /api/auth/refresh 获取新 JWT。
   * 成功后更新 cookie、用户信息，并安排下一次刷新。
   * 失败则清除登录态。
   */
  async function refreshToken(): Promise<boolean> {
    if (!token.value) return false

    try {
      const res = await $fetch<LoginResponse>('/api/auth/refresh', {
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

      // 刷新失败（权限变更、令牌撤销等）
      token.value = null
      user.value = null
      navigateTo('/login')
      return false
    }
    catch (err: unknown) {
      const fetchErr = err as { statusCode?: number }
      // 401/403 → 权限失效（过期、禁用、会籍变更等），清除登录态
      if (fetchErr?.statusCode === 401 || fetchErr?.statusCode === 403) {
        token.value = null
        user.value = null
        navigateTo('/login')
      }
      // 其他错误（网络故障等）→ 不踢出
      return false
    }
  }

  /**
   * 登录：调用后端 /api/auth/login，成功后存储 token 和用户信息。
   * @returns 错误信息，成功时返回 null
   */
  async function login(userName: string, password: string): Promise<string | null> {
    try {
      const res = await $fetch<LoginResponse>('/api/auth/login', {
        baseURL: config.public.apiBase as string,
        method: 'POST',
        body: { userName, password },
      })

      if (res.code === 0 && res.data) {
        token.value = res.data.token
        user.value = res.data.user
        scheduleRefresh()
        return null
      }

      return res.message || '登录失败'
    }
    catch (err: unknown) {
      // $fetch 会对非 2xx 响应抛出错误
      const fetchErr = err as { data?: { message?: string }, statusCode?: number }
      return fetchErr?.data?.message || '登录失败，请检查用户名和密码'
    }
  }

  /**
   * 登出：清除 token 和用户信息，跳转登录页
   */
  function logout() {
    if (refreshTimer.value) {
      clearTimeout(refreshTimer.value)
      refreshTimer.value = null
    }
    token.value = null
    user.value = null
    navigateTo('/login')
  }

  /**
   * 获取当前用户信息（验证 token 有效性）
   */
  async function fetchUser(): Promise<boolean> {
    if (!token.value) return false

    try {
      const res = await $fetch<MeResponse>('/api/auth/me', {
        baseURL: config.public.apiBase as string,
        headers: { Authorization: `Bearer ${token.value}` },
      })

      if (res.code === 0 && res.data) {
        user.value = res.data
        scheduleRefresh()
        return true
      }

      // token 无效或权限变更
      token.value = null
      user.value = null
      return false
    }
    catch (err: unknown) {
      const fetchErr = err as { statusCode?: number }
      if (fetchErr?.statusCode === 401) {
        // 401 说明 token 确实无效，尝试刷新
        const refreshed = await refreshToken()
        if (refreshed) {
          // 刷新成功后重新获取用户信息
          try {
            const res2 = await $fetch<MeResponse>('/api/auth/me', {
              baseURL: config.public.apiBase as string,
              headers: { Authorization: `Bearer ${token.value}` },
            })
            if (res2.code === 0 && res2.data) {
              user.value = res2.data
              return true
            }
          }
          catch { /* 刷新后仍失败，走下面清除逻辑 */ }
        }
        token.value = null
        user.value = null
        return false
      }
      if (fetchErr?.statusCode === 403) {
        // 403 说明会籍过期或权限变更，清除登录态
        token.value = null
        user.value = null
        return false
      }
      // 网络错误等其他情况 → 不清除 token，保留登录态
      return false
    }
  }

  /**
   * 激活令牌：调用后端 /api/auth/activate-token，成功后更新 JWT 和用户状态。
   * @returns 错误信息，成功时返回 null
   */
  async function activateToken(code: string): Promise<string | null> {
    try {
      const res = await $fetch<ActivateTokenResponse>('/api/auth/activate-token', {
        baseURL: config.public.apiBase as string,
        method: 'POST',
        headers: { Authorization: `Bearer ${token.value}` },
        body: { code },
      })

      if (res.code === 0 && res.data) {
        // 更新 JWT（包含新的 tokenType claim）
        token.value = res.data.token
        // 更新用户状态中的 tokenType
        if (user.value) {
          user.value = { ...user.value, tokenType: res.data.tokenType }
        }
        scheduleRefresh()
        return null
      }

      return res.message || '激活失败'
    }
    catch (err: unknown) {
      const fetchErr = err as { data?: { message?: string }, statusCode?: number }
      return fetchErr?.data?.message || '令牌激活失败，请检查令牌码是否正确'
    }
  }

  return {
    token: readonly(token),
    user: readonly(user),
    isLoggedIn,
    isActivated,
    isJcOnly,
    login,
    logout,
    fetchUser,
    activateToken,
    refreshToken,
  }
}
