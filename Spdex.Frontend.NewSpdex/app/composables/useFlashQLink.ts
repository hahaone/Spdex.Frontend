export function useFlashQLink() {
  const runtimeConfig = useRuntimeConfig()

  function buildFlashQLink(eventId: number | string): string {
    const base = String(runtimeConfig.public.quantilearnFlashUrl || 'https://ql.spdex.com/flash').trim()
      || 'https://ql.spdex.com/flash'
    return `/flashq/bridge?eid=${encodeURIComponent(String(eventId))}&target=${encodeURIComponent(base)}`
  }

  return { buildFlashQLink }
}
