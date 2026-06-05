import { defineEventHandler, getCookie, setCookie } from 'h3'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const base = String(process.env.ADMIN_API_INTERNAL_URL || config.adminApiInternalUrl || 'http://127.0.0.1:5000')
  const token = getCookie(event, 'admin_token') || ''

  if (token) {
    await fetch(new URL('/api/admin/auth/logout', base), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
  }

  setCookie(event, 'admin_token', '', { httpOnly: true, path: '/', maxAge: 0 })
  return { code: 0, message: 'ok', data: null }
})
