/**
 * Simple health-check composable to verify Spdex.WebApi connectivity.
 * Calls GET /api/health (adjust if your .NET API uses a different endpoint).
 */
export function useApiHealth() {
  return useApiFetch<string>('/api/health', {
    method: 'GET',
    server: false, // client-side only
  })
}
