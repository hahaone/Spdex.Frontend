export type DesktopViewMode = 'modern' | 'classic'

const STORAGE_KEY = 'newspdex_desktop_view_mode'
// 仅用于「无显式偏好时的默认值」：宽屏默认经典、窄屏/手机默认移动版(modern)。
// 不再作为「能否进经典」的门控——经典模式对所有设备开放，用户可主动切换。
const WIDE_QUERY = '(min-width: 1200px)'

function isDesktopViewMode(value: unknown): value is DesktopViewMode {
  return value === 'modern' || value === 'classic'
}

export function useDesktopViewMode() {
  const route = useRoute()
  const router = useRouter()
  // null = 用户未显式选择过(无 localStorage / 无 ?view)。
  const storedMode = useState<DesktopViewMode | null>('newspdex-desktop-view-mode', () => null)
  // 宽屏(≥1200px)：无偏好时默认经典；窄屏/手机：无偏好时默认 modern，但用户仍可主动切经典。
  const isWideScreen = useState<boolean>('newspdex-wide-screen', () => false)

  const queryMode = computed<DesktopViewMode | null>(() => {
    const value = route.query.view
    return isDesktopViewMode(value) ? value : null
  })

  const desktopViewMode = computed<DesktopViewMode>(() => {
    // 优先级：URL ?view → 用户显式偏好(localStorage) → 按屏宽默认(宽屏经典/窄屏移动版)。
    return queryMode.value ?? storedMode.value ?? (isWideScreen.value ? 'classic' : 'modern')
  })

  const isClassicDesktop = computed(() => desktopViewMode.value === 'classic')
  // 经典模式对所有设备开放（含手机），切换入口据此显示。
  const isDesktopModeAvailable = computed(() => true)

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

    const media = window.matchMedia(WIDE_QUERY)
    const updateWide = () => {
      isWideScreen.value = media.matches
    }

    updateWide()
    media.addEventListener('change', updateWide)

    onBeforeUnmount(() => {
      media.removeEventListener('change', updateWide)
    })
  })

  return {
    desktopViewMode,
    isClassicDesktop,
    isDesktopModeAvailable,
    setDesktopViewMode,
  }
}
