import type { ApiResponse } from '~/types/api'
import type { LiveXgItem, LiveXgResponse } from '~/types/live'

/** 现场频道一行的 xG 取数引用（带源队名供后端 BSW 队名匹配）。 */
export interface LiveXgRef {
  eventId: number
  homeTeamName?: string | null
  guestTeamName?: string | null
}

/**
 * 现场频道批量 xG（BSW 网关）。自刷新：挂载后立即取一次 + 每 intervalMs 一次；items 变化即重取。
 * 非足球 / 无 BSW 匹配的场次后端不返回 → byEventId 里没有该 eventId（列留空）。
 */
export function useLiveXg(items: Ref<LiveXgRef[]>, intervalMs = 30_000) {
  const byEventId = ref<Map<number, LiveXgItem>>(new Map())
  const token = useCookie('spdex_token')
  let timer: ReturnType<typeof setInterval> | null = null

  async function refresh() {
    if (!import.meta.client) return
    const reqItems = items.value
      .filter(i => Number.isFinite(i.eventId) && i.eventId > 0)
      .map(i => ({
        eventId: i.eventId,
        homeTeamName: i.homeTeamName || null,
        guestTeamName: i.guestTeamName || null,
      }))
    if (reqItems.length === 0) {
      byEventId.value = new Map()
      return
    }
    try {
      const headers: Record<string, string> = { 'X-Spdex-Frontend': '2026' }
      if (token.value) headers.Authorization = `Bearer ${token.value}`
      const res = await $fetch<ApiResponse<LiveXgResponse>>('/api/live/xg', {
        method: 'POST',
        body: { items: reqItems },
        headers,
      })
      if (res.code === 0 && res.data) {
        const map = new Map<number, LiveXgItem>()
        for (const it of res.data.items) map.set(it.eventId, it)
        byEventId.value = map
      }
    }
    catch {
      // 忽略：保留上次结果，避免闪烁
    }
  }

  onMounted(() => {
    void refresh()
    timer = setInterval(() => void refresh(), intervalMs)
  })
  watch(items, () => { void refresh() })
  onBeforeUnmount(() => { if (timer) clearInterval(timer) })

  return { byEventId, refresh }
}
