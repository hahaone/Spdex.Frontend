export function useAiFeatureVisibility() {
  const config = useRuntimeConfig()

  return computed(() => String(config.public.aiFeaturesVisible).toLowerCase() === 'true')
}
