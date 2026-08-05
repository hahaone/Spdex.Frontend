export function useAiNotificationVisibility() {
  const config = useRuntimeConfig()
  const aiFeatureVisible = useAiFeatureVisibility()

  return computed(() => {
    const mode = String(config.public.aiNotificationsVisible || 'auto').toLowerCase()
    if (mode === 'false' || mode === 'off' || mode === 'disabled') return false
    return aiFeatureVisible.value
  })
}
