import dayjs from 'dayjs'

// ─── Types ───

export type MarketCategoryKey = 'match' | 'exact' | 'half' | 'other'
export type MarketFamilyKey = 'moneyline' | 'spread' | 'totals' | 'btts' | 'exact' | 'half' | 'other'

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

export function isHalftimeMarket(type: string, question = ''): boolean {
  const t = normalizeMarketType(type)
  const q = normalizeMarketType(question)
  return t === 'soccer_halftime_result'
    || t.includes('halftime')
    || t.includes('half_time')
    || q.includes('halftime')
    || q.includes('half-time')
    || q.includes('at halftime')
}

export function isSpreadMarket(type: string, question = ''): boolean {
  const t = normalizeMarketType(type)
  const q = normalizeMarketType(question)
  return t === 'spread'
    || t === 'spreads'
    || t.includes('spread')
    || q.startsWith('spread:')
}

export function isTotalsMarket(type: string, question = ''): boolean {
  const t = normalizeMarketType(type)
  const q = normalizeMarketType(question)
  return t === 'totals'
    || t === 'total'
    || t === 'total_goals'
    || t.includes('total')
    || q.includes('o/u')
    || q.includes('over ')
    || q.includes('under ')
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
  if (isTotalsMarket(sportsMarketType, question)) {
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
    case 'btts': return 3
    case 'exact': return 4
    case 'half': return 5
    default: return 9
  }
}

// ─── Line parsing ───

export function parseLineValue(type: string, question: string): number | null {
  if (isSpreadMarket(type, question)) {
    const match = question.match(/([+-]?\d+(?:\.\d+)?)(?!.*[+-]?\d)/)
    if (!match) return null
    const value = Number(match[1])
    return Number.isFinite(value) ? Math.abs(value) : null
  }

  if (isTotalsMarket(type, question)) {
    const ou = question.match(/O\/U\s*([0-9]+(?:\.[0-9]+)?)/i)
    if (ou) {
      const value = Number(ou[1])
      return Number.isFinite(value) ? value : null
    }
    const overUnder = question.match(/(?:over|under)\s*([0-9]+(?:\.[0-9]+)?)/i)
    if (overUnder) {
      const value = Number(overUnder[1])
      return Number.isFinite(value) ? value : null
    }
    const trailing = question.match(/([0-9]+(?:\.[0-9]+)?)(?!.*[0-9])/)
    if (trailing) {
      const value = Number(trailing[1])
      return Number.isFinite(value) ? value : null
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
