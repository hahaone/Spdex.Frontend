const QUANTILEARN_HOSTS = new Set(['ql.spdex.com', 'q.spdex.com'])

export function isQuantilearnRedirectTarget(target: URL) {
  if (QUANTILEARN_HOSTS.has(target.hostname)) return true

  return import.meta.dev
    && ['127.0.0.1', 'localhost'].includes(target.hostname)
    && target.port === '3004'
}

export function resolvePostAuthTarget(redirect: string, currentOrigin: string) {
  if (!redirect) return '/'

  try {
    const target = new URL(redirect, currentOrigin)

    if (isQuantilearnRedirectTarget(target)) {
      target.searchParams.delete('ticket')
      return `/flashq/bridge?target=${encodeURIComponent(target.href)}`
    }

    if (target.origin === currentOrigin || target.hostname.endsWith('.spdex.com')) {
      return target.href
    }
  }
  catch {
    return '/'
  }

  return '/'
}
