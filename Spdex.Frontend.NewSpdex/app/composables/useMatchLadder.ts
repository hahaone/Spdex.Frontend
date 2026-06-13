/**
 * 盘口明细（BetFair 深度阶梯）。
 * 调 /api/newspdex/ladder/{eventId}?market=&selection=，
 * 对应旧站「明细图表」的 标盘 / 进球 / 正确比分：
 * 某市场选一个选项 → 价位/买/卖/成交 阶梯 + 汇总 + 价格成交量迷你走势。
 */

import type { ApiResponse } from '~/types/auth'

export interface LadderRow {
  price: number
  back: number
  lay: number
  traded: number
  side: string // "back" | "lay" | ""
}

export interface LadderPoint {
  time: string
  price: number | null
  volume: number
}

export interface LadderSelection {
  key: string
  label: string
  matched: number
}

export interface LadderDepth {
  key: string
  label: string
  marketTotal: number
  selectionTotal: number
  tradedLow: number
  tradedHigh: number
  lastPrice: number
  updatedTime: string
  rows: LadderRow[]
  series: LadderPoint[]
}

export interface LadderData {
  eventId: number
  homeTeam: string
  awayTeam: string
  market: string
  marketLabel: string
  markets: string[]
  selections: LadderSelection[]
  active: LadderDepth | null
  accessLocked: boolean
  lockMessage: string | null
}

/** 可切换市场（前端 tab 顺序与文案）。 */
export const LADDER_MARKETS: { value: string, label: string }[] = [
  { value: 'standard', label: '标盘' },
  { value: 'goals', label: '进球' },
  { value: 'cs', label: '正确比分' },
]

export function useMatchLadder(eventId: MaybeRef<number>) {
  const idRef = computed(() => unref(eventId))
  const market = ref('standard')
  const selection = ref<string | null>(null)

  const result = useApiFetch<ApiResponse<LadderData>>(
    () => {
      const sel = selection.value ? `&selection=${encodeURIComponent(selection.value)}` : ''
      return `/api/newspdex/ladder/${idRef.value}?market=${market.value}${sel}`
    },
    {
      key: () => `newspdex-ladder-${idRef.value}-${market.value}-${selection.value ?? ''}`,
      server: false,
      watch: [idRef, market, selection],
    },
  )

  const data = computed<LadderData | null>(() => result.data.value?.data ?? null)

  /** 下拉当前选中键：用户已选 → 用户值；否则跟随后端 active。 */
  const activeKey = computed(() => selection.value ?? data.value?.active?.key ?? '')

  function setMarket(m: string) {
    if (m === market.value) return
    market.value = m
    selection.value = null // 切市场重置，让后端取默认/最热
  }

  function setSelection(key: string) {
    if (key === activeKey.value) return
    selection.value = key
  }

  // 30s 轮询（盘口实时变化）
  usePolling(() => result.refresh(), 30_000, { pending: result.pending, errorRef: result.error })

  return {
    data,
    market,
    activeKey,
    setMarket,
    setSelection,
    pending: result.pending,
    refresh: result.refresh,
  }
}
