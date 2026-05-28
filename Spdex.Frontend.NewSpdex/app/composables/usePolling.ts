/**
 * 通用轮询 helper：组件挂载后周期性调用 refresh()，卸载时清理。
 *
 * 特性：
 * 1. 仅客户端运行（SSR 跳过）
 * 2. 监听 document.visibilitychange：标签页切回前台时立即刷新一次
 * 3. enabled 可动态控制 — 切到 false 暂停，切回 true 重启
 * 4. 多次调用 stop/start 幂等
 *
 * 用法：
 *   const { refresh } = useApiFetch(...)
 *   usePolling(refresh, 30_000)
 *
 * 或带条件：
 *   const isRunning = computed(() => snapshot.value?.status === 'running')
 *   usePolling(refresh, 30_000, { enabled: isRunning })
 */

export interface PollingOptions {
  /** 控制轮询是否启用。false 时暂停 setInterval，但保留 visibilitychange 监听 */
  enabled?: Ref<boolean> | ComputedRef<boolean>
  /** 切回前台时是否立即刷新一次（默认 true） */
  refreshOnVisible?: boolean
}

export function usePolling(
  refresh: () => Promise<unknown> | unknown,
  intervalMs: number,
  options: PollingOptions = {},
) {
  const handle = ref<ReturnType<typeof setInterval> | null>(null)
  const visibilityHandler = ref<(() => void) | null>(null)
  const enabled = options.enabled ?? ref(true)
  const refreshOnVisible = options.refreshOnVisible ?? true

  function start() {
    if (import.meta.server) return
    if (handle.value) return
    if (!enabled.value) return

    handle.value = setInterval(() => {
      if (document.visibilityState === 'visible') {
        refresh()
      }
    }, intervalMs)
  }

  function stop() {
    if (handle.value) {
      clearInterval(handle.value)
      handle.value = null
    }
  }

  function bindVisibility() {
    if (import.meta.server) return
    if (visibilityHandler.value) return

    visibilityHandler.value = () => {
      if (document.visibilityState !== 'visible') return
      if (!enabled.value) return
      if (refreshOnVisible) refresh()
    }
    document.addEventListener('visibilitychange', visibilityHandler.value)
  }

  function unbindVisibility() {
    if (visibilityHandler.value) {
      document.removeEventListener('visibilitychange', visibilityHandler.value)
      visibilityHandler.value = null
    }
  }

  onMounted(() => {
    start()
    bindVisibility()
  })

  onUnmounted(() => {
    stop()
    unbindVisibility()
  })

  // enabled 切换时启停
  watch(enabled, (v) => {
    if (v) start()
    else stop()
  })

  return { start, stop }
}
