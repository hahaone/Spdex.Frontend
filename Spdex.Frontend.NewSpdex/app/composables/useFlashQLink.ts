export function useFlashQLink() {
  const runtimeConfig = useRuntimeConfig()

  function buildFlashQLink(eventId: number | string): string {
    const base = String(runtimeConfig.public.quantilearnFlashUrl || 'https://ql.spdex.com/flash').trim()
      || 'https://ql.spdex.com/flash'
    const separator = base.includes('?') ? '&' : '?'
    return `${base}${separator}eid=${encodeURIComponent(String(eventId))}`
  }

  return { buildFlashQLink }
}
