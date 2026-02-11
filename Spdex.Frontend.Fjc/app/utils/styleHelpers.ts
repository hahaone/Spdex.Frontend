/**
 * 公共样式辅助函数。
 * 从 cs3/cs4/cs5 detail 页面中提取的重复 CSS class 生成逻辑。
 */

import type { PriceSizeRow } from '~/types/bighold'

/** PMark 徽章 CSS class */
export function pmarkClass(mark: string | null | undefined): string {
  if (!mark) return ''
  return 'pmark-' + mark.toLowerCase()
}

/** BigHold 行 Hold 高亮：3σ → 红底，2σ → 黄底 */
export function holdClass(item: { holdHighlight: number }): string {
  if (item.holdHighlight === 2) return 'highlight-3sigma'
  if (item.holdHighlight === 1) return 'highlight-2sigma'
  return ''
}

/** BigHold 行 Amount Top2 高亮 */
export function amountClass(item: { isTop2Amount: boolean }): string {
  if (item.isTop2Amount) return 'text-top2'
  return ''
}

/** 价位单元格背景：有 Back → 蓝色，有 Lay → 粉色 */
export function priceBgClass(row: PriceSizeRow): string {
  if (row.toBack > 0) return 'bg-back'
  if (row.toLay > 0) return 'bg-lay'
  return ''
}

/** 成交量高亮样式 */
export function tradedClass(row: PriceSizeRow): string {
  if (row.tradedHighlight >= 3) return 'text-traded-3x'
  if (row.tradedHighlight >= 2) return 'text-traded-2x'
  return ''
}

/** 亚盘高亮: 0=无, 1=≥X2(lowlight), 2=≥X3(highlight) */
export function highlightClass(level: number): string {
  if (level === 2) return 'td-highlight'
  if (level === 1) return 'td-lowlight'
  return ''
}
