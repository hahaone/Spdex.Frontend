import type { MatchListItem } from '~/types/match'

const STORAGE_KEY = 'spdex_pinned_matches'

/** 关注的赛事项（包含完整数据用于跨 tab 显示） */
interface PinnedEntry {
  eventId: number
  matchTime: string // ISO string, 用于过期判断
  item: MatchListItem
}

/**
 * 管理首页"关注"赛事的 composable。
 * - 关注的赛事在切换 未开赛/已开赛/全部/竞彩 时始终保留显示
 * - 手动取消关注、开赛时间+2小时后、或更换日期时清除
 */
export function usePinnedMatches() {
  const pinnedMap = ref<Map<number, PinnedEntry>>(new Map())

  // 从 localStorage 恢复
  function loadFromStorage() {
    if (import.meta.server) return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const arr: PinnedEntry[] = JSON.parse(raw)
        const map = new Map<number, PinnedEntry>()
        for (const entry of arr) {
          map.set(entry.eventId, entry)
        }
        pinnedMap.value = map
      }
    }
    catch {
      // ignore corrupt data
    }
  }

  function saveToStorage() {
    if (import.meta.server) return
    const arr = Array.from(pinnedMap.value.values())
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr))
  }

  /** 切换关注状态 */
  function togglePin(item: MatchListItem) {
    const id = item.match.eventId
    const map = new Map(pinnedMap.value)
    if (map.has(id)) {
      map.delete(id)
    }
    else {
      map.set(id, {
        eventId: id,
        matchTime: item.match.matchTime,
        item: JSON.parse(JSON.stringify(item)), // deep clone
      })
    }
    pinnedMap.value = map
    saveToStorage()
  }

  function isPinned(eventId: number): boolean {
    return pinnedMap.value.has(eventId)
  }

  /** 用最新的 API 数据刷新已关注赛事的数据 */
  function refreshPinnedData(items: MatchListItem[]) {
    let changed = false
    const map = new Map(pinnedMap.value)
    for (const item of items) {
      const entry = map.get(item.match.eventId)
      if (entry) {
        entry.item = JSON.parse(JSON.stringify(item))
        changed = true
      }
    }
    if (changed) {
      pinnedMap.value = map
      saveToStorage()
    }
  }

  /** 清除过期关注（开赛时间 + 2小时） */
  function purgeExpired() {
    const now = Date.now()
    const twoHours = 2 * 60 * 60 * 1000
    let changed = false
    const map = new Map(pinnedMap.value)
    for (const [id, entry] of map) {
      const matchTs = new Date(entry.matchTime).getTime()
      if (matchTs + twoHours <= now) {
        map.delete(id)
        changed = true
      }
    }
    if (changed) {
      pinnedMap.value = map
      saveToStorage()
    }
  }

  /** 更换日期时清除所有关注 */
  function clearAll() {
    if (pinnedMap.value.size === 0) return
    pinnedMap.value = new Map()
    saveToStorage()
  }

  /** 获取当前所有关注的赛事列表 */
  const pinnedItems = computed<MatchListItem[]>(() => {
    return Array.from(pinnedMap.value.values()).map(e => e.item)
  })

  const pinnedEventIds = computed<Set<number>>(() => {
    return new Set(pinnedMap.value.keys())
  })

  // 初始化加载
  loadFromStorage()
  // 加载后立即清理过期
  purgeExpired()

  return {
    pinnedItems,
    pinnedEventIds,
    isPinned,
    togglePin,
    refreshPinnedData,
    purgeExpired,
    clearAll,
  }
}
