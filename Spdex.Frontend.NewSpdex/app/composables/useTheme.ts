/**
 * 主题（明/暗）切换。基于 cookie 持久化，SSR 与客户端同读，避免刷新闪烁。
 * <html> 的 .dark class 由 app.vue 的 useHead 据 isDark 响应式设置，
 * 所有引用 CSS 变量的 Tailwind token（text-ink/bg-panel/…）随之翻转。
 */
export type ThemeMode = 'light' | 'dark'

export function useTheme() {
  const cookie = useCookie<ThemeMode>('newspdex_theme', {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    default: () => 'light',
  })

  // 共享响应式状态（useState 按 key 跨组件/页面同步）。
  // 不能直接用多个 useCookie ref —— 它们读同一 cookie 但互相不通知，
  // 会导致 DesktopNav 切换后 app.vue 的 html class 不更新。
  const theme = useState<ThemeMode>('newspdex_theme', () => cookie.value || 'light')
  const isDark = computed(() => theme.value === 'dark')

  function setTheme(mode: ThemeMode) {
    theme.value = mode
    cookie.value = mode
  }

  function toggle() {
    setTheme(theme.value === 'dark' ? 'light' : 'dark')
  }

  return { theme, isDark, setTheme, toggle }
}
