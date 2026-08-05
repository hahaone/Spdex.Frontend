import type { ApiResponse } from '~/types/auth'

interface AiAccessResult {
  enabled?: boolean
  notificationsEnabled?: boolean
}

export function useAiFeatureVisibility() {
  const config = useRuntimeConfig()
  const { isLoggedIn } = useAuth()
  const authVersion = useState<number>('newspdex_auth_version', () => 0)
  const visible = useState<boolean>('newspdex_ai_features_visible', () => false)
  const notificationsVisible = useState<boolean>('newspdex_ai_notifications_access_visible', () => false)
  const checkedAuthVersion = useState<number>('newspdex_ai_features_checked_auth_version', () => -1)
  const loading = useState<boolean>('newspdex_ai_features_loading', () => false)

  async function refresh(force = false) {
    if (!isLoggedIn.value) {
      visible.value = false
      notificationsVisible.value = false
      checkedAuthVersion.value = -1
      return
    }

    if (loading.value || (!force && checkedAuthVersion.value === authVersion.value)) return

    loading.value = true
    try {
      const access = await $apiFetch<ApiResponse<AiAccessResult>>('/api/newspdex/ai/access')
      visible.value = access.code === 0 && access.data?.enabled === true
      notificationsVisible.value = visible.value && access.data?.notificationsEnabled === true
    }
    catch {
      visible.value = false
      notificationsVisible.value = false
    }
    finally {
      checkedAuthVersion.value = authVersion.value
      loading.value = false
    }
  }

  if (import.meta.client) {
    watch([isLoggedIn, authVersion], () => {
      void refresh(true)
    }, { immediate: true })
  }

  return computed(() => (
    (import.meta.dev && String(config.public.aiFeaturesVisible).toLowerCase() === 'true') ||
    visible.value
  ))
}
