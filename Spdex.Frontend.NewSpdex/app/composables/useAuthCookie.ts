const TOKEN_COOKIE = 'newspdex_token'
const SESSION_HINT_COOKIE = 'newspdex_session_hint'

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

export const useNewSpdexSessionHintCookie = () => {
  return useCookie<boolean | null>(SESSION_HINT_COOKIE, {
    maxAge: 60 * 60 * 24,
    sameSite: 'lax',
    secure: import.meta.dev ? undefined : true,
  })
}
