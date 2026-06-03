export default defineNuxtRouteMiddleware((to) => {
  const config = useRuntimeConfig()
  if (!config.public.requireAuth) return

  const token = useCookie<string | null>('newspdex_token')
  if (token.value) return

  const loginUrl = String(config.public.newspdexLoginUrl || 'https://new.spdex.com/login')
  const publicBaseUrl = String(config.public.quantilearnPublicBaseUrl || 'https://ql.spdex.com').replace(/\/+$/, '')
  const currentUrl = import.meta.client
    ? window.location.href
    : `${publicBaseUrl}${to.fullPath}`

  return navigateTo(`${loginUrl}?redirect=${encodeURIComponent(currentUrl)}`, { external: true })
})
