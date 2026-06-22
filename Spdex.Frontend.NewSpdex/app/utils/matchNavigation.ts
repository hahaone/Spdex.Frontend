import type { LocationQuery, RouteLocationRaw } from 'vue-router'

const LIST_CONTEXT_KEYS = ['date', 'day', 'status', 'lottery', 'league', 'view'] as const

type ExtraQuery = Record<string, string | number | boolean | null | undefined>

export function pickMatchListContext(query: LocationQuery, extra: ExtraQuery = {}): Record<string, string> {
  const out: Record<string, string> = {}

  for (const key of LIST_CONTEXT_KEYS) {
    const value = query[key]
    if (typeof value === 'string' && value) out[key] = value
  }

  for (const [key, value] of Object.entries(extra)) {
    if (value === null || value === undefined || value === '') continue
    out[key] = String(value)
  }

  return out
}

export function withMatchListContext(
  path: string,
  query: LocationQuery,
  extra: ExtraQuery = {},
): RouteLocationRaw {
  const next = pickMatchListContext(query, extra)
  return Object.keys(next).length ? { path, query: next } : path
}
