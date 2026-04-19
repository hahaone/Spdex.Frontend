import { ref, computed, watch, type Ref, type ComputedRef } from 'vue'
import type {
  PolymarketSoccerMatchLink,
  PolymarketEventTradesAggregate,
  PolymarketEventBookAggregate,
  PolymarketMarketTradesAggregate,
  PolymarketMarketBookAggregate,
} from '~/types/polymarket'
import { formatPolyOdds, type OddsFormat } from '~/composables/usePolymarketMetrics'
import {
  marketCategory,
  marketFamily,
  marketCategoryLabel,
  marketFamilyLabel,
  marketFamilyOrder,
  categoryOrder,
  parseLineValue,
  formatLineLabel,
  safeDayjs,
  type MarketCategoryKey,
  type MarketFamilyKey,
} from '~/composables/useMarketClassification'

// ─── Types ───

export type MarketViewTabKey = 'orderbook' | 'graph' | 'about' | 'trades' | 'positions'
export type MarketSide = 'yes' | 'no'

export interface MarketEntry {
  key: string
  side: MarketSide
  optionLabel: string
  optionOrder: number
  categoryKey: MarketCategoryKey
  familyKey: MarketFamilyKey
  familyLabel: string
  familyOrder: number
  lineKey: string
  lineLabel: string
  lineOrder: number
}

export const MARKET_VIEW_TABS: Array<{ key: MarketViewTabKey; label: string }> = [
  { key: 'orderbook', label: 'Order Book' },
  { key: 'graph', label: 'Graph' },
  { key: 'about', label: 'About' },
  { key: 'trades', label: '成交明细' },
  { key: 'positions', label: '持仓排行' },
]

// ─── Internal helpers ───

function buildMarketKey(marketId: string | null | undefined, conditionId: string | null | undefined, fallback: string): string {
  if (marketId) return marketId
  if (conditionId) return conditionId
  return fallback
}

function tradeMarketKey(market: PolymarketMarketTradesAggregate, index: number): string {
  return buildMarketKey(market.marketId, market.conditionId, `trade:${index}`)
}

function bookMarketKey(market: PolymarketMarketBookAggregate, index: number): string {
  return buildMarketKey(market.marketId, market.conditionId, `book:${index}`)
}

function isMarketMatched(key: string, marketId: string | null | undefined, conditionId: string | null | undefined): boolean {
  return key === marketId || (!!conditionId && key === conditionId)
}

function normalizedQuestion(question: string): string {
  return question.replace(/\s+/g, ' ').trim()
}

function extractTeamLabel(question: string): string | null {
  const cleaned = normalizedQuestion(question)
  if (/draw/i.test(cleaned)) return '平局'
  const will = cleaned.match(/^Will (.+?) (?:win|be winning|be leading|lead|score first|at halftime)/i)
    ?? cleaned.match(/^Will (.+?)\?/i)
  if (!will) return null
  return will[1]!.trim()
}

function extractExactScoreLabel(question: string): string | null {
  const cleaned = normalizedQuestion(question)
  const direct = cleaned.match(/(?:Exact|Correct)\s+Score:\s*([0-9]+[-:][0-9]+)/i)
  if (direct) return direct[1]!.replace(':', '-')
  const pair = cleaned.match(/(\d+)\s*-\s*(\d+)/)
  if (!pair) return null
  return `${pair[1]}-${pair[2]}`
}

function marketOptionMeta(
  type: string,
  question: string,
  primaryLink: PolymarketSoccerMatchLink | null,
): { label: string; order: number } {
  const cleaned = normalizedQuestion(question)
  const family = marketFamily(type, question)
  const lineValue = parseLineValue(type, question)
  const lineText = lineValue === null ? '' : formatLineLabel(lineValue)

  if (family === 'moneyline' || family === 'half') {
    const teamLabel = extractTeamLabel(cleaned)
    if (teamLabel) {
      return { label: teamLabel, order: optionOrderByTeam(teamLabel, primaryLink) }
    }
  }

  if (family === 'spread') {
    const spread = cleaned.match(/Spread:\s*(.+)/i)
    if (spread) {
      const label = spread[1]!.trim()
      const handicap = label.match(/\(([+-]?\d+(?:\.\d+)?)\)/)
      const handicapValue = handicap ? Number(handicap[1]) : null
      return { label, order: handicapValue == null || Number.isNaN(handicapValue) ? 9 : (handicapValue < 0 ? 0 : 1) }
    }
  }

  if (family === 'totals') {
    if (/\bover\b/i.test(cleaned) || /^\s*o\s*[\d.]+/i.test(cleaned)) {
      return { label: lineText ? `大 ${lineText}` : '大', order: 0 }
    }
    if (/\bunder\b/i.test(cleaned) || /^\s*u\s*[\d.]+/i.test(cleaned)) {
      return { label: lineText ? `小 ${lineText}` : '小', order: 1 }
    }
    return { label: lineText ? `大小 ${lineText}` : '大小', order: 0 }
  }

  if (family === 'btts') {
    if (/\bno\b/i.test(cleaned)) return { label: '否', order: 1 }
    if (/\byes\b/i.test(cleaned)) return { label: '是', order: 0 }
    return { label: '双方进球', order: 0 }
  }

  if (family === 'exact') {
    const scoreLabel = extractExactScoreLabel(cleaned)
    if (scoreLabel) return { label: scoreLabel, order: 0 }
  }

  return { label: cleaned.slice(0, 30) || type || '选项', order: 9 }
}

function optionOrderByTeam(teamLabel: string, link: PolymarketSoccerMatchLink | null): number {
  if (teamLabel === '平局') return 1
  const home = link?.polymarketHomeTeam?.trim().toLowerCase()
  const away = link?.polymarketAwayTeam?.trim().toLowerCase()
  const team = teamLabel.trim().toLowerCase()
  if (home && (team.includes(home) || home.includes(team))) return 0
  if (away && (team.includes(away) || away.includes(team))) return 2
  return 9
}

function needsDualSides(family: MarketFamilyKey): boolean {
  return family === 'totals' || family === 'spread' || family === 'btts'
}

function resolveKeyAndSide(key: string): { baseKey: string; side: MarketSide } {
  if (key.endsWith('::no')) return { baseKey: key.slice(0, -4), side: 'no' }
  return { baseKey: key, side: 'yes' }
}

function buildMarketEntry(
  key: string,
  sportsType: string,
  question: string,
  primaryLink: PolymarketSoccerMatchLink | null,
): MarketEntry {
  const categoryKey = marketCategory(sportsType, question)
  const familyKey = marketFamily(sportsType, question)
  const lineValue = parseLineValue(sportsType, question)
  const lineLabel = lineValue === null ? 'default' : formatLineLabel(lineValue)
  const option = marketOptionMeta(sportsType, question, primaryLink)

  let optionLabel = option.label || key
  let optionOrder = option.order
  if (familyKey === 'totals' && optionLabel.startsWith('大小 ')) {
    optionLabel = optionLabel.replace('大小 ', '大 ')
    optionOrder = 0
  }

  return {
    key,
    side: 'yes',
    optionLabel,
    optionOrder,
    categoryKey,
    familyKey,
    familyLabel: marketFamilyLabel(familyKey),
    familyOrder: marketFamilyOrder(familyKey),
    lineKey: lineLabel,
    lineLabel: lineValue === null ? '默认' : lineLabel,
    lineOrder: lineValue === null ? 0 : lineValue,
  }
}

function buildCounterEntry(
  yesEntry: MarketEntry,
  question: string,
  primaryLink: PolymarketSoccerMatchLink | null,
): MarketEntry {
  const counter = counterOptionMeta(yesEntry.familyKey, question, yesEntry.lineOrder, primaryLink)
  return { ...yesEntry, key: `${yesEntry.key}::no`, side: 'no', optionLabel: counter.label, optionOrder: counter.order }
}

function counterOptionMeta(
  family: MarketFamilyKey,
  question: string,
  lineValue: number,
  primaryLink: PolymarketSoccerMatchLink | null,
): { label: string; order: number } {
  const lineText = lineValue > 0 ? formatLineLabel(lineValue) : ''

  if (family === 'totals') return { label: lineText ? `小 ${lineText}` : '小', order: 1 }
  if (family === 'btts') return { label: '否', order: 1 }

  if (family === 'spread') {
    const cleaned = normalizedQuestion(question)
    const spread = cleaned.match(/Spread:\s*(.+)/i)
    if (spread) {
      const labelPart = spread[1]!.trim()
      const teamHandicap = labelPart.match(/(.+?)\s*\(([+-]?\d+(?:\.\d+)?)\)/)
      if (teamHandicap) {
        const team = teamHandicap[1]!.trim()
        const handicap = Number(teamHandicap[2])
        const counterHandicap = -handicap
        const home = primaryLink?.polymarketHomeTeam?.trim()
        const away = primaryLink?.polymarketAwayTeam?.trim()
        let counterTeam = '对手'
        if (home && away) {
          const teamLower = team.toLowerCase()
          if (teamLower.includes(home.toLowerCase()) || home.toLowerCase().includes(teamLower)) counterTeam = away
          else counterTeam = home
        }
        const sign = counterHandicap > 0 ? '+' : ''
        return { label: `${counterTeam} (${sign}${counterHandicap})`, order: counterHandicap >= 0 ? 1 : 0 }
      }
    }
    return { label: '对手', order: 1 }
  }

  return { label: 'No', order: 1 }
}

// ─── Composable ───

export function useMarketSelection(
  trades: Ref<PolymarketEventTradesAggregate | null> | ComputedRef<PolymarketEventTradesAggregate | null>,
  book: Ref<PolymarketEventBookAggregate | null> | ComputedRef<PolymarketEventBookAggregate | null>,
  links: Ref<PolymarketSoccerMatchLink[]> | ComputedRef<PolymarketSoccerMatchLink[]>,
  oddsFormat: Ref<OddsFormat>,
) {
  const activeMarketKey = ref<string | null>(null)
  const activeCategoryKey = ref<MarketCategoryKey>('match')
  const activeFamilyKey = ref<MarketFamilyKey>('moneyline')
  const activeLineKey = ref('default')
  const activeViewTab = ref<MarketViewTabKey>('orderbook')

  const primaryLink = computed(() =>
    links.value.find(l => l.matchStatus === 'auto' || l.matchStatus === 'manual')
    ?? links.value[0]
    ?? null,
  )

  const kickoffUtc = computed(() => primaryLink.value?.polymarketKickoffUtc ?? primaryLink.value?.betsapiKickoffUtc ?? null)
  const kickoffTimeLabel = computed(() => { const d = safeDayjs(kickoffUtc.value); return d ? d.format('h:mm A') : '--:--' })
  const kickoffDateLabel = computed(() => { const d = safeDayjs(kickoffUtc.value); return d ? d.format('MMM D') : '--' })

  // ─── Market entries ───

  const allMarketEntries = computed(() => {
    const entries: MarketEntry[] = []
    const seenKeys = new Set<string>()
    const link = primaryLink.value
    const questionByKey = new Map<string, string>()

    ;(trades.value?.markets ?? []).forEach((market, index) => {
      const key = tradeMarketKey(market, index)
      if (seenKeys.has(key)) return
      seenKeys.add(key)
      questionByKey.set(key, market.question)
      entries.push(buildMarketEntry(key, market.sportsMarketType, market.question, link))
    })

    ;(book.value?.markets ?? []).forEach((market, index) => {
      const key = bookMarketKey(market, index)
      if (seenKeys.has(key)) return
      seenKeys.add(key)
      questionByKey.set(key, market.question)
      entries.push(buildMarketEntry(key, market.sportsMarketType, market.question, link))
    })

    const counterEntries: MarketEntry[] = []
    for (const entry of entries) {
      if (!needsDualSides(entry.familyKey)) continue
      if (entry.side !== 'yes') continue
      const question = questionByKey.get(entry.key) ?? ''
      counterEntries.push(buildCounterEntry(entry, question, link))
    }
    entries.push(...counterEntries)

    entries.sort((a, b) => {
      if (a.categoryKey !== b.categoryKey) return categoryOrder(a.categoryKey) - categoryOrder(b.categoryKey)
      if (a.familyOrder !== b.familyOrder) return a.familyOrder - b.familyOrder
      if (a.lineOrder !== b.lineOrder) return a.lineOrder - b.lineOrder
      if (a.optionOrder !== b.optionOrder) return a.optionOrder - b.optionOrder
      return a.optionLabel.localeCompare(b.optionLabel)
    })

    return entries
  })

  // ─── Tab computation ───

  const categoryTabs = computed(() => {
    const counts = new Map<MarketCategoryKey, number>()
    for (const market of allMarketEntries.value) counts.set(market.categoryKey, (counts.get(market.categoryKey) ?? 0) + 1)
    const orderedKeys: MarketCategoryKey[] = ['match', 'exact', 'half', 'other']
    return orderedKeys.filter(key => (counts.get(key) ?? 0) > 0).map(key => ({ key, label: marketCategoryLabel(key), count: counts.get(key) ?? 0 }))
  })

  const categoryMarkets = computed(() => allMarketEntries.value.filter(x => x.categoryKey === activeCategoryKey.value))

  const familyTabs = computed(() => {
    const map = new Map<MarketFamilyKey, { key: MarketFamilyKey; label: string; count: number; order: number }>()
    for (const market of categoryMarkets.value) {
      const current = map.get(market.familyKey)
      if (current) { current.count += 1; continue }
      map.set(market.familyKey, { key: market.familyKey, label: market.familyLabel, count: 1, order: market.familyOrder })
    }
    return [...map.values()].sort((a, b) => a.order - b.order).map(({ key, label, count }) => ({ key, label, count }))
  })

  const familyMarkets = computed(() => categoryMarkets.value.filter(x => x.familyKey === activeFamilyKey.value))

  const lineTabs = computed(() => {
    const map = new Map<string, { key: string; label: string; count: number; order: number }>()
    for (const market of familyMarkets.value) {
      const current = map.get(market.lineKey)
      if (current) { current.count += 1; continue }
      map.set(market.lineKey, { key: market.lineKey, label: market.lineLabel, count: 1, order: market.lineOrder })
    }
    return [...map.values()].sort((a, b) => a.order - b.order).map(({ key, label, count }) => ({ key, label, count }))
  })

  const lineScopedMarkets = computed(() => {
    if (lineTabs.value.length <= 1) return familyMarkets.value
    return familyMarkets.value.filter(x => x.lineKey === activeLineKey.value)
  })

  // ─── Watches (tab cascade reset) ───

  watch(categoryTabs, (categories) => {
    if (categories.length === 0) { activeCategoryKey.value = 'match'; activeFamilyKey.value = 'moneyline'; activeLineKey.value = 'default'; activeMarketKey.value = null; return }
    if (!categories.some(x => x.key === activeCategoryKey.value)) activeCategoryKey.value = categories[0]!.key
  }, { immediate: true })

  watch(familyTabs, (families) => {
    if (families.length === 0) { activeFamilyKey.value = 'moneyline'; return }
    if (!families.some(x => x.key === activeFamilyKey.value)) activeFamilyKey.value = families[0]!.key
  }, { immediate: true })

  watch(lineTabs, (lines) => {
    if (lines.length === 0) { activeLineKey.value = 'default'; return }
    if (!lines.some(x => x.key === activeLineKey.value)) activeLineKey.value = lines[0]!.key
  }, { immediate: true })

  watch(lineScopedMarkets, (markets) => {
    if (markets.length === 0) { activeMarketKey.value = null; return }
    if (!activeMarketKey.value || !markets.some(x => x.key === activeMarketKey.value)) activeMarketKey.value = markets[0]!.key
  }, { immediate: true })

  watch([activeCategoryKey, activeFamilyKey, activeLineKey], () => { activeViewTab.value = 'orderbook' })

  // ─── Active market resolution ───

  function findTradeMarketByKey(key: string): PolymarketMarketTradesAggregate | null {
    const { baseKey } = resolveKeyAndSide(key)
    const markets = trades.value?.markets ?? []
    return markets.find(m => isMarketMatched(baseKey, m.marketId, m.conditionId)) ?? null
  }

  function findBookMarketByKey(key: string): PolymarketMarketBookAggregate | null {
    const { baseKey } = resolveKeyAndSide(key)
    const markets = book.value?.markets ?? []
    return markets.find(m => isMarketMatched(baseKey, m.marketId, m.conditionId)) ?? null
  }

  const activeMarketSide = computed<MarketSide>(() => {
    const key = activeMarketKey.value
    if (!key) return 'yes'
    return resolveKeyAndSide(key).side
  })

  const activeTradeMarket = computed(() => {
    const markets = trades.value?.markets ?? []
    if (markets.length === 0) return null
    const key = activeMarketKey.value
    if (key) {
      const { baseKey } = resolveKeyAndSide(key)
      const matched = markets.find(m => isMarketMatched(baseKey, m.marketId, m.conditionId))
      if (matched) return matched
    }
    return markets[0] ?? null
  })

  const activeBookMarket = computed(() => {
    const markets = book.value?.markets ?? []
    if (markets.length === 0) return null
    const key = activeMarketKey.value
    if (key) {
      const { baseKey } = resolveKeyAndSide(key)
      const matched = markets.find(m => isMarketMatched(baseKey, m.marketId, m.conditionId))
      if (matched) return matched
    }
    return markets[0] ?? null
  })

  const recentTrades = computed(() => {
    const market = activeTradeMarket.value
    // 优先使用后端返回的 topTrades（全量 TTL 窗口内按 size 排序的 TOP N），
    // 避免大单被"最近 N 笔"时间窗口挤出。回退到 recentTrades 兼容旧部署。
    const marketTop = market?.topTrades && market.topTrades.length > 0 ? market.topTrades : null
    const eventTop = trades.value?.topTrades && trades.value.topTrades.length > 0 ? trades.value.topTrades : null
    const raw = marketTop
      ?? (market && market.recentTrades && market.recentTrades.length > 0
        ? market.recentTrades
        : eventTop ?? trades.value?.recentTrades ?? [])
    return [...raw].sort((a, b) => b.size - a.size).slice(0, 50)
  })

  // ─── Display labels ───

  const activeMarketLabel = computed(() => {
    const family = familyTabs.value.find(x => x.key === activeFamilyKey.value)
    const label = family?.label ?? marketFamilyLabel(activeFamilyKey.value)
    if ((activeFamilyKey.value === 'spread' || activeFamilyKey.value === 'totals') && activeLineKey.value !== 'default') {
      return `${label} ${activeLineKey.value}`
    }
    return label
  })

  const activeOptionLabel = computed(() => {
    const selected = lineScopedMarkets.value.find(x => x.key === activeMarketKey.value)
    return selected?.optionLabel ?? lineScopedMarkets.value[0]?.optionLabel ?? ''
  })

  const scopedTradeMarkets = computed(() => {
    const items: PolymarketMarketTradesAggregate[] = []
    const seen = new Set<string>()
    for (const entry of lineScopedMarkets.value) {
      const { baseKey } = resolveKeyAndSide(entry.key)
      if (seen.has(baseKey)) continue
      seen.add(baseKey)
      const market = findTradeMarketByKey(entry.key)
      if (market) items.push(market)
    }
    return items
  })

  const activeMarketNotional = computed(() => {
    const markets = scopedTradeMarkets.value
    const hasVolume = markets.length > 0 && markets.every(m => m.marketVolume != null)
    return hasVolume
      ? markets.reduce((sum, m) => sum + m.marketVolume!, 0)
      : markets.reduce((sum, m) => sum + m.totalNotional, 0)
  })

  const activeMarketTradeCount = computed(() => scopedTradeMarkets.value.reduce((sum, m) => sum + m.tradeCount, 0))

  const activeMarketQuestion = computed(() => activeTradeMarket.value?.question ?? activeBookMarket.value?.question ?? '-')
  const activeMarketId = computed(() => activeTradeMarket.value?.marketId ?? activeBookMarket.value?.marketId ?? '-')
  const activeConditionId = computed(() => activeTradeMarket.value?.conditionId ?? activeBookMarket.value?.conditionId ?? '-')

  // ─── Price resolution ───

  function resolveDisplayProbability(key: string, tradeMarket?: PolymarketMarketTradesAggregate | null): number | null {
    const { side } = resolveKeyAndSide(key)
    const bookMarket = findBookMarketByKey(key)
    const tokenBook = side === 'yes' ? bookMarket?.yesBook : bookMarket?.noBook
    const bookPrice = tokenBook?.midPrice
      ?? tokenBook?.lastTradePrice
      ?? (tokenBook?.bestBid != null && tokenBook?.bestAsk != null
        ? (tokenBook.bestBid + tokenBook.bestAsk) / 2
        : (tokenBook?.bestBid ?? tokenBook?.bestAsk ?? null))

    const tradePrice = tradeMarket?.lastPrice ?? null
    const rawPrice = side === 'yes' ? tradePrice : (tradePrice != null ? 1 - tradePrice : null)
    const finalPrice = bookPrice ?? rawPrice
    if (finalPrice == null) return null
    return clampPrice(finalPrice)
  }

  function optionOddsLabel(key: string): string {
    const market = findTradeMarketByKey(key)
    const price = resolveDisplayProbability(key, market)
    return formatPolyOdds(price, oddsFormat.value)
  }

  return {
    activeMarketKey, activeCategoryKey, activeFamilyKey, activeLineKey, activeViewTab,
    primaryLink, kickoffUtc, kickoffTimeLabel, kickoffDateLabel,
    allMarketEntries, categoryTabs, familyTabs, lineTabs,
    categoryMarkets, familyMarkets, lineScopedMarkets,
    activeMarketSide, activeTradeMarket, activeBookMarket, recentTrades,
    activeMarketLabel, activeOptionLabel, activeMarketNotional, activeMarketTradeCount,
    activeMarketQuestion, activeMarketId, activeConditionId,
    marketViewTabs: MARKET_VIEW_TABS,
    findTradeMarketByKey, findBookMarketByKey, resolveDisplayProbability, optionOddsLabel,
  }
}

export function clampPrice(raw: number): number {
  if (!Number.isFinite(raw)) return 0
  if (raw < 0) return 0
  if (raw > 1) return 1
  return raw
}
