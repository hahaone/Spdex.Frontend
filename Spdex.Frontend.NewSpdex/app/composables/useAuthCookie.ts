const TOKEN_COOKIE = 'newspdex_token'

export const useNewSpdexTokenCookie = () => {
  const config = useRuntimeConfig()
  const domain = String(config.public.authCookieDomain || '').trim()

  return useCookie<string | null>(TOKEN_COOKIE, {
    maxAge: 60 * 60 * 24,
    sameSite: 'lax',
    secure: domain ? true : undefined,
    domain: domain || undefined,
  })
}
