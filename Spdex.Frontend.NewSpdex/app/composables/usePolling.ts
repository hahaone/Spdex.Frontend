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
  /**
   * 上次请求的 error ref（如 useApiFetch().error）。提供后启用「弱网/连错指数退避」：
   * 连续失败 → 跳过 N 个 tick 拉长有效间隔（1/3/7 tick ⇒ 2×/4×/8× 封顶），成功即复位。
   * 不提供则永不退避（行为同原版）。
   */
  errorRef?: Ref<unknown>
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
  const errorRef = options.errorRef
  let failCount = 0   // 连续失败数（弱网退避）
  let skipTicks = 0   // 退避中待跳过的 tick 数

  function start() {
    if (import.meta.server) return
    if (handle.value) return
    if (!enabled.value) return

    handle.value = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      if (skipTicks > 0) { skipTicks--; return }   // 弱网退避中：跳过本 tick

      const r = refresh()
      if (errorRef) {
        // refresh 完成后据 error 计连错：连错 → 跳过 1/3/7 个 tick（有效间隔 2×/4×/8× 封顶）
        Promise.resolve(r).then(() => {
          if (errorRef.value) { failCount = Math.min(failCount + 1, 3); skipTicks = (1 << failCount) - 1 }
          else { failCount = 0 }
        }).catch(() => {})
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
      failCount = 0; skipTicks = 0   // 回前台清退避，立即恢复正常节奏
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
