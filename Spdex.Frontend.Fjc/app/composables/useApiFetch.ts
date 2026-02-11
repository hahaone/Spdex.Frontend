/**
 * Composable wrapping useFetch with the backend API base URL.
 * Automatically prepends the API base from runtime config.
 * All composables should use this instead of raw useFetch.
 */
export function useApiFetch<T>(path: string | Ref<string>, opts: Record<string, unknown> = {}) {
  const config = useRuntimeConfig()

  return useFetch<T>(path, {
    baseURL: config.public.apiBase as string,
    ...opts,
  } as never)
}
