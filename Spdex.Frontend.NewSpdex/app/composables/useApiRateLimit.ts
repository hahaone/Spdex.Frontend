const HEAVY_API_PREFIXES = [
  '/api/newspdex/charts',
  '/api/newspdex/order-detail',
  '/api/newspdex/big-trades',
  '/api/newspdex/trades',
  '/api/newspdex/ladder',
  '/api/newspdex/correct-score',
  '/api/newspdex/inner-outer',
]

let cooldownResetTimer: ReturnType<typeof setTimeout> | null = null

function requestPath(request: unknown): string {
  let raw = ''
  if (typeof request === 'string') raw = request
  else if (request instanceof URL) raw = request.toString()
  else if (typeof Request !== 'undefined' && request instanceof Request) raw = request.url
  else if (request && typeof request === 'object' && 'url' in request)
    raw = String((request as { url?: unknown }).url ?? '')

  if (!raw) return ''
  try {
    return new URL(raw, 'https://newspdex.local').pathname
  }
  catch {
    return raw.split('?')[0] ?? raw
  }
}

function retryAfterSeconds(response: { headers?: Headers, _data?: unknown }): number {
  const raw = response.headers?.get('retry-after')?.trim()
  if (raw) {
    const seconds = Number(raw)
    if (Number.isFinite(seconds) && seconds > 0) return Math.ceil(seconds)

    const dateMs = Date.parse(raw)
    if (Number.isFinite(dateMs)) return Math.max(1, Math.ceil((dateMs - Date.now()) / 1000))
  }

  const data = response._data as { retryAfter?: unknown, retryAfterSeconds?: unknown } | undefined
  const bodySeconds = Number(data?.retryAfterSeconds ?? data?.retryAfter)
  return Number.isFinite(bodySeconds) && bodySeconds > 0 ? Math.ceil(bodySeconds) : 60
}

/**
 * 浏览器内共享重接口冷却：任一重接口收到 429 后，其余图表轮询在 Retry-After 到期前
 * 直接在本地停止发网，避免一个页面的多个赛事卡片持续延长服务端冷却。
 */
export function useApiRateLimit() {
  const cooldownUntil = useState<number>('newspdex-heavy-api-cooldown-until', () => 0)
  const coolingDown = computed(() => cooldownUntil.value > Date.now())
  const remainingSeconds = computed(() => Math.max(0, Math.ceil((cooldownUntil.value - Date.now()) / 1000)))

  function isHeavyRequest(request: unknown): boolean {
    const path = requestPath(request)
    return HEAVY_API_PREFIXES.some(prefix => path.startsWith(prefix))
  }

  function assertRequestAllowed(request: unknown) {
    const now = Date.now()
    if (!isHeavyRequest(request) || cooldownUntil.value <= now) return

    throw createError({
      statusCode: 429,
      statusMessage: '请求过于频繁，请稍后重试',
      data: {
        code: 429,
        retryAfter: Math.max(1, Math.ceil((cooldownUntil.value - now) / 1000)),
        localCooldown: true,
      },
    })
  }

  function noteResponseError(request: unknown, response: { status: number, headers?: Headers, _data?: unknown }) {
    if (response.status !== 429 || !isHeavyRequest(request)) return
    const until = Date.now() + retryAfterSeconds(response) * 1000
    cooldownUntil.value = Math.max(cooldownUntil.value, until)
    if (import.meta.client) {
      if (cooldownResetTimer) clearTimeout(cooldownResetTimer)
      cooldownResetTimer = setTimeout(() => {
        if (cooldownUntil.value <= Date.now()) cooldownUntil.value = 0
        cooldownResetTimer = null
      }, Math.max(1, cooldownUntil.value - Date.now()) + 50)
    }
  }

  return {
    cooldownUntil: readonly(cooldownUntil),
    coolingDown,
    remainingSeconds,
    isHeavyRequest,
    assertRequestAllowed,
    noteResponseError,
  }
}
