export function useAiNotificationVisibility() {
  const config = useRuntimeConfig()

  return computed(() => String(config.public.aiNotificationsVisible).toLowerCase() === 'true')
}
