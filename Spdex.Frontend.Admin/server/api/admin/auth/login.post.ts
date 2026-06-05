import { defineEventHandler, readBody, setCookie } from 'h3'

// 登录：转发后端校验，成功后把 AdminJwt 写入 httpOnly cookie（前端 JS 取不到）。
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const base = String(process.env.ADMIN_API_INTERNAL_URL || config.adminApiInternalUrl || 'http://127.0.0.1:5000')
  const body = await readBody(event)

  const upstream = await fetch(new URL('/api/admin/auth/login', base), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userName: body?.userName, password: body?.password }),
  }).catch(() => null)

  const json: any = upstream ? await upstream.json().catch(() => null) : null

  if (!json || json.code !== 0 || !json.data?.token) {
    return { code: json?.code ?? 401, message: json?.message || '登录失败', data: null }
  }

  const { token, expiresAt, admin } = json.data
  setCookie(event, 'admin_token', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt ? new Date(expiresAt) : undefined,
  })

  // 只回 admin 信息，token 不出 BFF
  return { code: 0, message: 'ok', data: { admin, expiresAt } }
})
