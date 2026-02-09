/**
 * Composable wrapping useFetch with the backend API base URL.
 * Automatically prepends the API base from runtime config.
 */
export function useApiFetch<T>(path: string, opts: Record<string, unknown> = {}) {
  const config = useRuntimeConfig()

  return useFetch<T>(path, {
    baseURL: config.public.apiBase as string,
    ...opts,
  } as never)
}
