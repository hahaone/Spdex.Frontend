/**
 * 新手引导状态。cookie 记 seen（看过一次后不再自动弹），可手动 start() 重看。
 */
export function useOnboarding() {
  const cookie = useCookie<boolean>('newspdex_onboarding_seen', {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    default: () => false,
  })
  // 共享响应式状态（跨组件同步）。多个 useCookie ref 互不通知，必须用 useState 兜底。
  const seen = useState<boolean>('newspdex_onboarding_seen', () => cookie.value ?? false)
  const open = useState<boolean>('newspdex_onboarding_open', () => false)

  function start() {
    open.value = true
  }
  function dismiss() {
    seen.value = true
    cookie.value = true
    open.value = false
  }
  function maybeAutoStart() {
    if (!seen.value) open.value = true
  }

  return { seen, open, start, dismiss, maybeAutoStart }
}
