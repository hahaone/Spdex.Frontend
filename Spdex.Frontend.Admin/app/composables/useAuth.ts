export interface AdminInfo {
  adminUserId: number
  userName: string
  displayName: string
  roleCode: string
  roleName: string
  email?: string | null
  mobile?: string | null
  status: number
  lastLoginAt?: string | null
  permissions: string[]
}

export function useAuth() {
  const admin = useState<AdminInfo | null>('admin_me', () => null)
  const api = useAdminApi()

  async function login(userName: string, password: string) {
    const res = await $fetch<{ code: number, message: string, data: { admin: AdminInfo } | null }>(
      '/api/admin/auth/login',
      { method: 'POST', body: { userName, password } },
    ).catch((e: { data?: { message?: string } }) => ({
      code: 401, message: e?.data?.message || '登录失败', data: null,
    }))

    if (res.code === 0 && res.data?.admin) {
      admin.value = res.data.admin
      return { ok: true, message: '' }
    }
    return { ok: false, message: res.message || '登录失败' }
  }

  async function fetchMe() {
    const res = await api.get<AdminInfo>('auth/me')
    admin.value = res.code === 0 ? res.data : null
    return admin.value
  }

  async function logout() {
    await $fetch('/api/admin/auth/logout', { method: 'POST' }).catch(() => {})
    admin.value = null
    await navigateTo('/login')
  }

  return { admin, login, fetchMe, logout }
}
