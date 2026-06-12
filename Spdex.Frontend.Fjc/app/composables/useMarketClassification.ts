import dayjs from 'dayjs'

// ─── Types ───

export type MarketCategoryKey = 'match' | 'exact' | 'half' | 'other'
export type MarketFamilyKey = 'moneyline' | 'spread' | 'totals' | 'team_totals' | 'btts' | 'exact' | 'half' | 'other'

// ─── Market type normalization ───

export function normalizeMarketType(type: string | null | undefined): string {
  return (type ?? '').trim().toLowerCase()
}

// ─── Market type detection ───

export function isExactScoreMarket(type: string, question = ''): boolean {
  const t = normalizeMarketType(type)
  const q = normalizeMarketType(question)
  return t === 'soccer_exact_score'
    || t === 'soccer_correct_score'
    || t.includes('exact_score')
    || t.includes('correct_score')
    || (t.includes('exact') && t.includes('score'))
    || (t.includes('correct') && t.includes('score'))
    || q.startsWith('exact score:')
    || q.startsWith('correct score:')
    || q.includes('exact score')
    || q.includes('correct score')
}

// 半场/上下半场盘口（半场结果 + 上/下半场总分 + 半场球队总分）——统一归到「半场」分类。
export function isHalftimeMarket(type: string, question = ''): boolean {
  const t = normalizeMarketType(type)
  const q = normalizeMarketType(question)
  return t === 'soccer_halftime_result'
    || t.includes('halftime')
    || t.includes('half_time')
    || t.includes('first_half')
    || t.includes('second_half')
    || t.includes('1st_half')
    || t.includes('2nd_half')
    || q.includes('halftime')
    || q.includes('half-time')
    || q.includes('at halftime')
    || q.includes('1st half')
    || q.includes('2nd half')
    || q.includes('first half')
    || q.includes('second half')
}

export function isSpreadMarket(type: string, question = ''): boolean {
  const t = normalizeMarketType(type)
  const q = normalizeMarketType(question)
  return t === 'spread'
    || t === 'spreads'
    || t.includes('spread')
    || q.startsWith('spread:')
}

// 任意「总进球/大小」盘口（全场/球队/半场）——仅用于盘口线解析与 Over/Under 标签，不用于分类。
export function isAnyTotalsLike(type: string, question = ''): boolean {
  const t = normalizeMarketType(type)
  const q = normalizeMarketType(question)
  return t.includes('total')
    || q.includes('o/u')
    || q.includes('over ')
    || q.includes('under ')
}

function isTeamTotalsType(type: string): boolean {
  return normalizeMarketType(type).includes('team_total')
}

// 严格「全场总进球」：是 totals-like，但不是球队总分、也不是半场/上下半场。
export function isTotalsMarket(type: string, question = ''): boolean {
  return isAnyTotalsLike(type, question)
    && !isTeamTotalsType(type)
    && !isHalftimeMarket(type, question)
}

// 全场「球队总分」：某队的总进球 O/U（soccer_team_totals）。
export function isTeamTotalsMarket(type: string, question = ''): boolean {
  return isTeamTotalsType(type) && !isHalftimeMarket(type, question)
}

export function isBttsMarket(type: string, question = ''): boolean {
  const t = normalizeMarketType(type)
  const q = normalizeMarketType(question)
  return t === 'both_teams_to_score'
    || t.includes('both_teams_to_score')
    || q.includes('both teams to score')
}

export function isMoneylineMarket(type: string, question = ''): boolean {
  const t = normalizeMarketType(type)
  const q = normalizeMarketType(question)
  return t === 'moneyline'
    || t.includes('moneyline')
    || q.startsWith('will ')
    || q.includes(' end in a draw')
}

// ─── Outcome label mapping ───

/**
 * 根据市场类型将 Yes/No 转换为上下文标签。
 * 总分市场: Yes → Over, No → Under
 * 让分市场: Yes → 赢盘, No → 输盘
 * BTTS市场: Yes/No 保持
 * 其他: 保持 Yes/No
 */
export function outcomeLabel(outcome: string, sportsMarketType: string, question = ''): string {
  if (isAnyTotalsLike(sportsMarketType, question)) {
    return outcome === 'Yes' ? 'Over' : outcome === 'No' ? 'Under' : outcome
  }
  if (isSpreadMarket(sportsMarketType, question)) {
    return outcome === 'Yes' ? '赢盘' : outcome === 'No' ? '输盘' : outcome
  }
  return outcome
}

// ─── Market classification ───

export function marketCategory(type: string, question: string): MarketCategoryKey {
  if (isExactScoreMarket(type, question)) return 'exact'
  if (isHalftimeMarket(type, question)) return 'half'
  if (
    isMoneylineMarket(type, question)
    || isSpreadMarket(type, question)
    || isTotalsMarket(type, question)
    || isTeamTotalsMarket(type, question)
    || isBttsMarket(type, question)
  ) {
    return 'match'
  }
  return 'other'
}

export function marketFamily(type: string, question: string): MarketFamilyKey {
  if (isExactScoreMarket(type, question)) return 'exact'
  if (isHalftimeMarket(type, question)) return 'half'
  if (isSpreadMarket(type, question)) return 'spread'
  if (isTeamTotalsMarket(type, question)) return 'team_totals'
  if (isTotalsMarket(type, question)) return 'totals'
  if (isBttsMarket(type, question)) return 'btts'
  if (isMoneylineMarket(type, question)) return 'moneyline'
  return 'other'
}

export function categoryOrder(key: MarketCategoryKey): number {
  switch (key) {
    case 'match': return 0
    case 'exact': return 1
    case 'half': return 2
    default: return 9
  }
}

export function marketCategoryLabel(key: MarketCategoryKey): string {
  switch (key) {
    case 'match': return '比赛盘口'
    case 'exact': return '准确比分'
    case 'half': return '半场结果'
    default: return '其他'
  }
}

export function marketFamilyLabel(key: MarketFamilyKey): string {
  switch (key) {
    case 'moneyline': return '独赢'
    case 'spread': return '让分'
    case 'totals': return '总分'
    case 'team_totals': return '球队总分'
    case 'btts': return '双方进球'
    case 'exact': return '准确比分'
    case 'half': return '半场结果'
    default: return '其他'
  }
}

export function marketFamilyOrder(key: MarketFamilyKey): number {
  switch (key) {
    case 'moneyline': return 0
    case 'spread': return 1
    case 'totals': return 2
    case 'team_totals': return 3
    case 'btts': return 4
    case 'exact': return 5
    case 'half': return 6
    default: return 9
  }
}

// ─── Line parsing ───

export function parseLineValue(
  type: string,
  question: string,
  groupItemTitle: string | null | undefined = null,
): number | null {
  // 线值优先从 groupItemTitle（如 "Over 3.5" / "Spread: TeamA (-1.5)"）解析：分组市场的真实线在此，
  // question 往往是事件级共享文本、会把不同线折叠成同一条；question 仅作兜底。
  const sources = [groupItemTitle, question].filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0,
  )

  if (isSpreadMarket(type, question)) {
    for (const src of sources) {
      const match = src.match(/([+-]?\d+(?:\.\d+)?)(?!.*[+-]?\d)/)
      if (match) {
        const value = Number(match[1])
        if (Number.isFinite(value)) return Math.abs(value)
      }
    }
    return null
  }

  if (isAnyTotalsLike(type, question)) {
    for (const src of sources) {
      const ou = src.match(/O\/U\s*([0-9]+(?:\.[0-9]+)?)/i)
      if (ou) {
        const value = Number(ou[1])
        if (Number.isFinite(value)) return value
      }
      const overUnder = src.match(/(?:over|under)\s*([0-9]+(?:\.[0-9]+)?)/i)
      if (overUnder) {
        const value = Number(overUnder[1])
        if (Number.isFinite(value)) return value
      }
      const trailing = src.match(/([0-9]+(?:\.[0-9]+)?)(?!.*[0-9])/)
      if (trailing) {
        const value = Number(trailing[1])
        if (Number.isFinite(value)) return value
      }
    }
  }

  return null
}

export function formatLineLabel(value: number): string {
  if (Number.isInteger(value)) return value.toString()
  return value.toFixed(2).replace(/\.?0+$/, '')
}

// ─── Safe dayjs parsing ───

export function safeDayjs(utc: string | null | undefined): dayjs.Dayjs | null {
  if (!utc) return null
  const d = dayjs(utc)
  return d.isValid() ? d : null
}
