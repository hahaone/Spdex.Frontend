/**
 * 赛事详情聚合（BFF）。
 * 调 /api/newspdex/match-detail/{eventId}，把后端返回的 4 个 section 映射为前端 MarketDetail。
 */

import type { ApiResponse } from '~/types/auth'
import type { MarketMetricRow, MarketRowExtreme } from '~/types/market'
import type { MatchStatus, MatchSummary } from '~/types/match'

interface BackendMarketRow {
  key: string
  selection: string
  price: string
  turnover: string
  bfIndex?: number
  polyIndex?: number
  ratio?: string
  pnl?: number
  listing?: string
  heat?: number
  euroAvg?: number
  variance?: number
  asian?: string
  balance?: string
  high?: MarketRowExtreme | null
  low?: MarketRowExtreme | null
}

interface BackendMarketSection {
  title: string
  mode: string
  rows: BackendMarketRow[]
  note: string | null
}

interface BackendDetailAccess {
  standard: boolean
  poly: boolean
  goals: boolean
  handicap: boolean
  tradeDetails: boolean
  euroOdds: boolean
  cs: boolean
  corner: boolean
}

export interface EuroMarketRow {
  name: string
  init: number[]
  cur: number[]
}

export interface EuroMarketAvg {
  init: number[]
  cur: number[]
}

/** 一条盘口线（胜平负无线/让球某线/大小某线），≤3 列。 */
export interface EuroLine {
  key: string
  label: string
  columns: string[]
  rows: EuroMarketRow[]
  average: EuroMarketAvg | null
}

export interface EuroMarket {
  key: string
  label: string
  lines: EuroLine[]
}

/** 富欧赔：盘口（胜平负/让球/大小）→ 盘口线 → 多公司初赔 + 即时。移动端每线独立成表。 */
export interface EuroOddsSection {
  title: string
  markets: EuroMarket[]
}

interface BackendMatchDetail {
  match: {
    eventId: number
    matchTime: string
    leagueCode: string
    leagueName: string
    homeTeam: string
    awayTeam: string
    status: MatchStatus
    isJc: boolean
    marketType: string
    handicap: string
    bfIndex: number[]
    polyIndex: number[]
    bfAmount: number
    polyAmount: number
    flags: string[]
    pMark: string | null
    asianIndex?: number
    asianIndexTo?: string
  }
  standard: BackendMarketSection | null
  poly: BackendMarketSection | null
  goals: BackendMarketSection | null
  handicap: BackendMarketSection | null
  cs: BackendMarketSection | null
  corner: BackendMarketSection | null
  euroOdds: EuroOddsSection | null
  access: BackendDetailAccess
}

function toTriple(arr: number[] | undefined): [number, number, number] {
  if (!arr || arr.length < 3) return [0, 0, 0]
  return [arr[0] ?? 0, arr[1] ?? 0, arr[2] ?? 0]
}

function mapRow(row: BackendMarketRow): MarketMetricRow {
  return {
    key: row.key,
    selection: row.selection,
    price: row.price,
    turnover: row.turnover,
    bfIndex: row.bfIndex,
    polyIndex: row.polyIndex,
    ratio: row.ratio,
    pnl: row.pnl,
    listing: row.listing,
    heat: row.heat,
    euroAvg: row.euroAvg,
    variance: row.variance,
    asian: row.asian,
    balance: row.balance,
    high: row.high,
    low: row.low,
  }
}

function mapSection(section: BackendMarketSection | null): MarketMetricRow[] {
  if (!section) return []
  return section.rows.map(mapRow)
}

function mapMatch(m: BackendMatchDetail['match']): MatchSummary {
  return {
    eventId: m.eventId,
    matchTime: m.matchTime,
    leagueCode: m.leagueCode || '',
    leagueName: m.leagueName || '',
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    status: m.status,
    isJc: m.isJc,
    marketType: m.marketType || '胜负',
    handicap: m.handicap || '',
    prices: [0, 0, 0],
    turnovers: ['', '', ''],
    bfIndex: toTriple(m.bfIndex),
    polyIndex: toTriple(m.polyIndex),
    flags: m.flags ?? [],
    asianIndex: m.asianIndex ?? 0,
    asianIndexTo: m.asianIndexTo ?? '',
  }
}

export interface DetailAccess {
  standard: boolean
  poly: boolean
  goals: boolean
  handicap: boolean
  tradeDetails: boolean
  euroOdds: boolean
  cs: boolean
  corner: boolean
}

export function useMatchDetail(eventId: MaybeRef<number>) {
  const idRef = computed(() => unref(eventId))

  const result = useApiFetch<ApiResponse<BackendMatchDetail>>(
    () => `/api/newspdex/match-detail/${idRef.value}`,
    {
      key: () => `newspdex-match-detail-${idRef.value}`,
      server: false,
      watch: [idRef],
    },
  )

  // 30s 自动刷新（赔率/成交实时变化）
  usePolling(() => result.refresh(), 30_000, { pending: result.pending, errorRef: result.error })

  const detail = computed(() => {
    const data = result.data.value?.data
    if (!data) return null
    return {
      match: mapMatch(data.match),
      standard: mapSection(data.standard),
      poly: mapSection(data.poly),
      goals: mapSection(data.goals),
      handicap: mapSection(data.handicap),
      cs: mapSection(data.cs),
      corner: mapSection(data.corner),
    }
  })

  const access = computed<DetailAccess>(() => result.data.value?.data?.access ?? {
    standard: false,
    poly: false,
    goals: false,
    handicap: false,
    tradeDetails: false,
    euroOdds: false,
    cs: false,
    corner: false,
  })

  /** 各 section note。 */
  const sectionNotes = computed(() => ({
    standard: result.data.value?.data?.standard?.note ?? null,
    poly: result.data.value?.data?.poly?.note ?? null,
    goals: result.data.value?.data?.goals?.note ?? null,
    handicap: result.data.value?.data?.handicap?.note ?? null,
    cs: result.data.value?.data?.cs?.note ?? null,
    corner: result.data.value?.data?.corner?.note ?? null,
    euroOdds: null,
  }))

  /** 欧赔 section（独立结构，不走 MarketMetricRow）。 */
  const euroOdds = computed<EuroOddsSection | null>(() => result.data.value?.data?.euroOdds ?? null)

  return {
    detail,
    access,
    euroOdds,
    sectionNotes,
    pending: result.pending,
    error: result.error,
    refresh: result.refresh,
  }
}
