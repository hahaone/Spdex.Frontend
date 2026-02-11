/**
 * RawData JSON 解析 + 差额计算工具。
 * 解析 MapRunner 格式的 RawData JSON，提取 Back/Lay/Traded 数据构建价位行。
 * 与旧站 GetPriceSizeJoinList 逻辑一致。
 *
 * 注意：数据库中 RawData 的 JSON 使用 camelCase 键名（ex, availableToBack 等），
 * 需要同时兼容 PascalCase 和 camelCase。
 */

import type { PriceSizeRow } from '~/types/bighold'

/** MapRunner.Ex 内部的 {price, size} 结构 */
interface PriceSize {
  price: number
  size: number
}

/**
 * 从 parsed JSON 对象中提取 PriceSize 数组。
 * 兼容 PascalCase 和 camelCase 键名。
 */
function getExField(obj: Record<string, unknown>, ...keys: string[]): PriceSize[] {
  for (const key of keys) {
    const val = obj[key]
    if (Array.isArray(val)) return val as PriceSize[]
  }
  return []
}

/**
 * 从 parsed JSON 对象中获取 Ex 对象。
 * 兼容 PascalCase（Ex）和 camelCase（ex）。
 */
function getEx(obj: Record<string, unknown>): Record<string, unknown> | null {
  const ex = obj.Ex ?? obj.ex
  if (ex && typeof ex === 'object') return ex as Record<string, unknown>
  return null
}

/**
 * 解析 RawData JSON 字符串，返回按 price 升序排列的 PriceSizeRow 数组。
 *
 * 解析逻辑：
 * 1. JSON.parse → MapRunner
 * 2. 收集 Back/Lay/Traded 所有价位（price 去重合并）
 * 3. 对每个价位构建一行 { price, toBack, toLay, traded }
 * 4. 按 price 升序排列
 * 5. 计算最大成交量高亮：≥3倍次大→紫色(3)，≥2倍→橙色(2)，最大→(1)
 */
export function parseRawData(rawDataJson: string | null): PriceSizeRow[] {
  if (!rawDataJson) return []

  let runner: Record<string, unknown>
  try {
    runner = JSON.parse(rawDataJson)
  }
  catch {
    return []
  }

  const ex = getEx(runner)
  if (!ex) return []

  const backList = getExField(ex, 'AvailableToBack', 'availableToBack')
  const layList = getExField(ex, 'AvailableToLay', 'availableToLay')
  const tradedList = getExField(ex, 'TradedVolume', 'tradedVolume')

  // 收集所有价位并去重
  const priceMap = new Map<number, { toBack: number, toLay: number, traded: number }>()

  for (const { price, size } of backList) {
    if (!priceMap.has(price)) priceMap.set(price, { toBack: 0, toLay: 0, traded: 0 })
    priceMap.get(price)!.toBack += size
  }

  for (const { price, size } of layList) {
    if (!priceMap.has(price)) priceMap.set(price, { toBack: 0, toLay: 0, traded: 0 })
    priceMap.get(price)!.toLay += size
  }

  for (const { price, size } of tradedList) {
    if (!priceMap.has(price)) priceMap.set(price, { toBack: 0, toLay: 0, traded: 0 })
    priceMap.get(price)!.traded += size
  }

  // 转换为数组并按 price 升序排列
  const rows: PriceSizeRow[] = Array.from(priceMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([price, data]) => ({
      price,
      toBack: data.toBack,
      toLay: data.toLay,
      traded: data.traded,
      tradedHighlight: 0,
    }))

  // 计算成交高亮：找最大和次大的 traded 值
  if (rows.length > 0) {
    const tradedValues = rows
      .filter(r => r.traded > 0)
      .map(r => r.traded)
      .sort((a, b) => b - a)

    if (tradedValues.length > 0) {
      const maxTraded = tradedValues[0]!
      const secondMax: number = tradedValues.length > 1 ? tradedValues[1]! : 0

      for (const row of rows) {
        if (row.traded === maxTraded && maxTraded > 0) {
          if (secondMax > 0 && maxTraded >= secondMax * 3) {
            row.tradedHighlight = 3  // ≥3倍 → 紫色
          }
          else if (secondMax > 0 && maxTraded >= secondMax * 2) {
            row.tradedHighlight = 2  // ≥2倍 → 橙色
          }
          else {
            row.tradedHighlight = 1  // 最大但不满足倍数条件
          }
        }
      }
    }
  }

  return rows
}

/**
 * 计算两组价位行的成交差额。
 * 对每个 price：diff = current.traded - previous.traded
 * 仅返回有差额 (> 0) 的行。
 */
export function calcTradedDiff(current: PriceSizeRow[], previous: PriceSizeRow[]): PriceSizeRow[] {
  // 构建前一条记录的 price → traded 映射
  const prevMap = new Map<number, number>()
  for (const row of previous) {
    if (row.traded > 0) {
      prevMap.set(row.price, row.traded)
    }
  }

  const diffRows: PriceSizeRow[] = []

  for (const row of current) {
    if (row.traded <= 0) continue
    const prevTraded = prevMap.get(row.price) ?? 0
    const diff = row.traded - prevTraded
    if (diff > 0) {
      diffRows.push({
        price: row.price,
        toBack: 0,
        toLay: 0,
        traded: diff,
        tradedHighlight: 0,
      })
    }
  }

  return diffRows
}
