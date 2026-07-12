import type { ApiResponse } from '~/types/api'
import type { MatchListItem, MatchListResult } from '~/types/match'

interface MatchListParams {
  date?: string | null
  league?: string | null
  jc?: number
  status?: string | null
  page?: number
  pageSize?: number
  sport?: string // 'soccer' | 'basketball'
}

type RefreshOptions = { silent?: boolean } | Event
type MatchListResponse = ApiResponse<MatchListResult>

function isSilentRefresh(options?: RefreshOptions): boolean {
  return !!options && 'silent' in options && options.silent === true
}

function paramsSignature(params?: MatchListParams | null): string {
  const entries = Object.entries(params ?? {})
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))

  return JSON.stringify(entries)
}

function hasPositive(value: unknown): boolean {
  const numberValue = Number(value ?? 0)
  return Number.isFinite(numberValue) && numberValue > 0
}

function hasAnyPositive(values: unknown[]): boolean {
  return values.some(hasPositive)
}

function preserveWhenMissing<T extends MatchListItem, K extends keyof T>(
  target: T,
  previous: T,
  keys: K[],
  hasCurrentValue: boolean,
) {
  if (hasCurrentValue) return

  for (const key of keys) {
    target[key] = previous[key]
  }
}

function mergeMatchItem(previous: MatchListItem | undefined, incoming: MatchListItem): MatchListItem {
  if (!previous) return incoming

  const merged: MatchListItem = { ...incoming }

  preserveWhenMissing(merged, previous, ['asianAvrLet'], !!incoming.asianAvrLet)
  preserveWhenMissing(merged, previous, ['bfAmount'], hasPositive(incoming.bfAmount))
  preserveWhenMissing(merged, previous, ['asianAmount'], hasPositive(incoming.asianAmount))
  preserveWhenMissing(
    merged,
    previous,
    ['bfIndexHome', 'bfIndexDraw', 'bfIndexAway'],
    hasAnyPositive([incoming.bfIndexHome, incoming.bfIndexDraw, incoming.bfIndexAway]),
  )
  preserveWhenMissing(
    merged,
    previous,
    ['maxBet', 'maxBetPercent', 'maxBetAttr', 'maxBetPriceChange', 'maxBetOdds', 'maxBetTime', 'maxBetSelection', 'pMark'],
    hasPositive(incoming.maxBet),
  )
  preserveWhenMissing(
    merged,
    previous,
    ['bfMaxBet', 'bfMaxBetPercent', 'bfMaxBetAttr', 'bfMaxBetPriceChange', 'bfMaxBetOdds', 'bfMaxBetTime', 'bfMaxBetSelection', 'bfPMark'],
    hasPositive(incoming.bfMaxBet),
  )

  return merged
}

function mergeMatchListResponse(
  previous: MatchListResponse | null,
  incoming: MatchListResponse,
): MatchListResponse {
  const previousItems = previous?.data?.items ?? []
  const incomingData = incoming.data
  if (!incomingData || previousItems.length === 0) return incoming

  const previousByEventId = new Map(
    previousItems.map(item => [item.match.eventId, item]),
  )

  return {
    ...incoming,
    data: {
      ...incomingData,
      items: incomingData.items.map(item =>
        mergeMatchItem(previousByEventId.get(item.match.eventId), item),
      ),
    },
  }
}

export function useMatchList(params: Ref<MatchListParams>) {
  const refreshing = ref(false)
  const stableData = shallowRef<MatchListResponse | null>(null)
  const currentSignature = ref(paramsSignature(params.value))
  const lastStableSignature = ref<string | null>(null)

  const fetchResult = useApiFetch<ApiResponse<MatchListResult>>('/api/matches', {
    params,
    watch: [params],
  })

  watch(
    params,
    (value) => {
      const nextSignature = paramsSignature(value)
      if (nextSignature === currentSignature.value) return

      currentSignature.value = nextSignature
      stableData.value = null
      lastStableSignature.value = null
    },
    { deep: true },
  )

  watch(
    fetchResult.data,
    (incoming) => {
      if (!incoming) return

      const signature = currentSignature.value
      const incomingItems = incoming.data?.items ?? []
      const stableItems = stableData.value?.data?.items ?? []

      if (
        lastStableSignature.value === signature
        && stableItems.length > 0
        && incomingItems.length === 0
      ) {
        return
      }

      stableData.value = lastStableSignature.value === signature
        ? mergeMatchListResponse(stableData.value, incoming)
        : incoming
      lastStableSignature.value = signature
    },
    { immediate: true },
  )

  /** 手动刷新（不改变参数，仅重新请求） */
  async function manualRefresh(options?: RefreshOptions) {
    const silent = isSilentRefresh(options)
    if (!silent) {
      refreshing.value = true
    }

    try {
      await fetchResult.refresh()
    }
    finally {
      if (!silent) {
        refreshing.value = false
      }
    }
  }

  return {
    ...fetchResult,
    data: stableData,
    refreshing,
    manualRefresh,
  }
}
