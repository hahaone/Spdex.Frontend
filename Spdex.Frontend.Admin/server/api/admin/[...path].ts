import {
  defineEventHandler, getCookie, getMethod, getQuery,
  getRequestHeader, readRawBody, setResponseHeader, setResponseStatus,
} from 'h3'

// 通用 BFF：从 httpOnly cookie 取 admin_token，注入 Bearer 转发到后端 /api/admin/*。
// 具体的 auth/login|logout|refresh 由各自 .post.ts 优先处理（管理 cookie）。
const COOKIE = 'admin_token'

function internalBase() {
  const config = useRuntimeConfig()
  return String(process.env.ADMIN_API_INTERNAL_URL || config.adminApiInternalUrl || 'http://127.0.0.1:5000')
}

export default defineEventHandler(async (event) => {
  const token = getCookie(event, COOKIE) || ''
  if (!token) {
    setResponseStatus(event, 401)
    return { code: 401, message: '未登录', data: null }
  }

  const rawPath = event.context.params?.path
  const path = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '')
  const url = new URL(`/api/admin/${path}`, internalBase())

  const query = getQuery(event)
  Object.entries(query).forEach(([k, v]) => {
    if (Array.isArray(v)) v.forEach(i => url.searchParams.append(k, String(i)))
    else if (v != null) url.searchParams.set(k, String(v))
  })

  const method = getMethod(event)
  const headers = new Headers()
  const ct = getRequestHeader(event, 'content-type')
  if (ct) headers.set('Content-Type', ct)
  headers.set('Authorization', `Bearer ${token}`)

  const body = method === 'GET' || method === 'HEAD' ? undefined : await readRawBody(event)
  const upstream = await fetch(url, { method, headers, body })

  setResponseStatus(event, upstream.status)
  const upCt = upstream.headers.get('content-type')
  if (upCt) setResponseHeader(event, 'Content-Type', upCt)
  if (upstream.status === 204) return null
  if (upCt?.includes('application/json')) return await upstream.json()
  return await upstream.text()
})
