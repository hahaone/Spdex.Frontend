/**
 * 时光机：拉指定历史时刻的盘口快照。
 * 命令式调用（不自动 polling），由前端时间轴按钮触发。
 */

import type { ApiResponse } from '~/types/auth'
import type { MarketMetricRow } from '~/types/market'

interface BackendMarketRow {
  key: string
  selection: string
  price: string
  turnover: string
  bfIndex?: number
  ratio?: string
  pnl?: number
  listing?: string
  heat?: number
}

interface BackendMarketSection {
  title: string
  mode: string
  rows: BackendMarketRow[]
  note: string | null
}

export interface MatchSnapshot {
  eventId: number
  homeTeam: string
  awayTeam: string
  matchTime: string
  requestedAt: string
  actualHoursOffset: number
  standard: MarketMetricRow[]
  goals: MarketMetricRow[]
  handicap: MarketMetricRow[]
  accessLocked: boolean
  lockMessage: string | null
}

interface BackendSnapshot {
  eventId: number
  homeTeam: string
  awayTeam: string
  matchTime: string
  requestedAt: string
  actualHoursOffset: number
  standard: BackendMarketSection | null
  goals: BackendMarketSection | null
  handicap: BackendMarketSection | null
  accessLocked: boolean
  lockMessage: string | null
}

function mapRow(r: BackendMarketRow): MarketMetricRow {
  return {
    key: r.key,
    selection: r.selection,
    price: r.price,
    turnover: r.turnover,
    bfIndex: r.bfIndex,
    ratio: r.ratio,
    pnl: r.pnl,
    listing: r.listing,
    heat: r.heat,
  }
}

function mapSection(s: BackendMarketSection | null): MarketMetricRow[] {
  return s?.rows.map(mapRow) ?? []
}

export function useMatchSnapshot() {
  async function fetchSnapshot(eventId: number, atIso: string): Promise<MatchSnapshot | null> {
    try {
      const res = await $apiFetch<ApiResponse<BackendSnapshot>>(
        `/api/newspdex/match-detail/${eventId}/snapshot`,
        { query: { at: atIso } },
      )
      if (res.code !== 0 || !res.data) return null
      const d = res.data
      return {
        eventId: d.eventId,
        homeTeam: d.homeTeam,
        awayTeam: d.awayTeam,
        matchTime: d.matchTime,
        requestedAt: d.requestedAt,
        actualHoursOffset: d.actualHoursOffset,
        standard: mapSection(d.standard),
        goals: mapSection(d.goals),
        handicap: mapSection(d.handicap),
        accessLocked: d.accessLocked,
        lockMessage: d.lockMessage,
      }
    }
    catch {
      return null
    }
  }

  return { fetchSnapshot }
}
