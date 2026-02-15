/**
 * 认证状态管理 Composable。
 * 管理 JWT token 存储、登录/登出、当前用户信息、令牌激活。
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

export function useAuth() {
  const config = useRuntimeConfig()
  const token = useCookie(TOKEN_COOKIE, { maxAge: 60 * 60 * 24 }) // 1 day
  const user = useState<AuthUser | null>('auth_user', () => null)

  const isLoggedIn = computed(() => !!token.value)

  /** 令牌是否已激活 */
  const isActivated = computed(() => !!user.value?.tokenType)

  /** 是否仅限竞彩 */
  const isJcOnly = computed(() => user.value?.tokenType === 'jc')

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
        return true
      }

      // token 无效或权限变更
      token.value = null
      user.value = null
      return false
    }
    catch {
      token.value = null
      user.value = null
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
  }
}
