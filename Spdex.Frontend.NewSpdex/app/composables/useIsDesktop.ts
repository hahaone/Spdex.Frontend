/**
 * 响应式判断是否桌面宽度(默认 ≥1024)。
 * SSR 安全:初始 false，客户端挂载后同步 matchMedia 并监听变化。
 */
export function useIsDesktop(query = '(min-width: 1024px)') {
  const isDesktop = ref(false)
  if (import.meta.client) {
    const mq = window.matchMedia(query)
    const update = () => { isDesktop.value = mq.matches }
    update()
    mq.addEventListener('change', update)
    onScopeDispose(() => mq.removeEventListener('change', update))
  }
  return isDesktop
}
