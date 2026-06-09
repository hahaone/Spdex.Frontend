export type DesktopViewMode = 'modern' | 'classic'

const STORAGE_KEY = 'newspdex_desktop_view_mode'
const MEDIA_QUERY = '(min-width: 1200px)'

function isDesktopViewMode(value: unknown): value is DesktopViewMode {
  return value === 'modern' || value === 'classic'
}

export function useDesktopViewMode() {
  const route = useRoute()
  const router = useRouter()
  // null = 用户未显式选择过(无 localStorage / 无 ?view);大屏下默认走「经典」,小屏始终 modern。
  const storedMode = useState<DesktopViewMode | null>('newspdex-desktop-view-mode', () => null)
  const isDesktopModeAvailable = useState<boolean>('newspdex-desktop-mode-available', () => false)

  const queryMode = computed<DesktopViewMode | null>(() => {
    const value = route.query.view
    return isDesktopViewMode(value) ? value : null
  })

  const desktopViewMode = computed<DesktopViewMode>(() => {
    if (!isDesktopModeAvailable.value) return 'modern'
    // 优先级:URL ?view → 用户显式偏好(localStorage)→ 大屏默认「经典」(老用户过渡心智)。
    return queryMode.value ?? storedMode.value ?? 'classic'
  })

  const isClassicDesktop = computed(() => desktopViewMode.value === 'classic')

  function setDesktopViewMode(mode: DesktopViewMode) {
    storedMode.value = mode
    if (import.meta.client) {
      window.localStorage.setItem(STORAGE_KEY, mode)
    }

    if (queryMode.value) {
      const query = { ...route.query }
      delete query.view
      router.replace({ path: route.path, query, hash: route.hash })
    }
  }

  onMounted(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (isDesktopViewMode(saved)) {
      storedMode.value = saved
    }

    const media = window.matchMedia(MEDIA_QUERY)
    const updateAvailability = () => {
      isDesktopModeAvailable.value = media.matches
    }

    updateAvailability()
    media.addEventListener('change', updateAvailability)

    onBeforeUnmount(() => {
      media.removeEventListener('change', updateAvailability)
    })
  })

  return {
    desktopViewMode,
    isClassicDesktop,
    isDesktopModeAvailable,
    setDesktopViewMode,
  }
}
