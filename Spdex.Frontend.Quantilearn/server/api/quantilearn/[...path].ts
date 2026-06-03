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

interface ApiResponse<T> {
  code: number
  message: string
  data?: T
}

interface NewSpdexUser {
  userId: number
  userName: string
  roleId: number
}

const apiError = (status: number, message: string) => {
  return {
    status,
    body: {
      code: status,
      message,
      data: null,
    },
  }
}

const bearerFromRequest = (event: H3Event) => {
  const authorization = getRequestHeader(event, 'authorization')
  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim()
  }

  return getCookie(event, 'newspdex_token') || ''
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

const runtimeValue = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value || '').trim()
    if (text) return text
  }

  return ''
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const token = bearerFromRequest(event)

  if (!token) {
    const error = apiError(401, '请先登录 NewSpdex')
    setResponseStatus(event, error.status)
    return error.body
  }

  const sharedSecret = runtimeValue(
    process.env.QUANTILEARN_AUTH_SHARED_SECRET,
    process.env.QuantilearnAuth__SharedSecret,
    config.quantilearnAuthSharedSecret,
  )
  if (!sharedSecret) {
    const error = apiError(500, 'Quantilearn auth bridge is not configured.')
    setResponseStatus(event, error.status)
    return error.body
  }

  let user: NewSpdexUser
  try {
    const me = await $fetch<ApiResponse<NewSpdexUser>>('/api/newspdex/auth/me', {
      baseURL: runtimeValue(
        process.env.SPDEX_API_INTERNAL_URL,
        config.spdexApiInternalUrl,
        'http://127.0.0.1:5000',
      ),
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (me.code !== 0 || !me.data) {
      const error = apiError(401, me.message || 'NewSpdex token is invalid.')
      setResponseStatus(event, error.status)
      return error.body
    }

    user = me.data
  }
  catch {
    const error = apiError(401, 'NewSpdex token is invalid or expired.')
    setResponseStatus(event, error.status)
    return error.body
  }

  const rawPath = event.context.params?.path
  const path = Array.isArray(rawPath) ? rawPath.join('/') : String(rawPath || '')
  const targetUrl = new URL(
    `/api/quantilearn/${path}`,
    runtimeValue(
      process.env.QUANTILEARN_API_INTERNAL_URL,
      process.env.API_INTERNAL_URL,
      config.quantilearnApiInternalUrl,
      'http://127.0.0.1:5015',
    ),
  )
  appendQuery(targetUrl, getQuery(event))

  const method = getMethod(event)
  const headers = new Headers()
  const contentType = getRequestHeader(event, 'content-type')
  if (contentType) headers.set('Content-Type', contentType)
  headers.set('X-Spdex-User-Id', String(user.userId))
  headers.set('X-Spdex-Role-Id', String(user.roleId))
  headers.set('X-Spdex-User-Name', user.userName)
  headers.set('X-Quantilearn-Auth-Secret', sharedSecret)

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

  if (upstreamContentType?.includes('application/json')) {
    return await upstream.json()
  }

  return await upstream.text()
})
