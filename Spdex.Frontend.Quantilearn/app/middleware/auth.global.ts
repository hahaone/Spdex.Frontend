export default defineNuxtRouteMiddleware((to) => {
  const config = useRuntimeConfig()
  if (!config.public.requireAuth) return

  const token = useCookie<string | null>('newspdex_token')
  if (token.value) return

  const loginUrl = String(config.public.newspdexLoginUrl || 'https://new.spdex.com/login')
  const currentUrl = import.meta.client
    ? window.location.href
    : `https://q.spdex.com${to.fullPath}`

  return navigateTo(`${loginUrl}?redirect=${encodeURIComponent(currentUrl)}`, { external: true })
})
