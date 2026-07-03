export function isRateLimitedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const e = error as Record<string, unknown>
  const data = asRecord(e.data)
  const response = asRecord(e.response)

  return e.statusCode === 429
    || e.status === 429
    || data?.statusCode === 429
    || data?.status === 429
    || data?.code === 429
    || response?.status === 429
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : null
}
