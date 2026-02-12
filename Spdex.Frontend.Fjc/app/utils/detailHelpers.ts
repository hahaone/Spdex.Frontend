/**
 * 详情页共享工具函数。
 * cs/cs2/cs7（Goal Line / Correct Score / Corner）等使用 gridtable 风格详情页的公用逻辑。
 * 包括：AlignedRow 三栏对齐、大注高亮判断、时间颜色、百分比显示 等。
 */

import type { PriceSizeRow } from '~/types/bighold'
import { parseRawData } from '~/utils/parseRawData'

// ── AlignedRow：三栏对齐数据结构 ──

/** 三栏对齐行：当前记录 + 前一条记录 + 差额 */
export interface AlignedRow {
  price: number
  cur: PriceSizeRow | null
  prev: PriceSizeRow | null
  diff: number // traded 差额，≤0 时不显示
}

/**
 * 构建三栏按 price 对齐的数据。
 * 合并 curRawData 与 prevRawData 的所有价位，按升序排列后逐行匹配。
 */
export function getAlignedRows(
  curRawData: string | null,
  prevRawData: string | null,
): AlignedRow[] {
  const curRows = curRawData ? parseRawData(curRawData) : []
  const prevRows = prevRawData ? parseRawData(prevRawData) : []

  const allPrices = new Set<number>()
  for (const r of curRows) allPrices.add(r.price)
  for (const r of prevRows) allPrices.add(r.price)

  const curMap = new Map(curRows.map(r => [r.price, r]))
  const prevMap = new Map(prevRows.map(r => [r.price, r]))

  return Array.from(allPrices)
    .sort((a, b) => a - b)
    .map(price => ({
      price,
      cur: curMap.get(price) ?? null,
      prev: prevMap.get(price) ?? null,
      diff: (curMap.get(price)?.traded ?? 0) - (prevMap.get(price)?.traded ?? 0),
    }))
}

// ── 大注高亮判断 ──

/**
 * HighlightPcId 逻辑：
 * 成交差额中 traded>0 的条数超过 threshold 时高亮。
 * 只遍历当前价位（非 union），与旧站一致。
 * @param curRawData 当前记录的 rawData
 * @param prevRawData 前一条记录的 rawData（null 或无数据时不高亮）
 * @param threshold 成交差额条数阈值，默认 3
 */
export function isBigHighlighted(
  curRawData: string | null,
  prevRawData: string | null | undefined,
  threshold: number = 3,
): boolean {
  if (!prevRawData) return false
  const curRows = curRawData ? parseRawData(curRawData) : []
  const prevRows = parseRawData(prevRawData)
  const prevMap = new Map(prevRows.map(r => [r.price, r]))
  let tradedCount = 0
  for (const cur of curRows) {
    const p = prevMap.get(cur.price)
    const diff = p ? cur.traded - p.traded : cur.traded
    if (diff > 0) tradedCount++
  }
  return tradedCount > threshold
}

// ── 大注时间颜色 ──

/** 颜色表（索引对应 colorRank 1-13） */
export const bigTimeColors = [
  '',
  '#570202', '#0531ab', '#cf1204', '#620382', '#0c4f02',
  '#33126b', '#8f8210', '#8f108d', '#080a45', '#174508',
  '#086873', '#8a501e', '#e3496d',
]

/** 根据 colorRank 返回文字颜色样式 */
export function bigTimeColorStyle(colorRank: number): string {
  if (colorRank > 0 && colorRank < bigTimeColors.length)
    return `color:${bigTimeColors[colorRank]}`
  return ''
}

// ── 百分比显示 ──

/** BigItem Per 显示（per/100 → 百分比） */
export function bigPerDisplay(per: number): string {
  return (per / 100).toFixed(0) + '%'
}

// ── 通用样式函数 ──

/** MaxTotal > 65% 红色加粗 */
export function maxTotalStyle(val: number): string {
  return val > 0.65 ? 'color:#ff0000;font-weight:bold' : ''
}

/** Dense% 计算 */
export function densePercent(denseSize: number, totalBet: number): string {
  return ((denseSize / (totalBet + 0.0001)) * 100).toFixed(0) + '%'
}

/** Rank 1-4 映射到 red1-4 样式类 */
export function rankClass(rank: number): string {
  if (rank >= 1 && rank <= 4) return `red${rank}`
  return ''
}

/** SSD 高亮：值 ≥ 3σ → tdhighlight, ≥ 2σ → tdlowlight */
export function ssdClass(
  val: number,
  threshold2: number,
  threshold3: number,
): string {
  if (val >= threshold3) return 'tdhighlight'
  if (val >= threshold2) return 'tdlowlight'
  return ''
}

/** 净赔付负值样式 */
export function netStyle(val: number): string {
  return val < 0 ? 'color:red' : ''
}

/** 盈亏样式 */
export function winStyle(val: number): string {
  return val < 0 ? 'color:red;font-weight:bold' : 'color:#00876a'
}
