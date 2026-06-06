/**
 * 经典工作台「整行补全」——把详情 BFF 的真实高阶口径（模拟盈亏/冷热/真实比例/欧均/凯利方差/让分/进球）
 * 补进列表行,使经典宽表能像旧站一样整页呈现。
 *
 * 关键纪律:**仅在该赛事块滚入视口(active=true)时才拉一次详情**,绝不整页 N 场并发拉。
 * 详情 BFF 单场就贵(6 lane),靠「分页 + 视口门控 + 30s 服务端缓存」把成本压住。
 */

import type { ApiResponse } from '~/types/auth'

export interface EnrichRow {
  key: string
  selection: string
  price: string
  turnover: string
  bfIndex?: number
  ratio?: string
  pnl?: number
  heat?: number
  euroAvg?: number
  variance?: number
}

interface BackendRow {
  key: string
  selection: string
  price: string
  turnover: string
  bfIndex?: number
  ratio?: string
  pnl?: number
  heat?: number
  euroAvg?: number
  variance?: number
}
interface BackendSection { rows: BackendRow[] }
interface BackendDetail {
  standard: BackendSection | null
  handicap: BackendSection | null
  goals: BackendSection | null
  access: { standard: boolean, handicap: boolean, goals: boolean, cs: boolean, corner: boolean }
}

export interface MatchEnrich {
  loaded: boolean
  standard: Record<string, EnrichRow>
  handicap: Record<string, EnrichRow>
  goals: Record<string, EnrichRow>
  access: { standard: boolean, handicap: boolean, goals: boolean }
  handicapTotal: number
}

function indexRows(section: BackendSection | null | undefined): Record<string, EnrichRow> {
  const map: Record<string, EnrichRow> = {}
  for (const r of section?.rows ?? []) map[r.key] = r
  return map
}

/** 把后端格式化金额串("1,234"/"-")还原为数字,用于让分总成交求和。 */
function parseAmount(s: string | undefined): number {
  if (!s) return 0
  const n = Number(s.replace(/[^0-9.-]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function useClassicMatchEnrich(eventId: Ref<number>, active: Ref<boolean>) {
  const enrich = ref<MatchEnrich | null>(null)
  let loadedId = 0
  let inflight = false

  async function load() {
    const id = eventId.value
    if (inflight || id <= 0) return
    if (enrich.value && loadedId === id) return
    inflight = true
    try {
      const res = await $apiFetch<ApiResponse<BackendDetail>>(`/api/newspdex/match-detail/${id}`)
      const d = res?.data
      if (!d) return
      const handicap = indexRows(d.handicap)
      enrich.value = {
        loaded: true,
        standard: indexRows(d.standard),
        handicap,
        goals: indexRows(d.goals),
        access: { standard: !!d.access?.standard, handicap: !!d.access?.handicap, goals: !!d.access?.goals },
        handicapTotal: ['home', 'draw', 'away'].reduce((sum, k) => sum + parseAmount(handicap[k]?.turnover), 0),
      }
      loadedId = id
    }
    catch {
      // 静默降级:保留上次值,该行高阶列显示 "-"
    }
    finally {
      inflight = false
    }
  }

  watch(active, (v) => { if (v) load() }, { immediate: true })
  watch(eventId, () => { enrich.value = null; loadedId = 0; if (active.value) load() })

  return { enrich }
}
