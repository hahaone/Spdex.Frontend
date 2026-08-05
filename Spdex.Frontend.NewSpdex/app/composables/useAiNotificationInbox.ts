import type { AiInAppNotificationListResult } from '~/types/ai-notification'

const AI_NOTIFICATION_REFRESH_TTL_MS = 30_000

interface RefreshUnreadOptions {
  force?: boolean
}

export function useAiNotificationInbox() {
  const visible = useAiNotificationVisibility()
  const { isLoggedIn } = useAuth()
  const unreadCount = useState<number>('newspdex_ai_notification_unread_count', () => 0)
  const loading = useState<boolean>('newspdex_ai_notification_unread_loading', () => false)
  const lastLoadedAt = useState<number>('newspdex_ai_notification_unread_loaded_at', () => 0)
  const error = useState<string>('newspdex_ai_notification_unread_error', () => '')
  const watcherRegistered = useState<boolean>('newspdex_ai_notification_unread_watcher_registered', () => false)

  const hasUnread = computed(() => visible.value && unreadCount.value > 0)

  async function refreshUnreadCount(options: RefreshUnreadOptions = {}) {
    if (import.meta.server) return
    if (!visible.value || !isLoggedIn.value) {
      unreadCount.value = 0
      error.value = ''
      return
    }
    if (loading.value) return
    if (!options.force && Date.now() - lastLoadedAt.value < AI_NOTIFICATION_REFRESH_TTL_MS) return

    loading.value = true
    error.value = ''
    try {
      const result = await $apiFetch<AiInAppNotificationListResult>(
        '/api/newspdex/ai/notifications/in-app',
        {
          query: {
            unreadOnly: true,
            limit: 100,
          },
        },
      )
      syncUnreadCount(result)
      lastLoadedAt.value = Date.now()
    }
    catch (fetchError: unknown) {
      const message = fetchError as { data?: { message?: string, error_description?: string } }
      error.value = message.data?.message || message.data?.error_description || 'AI 通知未读数暂不可用'
    }
    finally {
      loading.value = false
    }
  }

  function syncUnreadCount(result: AiInAppNotificationListResult | null) {
    unreadCount.value = Math.max(0, result?.unreadCount ?? 0)
    lastLoadedAt.value = Date.now()
  }

  function decrementUnreadCount(delta = 1) {
    unreadCount.value = Math.max(0, unreadCount.value - Math.max(0, delta))
    lastLoadedAt.value = Date.now()
  }

  if (import.meta.client && !watcherRegistered.value) {
    watcherRegistered.value = true
    watch([visible, isLoggedIn], ([nextVisible, nextLoggedIn]) => {
      if (nextVisible && nextLoggedIn) {
        void refreshUnreadCount({ force: true })
        return
      }

      unreadCount.value = 0
      error.value = ''
    })
  }

  return {
    unreadCount,
    hasUnread,
    loading,
    error,
    refreshUnreadCount,
    syncUnreadCount,
    decrementUnreadCount,
  }
}
