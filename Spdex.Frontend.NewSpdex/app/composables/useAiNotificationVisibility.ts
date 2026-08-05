export function useAiNotificationVisibility() {
  const config = useRuntimeConfig()
  const aiFeatureVisible = useAiFeatureVisibility()
  const aiNotificationAccessVisible = useState<boolean>('newspdex_ai_notifications_access_visible', () => false)

  return computed(() => {
    const mode = String(config.public.aiNotificationsVisible || 'auto').toLowerCase()
    if (mode === 'false' || mode === 'off' || mode === 'disabled') return false
    return aiFeatureVisible.value && aiNotificationAccessVisible.value
  })
}
