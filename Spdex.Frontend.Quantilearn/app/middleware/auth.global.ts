export default defineNuxtRouteMiddleware(async (to) => {
  const config = useRuntimeConfig()
  if (!config.public.requireAuth) return

  const verified = useState<boolean>('quantilearn_newspdex_auth_verified', () => false)
  if (verified.value) return

  const token = useCookie<string | null>('newspdex_token')
  if (token.value) {
    verified.value = true
    return
  }

  try {
    const requestFetch = useRequestFetch()
    await requestFetch('/api/newspdex/auth/me')
    verified.value = true
    return
  }
  catch {
    // Fall through to NewSpdex login redirect.
  }

  const loginUrl = String(config.public.newspdexLoginUrl || 'https://new.spdex.com/login')
  const publicBaseUrl = String(config.public.quantilearnPublicBaseUrl || 'https://ql.spdex.com').replace(/\/+$/, '')
  const currentUrl = import.meta.client
    ? window.location.href
    : `${publicBaseUrl}${to.fullPath}`

  return navigateTo(`${loginUrl}?redirect=${encodeURIComponent(currentUrl)}`, { external: true })
})
