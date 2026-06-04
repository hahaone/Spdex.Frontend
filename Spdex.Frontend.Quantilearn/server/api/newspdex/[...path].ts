import {
  defineEventHandler,
  getCookie,
  getMethod,
  getQuery,
  getRequestHeader,
  readRawBody,
  setResponseHeader,
  setResponseStatus,
} from 'h3'
import type { H3Event } from 'h3'

const apiError = (status: number, message: string) => ({
  code: status,
  message,
  data: null,
})

const bearerFromRequest = (event: H3Event) => {
  const authorization = getRequestHeader(event, 'authorization')
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim()
  }

  return getCookie(event, 'newspdex_token') || ''
}

const runtimeValue = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value || '').trim()
    if (text) return text
  }

  return ''
}

const appendQuery = (url: URL, query: Record<string, unknown>) => {
  Object.entries(query).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(item => url.searchParams.append(key, String(item)))
      return
    }

    if (value !== undefined && value !== null) {
      url.searchParams.set(key, String(value))
    }
  })
}

export default defineEventHandler(async (event) => {
  const token = bearerFromRequest(event)
  if (!token) {
    setResponseStatus(event, 401)
    return apiError(401, '请先登录 NewSpdex')
  }

  const config = useRuntimeConfig()
  const rawPath = event.context.params?.path
  const path = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '')
  const targetUrl = new URL(
    `/api/newspdex/${path}`,
    runtimeValue(
      process.env.SPDEX_API_INTERNAL_URL,
      config.spdexApiInternalUrl,
      'http://127.0.0.1:5000',
    ),
  )
  appendQuery(targetUrl, getQuery(event))

  const method = getMethod(event)
  const headers = new Headers()
  const contentType = getRequestHeader(event, 'content-type')
  if (contentType) headers.set('Content-Type', contentType)
  headers.set('Authorization', `Bearer ${token}`)

  const body = method === 'GET' || method === 'HEAD' ? undefined : await readRawBody(event)
  const upstream = await fetch(targetUrl, {
    method,
    headers,
    body,
  })

  setResponseStatus(event, upstream.status)
  const upstreamContentType = upstream.headers.get('content-type')
  if (upstreamContentType) {
    setResponseHeader(event, 'Content-Type', upstreamContentType)
  }

  if (upstream.status === 204) return null
  if (upstreamContentType?.includes('application/json')) return await upstream.json()
  return await upstream.text()
})
