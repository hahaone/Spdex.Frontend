import {
  defineEventHandler,
  getQuery,
  getRequestURL,
  sendRedirect,
  setCookie,
  setResponseStatus,
} from 'h3'

interface ApiResponse<T> {
  code: number
  message: string
  data?: T
}

interface TicketExchangeResponse {
  token: string
  expiresAt: string
}

const runtimeValue = (...values: unknown[]) => {
  for (const value of values) {
    const text = String(value || '').trim()
    if (text) return text
  }
  return ''
}

export default defineEventHandler(async (event) => {
  const requestUrl = getRequestURL(event)
  if (requestUrl.pathname !== '/flash') return

  const query = getQuery(event)
  const ticket = String(query.ticket || '').trim()
  if (!ticket) return

  const config = useRuntimeConfig()
  const apiKey = runtimeValue(process.env.SPDEX_API_KEY, process.env.API_KEY, config.spdexApiKey)
  if (!apiKey) {
    setResponseStatus(event, 500)
    return {
      code: 500,
      message: 'NewSpdex auth bridge is not configured.',
      data: null,
    }
  }

  try {
    const exchanged = await $fetch<ApiResponse<TicketExchangeResponse>>('/api/newspdex/auth/quantilearn-ticket/exchange', {
      baseURL: runtimeValue(process.env.SPDEX_API_INTERNAL_URL, config.spdexApiInternalUrl, 'http://127.0.0.1:5000'),
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: { ticket },
    })

    if (exchanged.code !== 0 || !exchanged.data?.token) {
      setResponseStatus(event, 401)
      return {
        code: 401,
        message: exchanged.message || '闪Q登录票据无效或已过期',
        data: null,
      }
    }

    const expiresAt = Date.parse(exchanged.data.expiresAt)
    const maxAge = Number.isFinite(expiresAt)
      ? Math.max(60, Math.floor((expiresAt - Date.now()) / 1000))
      : 60 * 60 * 24

    setCookie(event, 'newspdex_token', exchanged.data.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV !== 'development',
      sameSite: 'lax',
      path: '/',
      maxAge,
    })

    requestUrl.searchParams.delete('ticket')
    return sendRedirect(event, `${requestUrl.pathname}${requestUrl.search}`, 302)
  }
  catch {
    setResponseStatus(event, 401)
    return {
      code: 401,
      message: '闪Q登录票据无效或已过期',
      data: null,
    }
  }
})
