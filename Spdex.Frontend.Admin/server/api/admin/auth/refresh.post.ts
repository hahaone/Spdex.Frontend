import { defineEventHandler, getCookie, setCookie } from 'h3'

// 续签：后端旋转 jti 返回新 token，BFF 更新 httpOnly cookie。
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const base = String(process.env.ADMIN_API_INTERNAL_URL || config.adminApiInternalUrl || 'http://127.0.0.1:5000')
  const token = getCookie(event, 'admin_token') || ''
  if (!token) return { code: 401, message: '未登录', data: null }

  const upstream = await fetch(new URL('/api/admin/auth/refresh', base), {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null)

  const json: any = upstream ? await upstream.json().catch(() => null) : null
  if (!json || json.code !== 0 || !json.data?.token) {
    return { code: json?.code ?? 401, message: json?.message || '续签失败', data: null }
  }

  const { token: newToken, expiresAt, admin } = json.data
  setCookie(event, 'admin_token', newToken, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt ? new Date(expiresAt) : undefined,
  })

  return { code: 0, message: 'ok', data: { admin, expiresAt } }
})
