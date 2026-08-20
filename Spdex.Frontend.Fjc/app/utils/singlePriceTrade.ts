import type { PriceSizeRow } from '~/types/bighold'

/**
 * Returns the sole cumulative traded price level when the current order book
 * has exactly one traded level and that level clears the display threshold.
 */
export function getSingleTradedPriceLevel(
  rows: PriceSizeRow[],
  minimumTraded = 1000,
): PriceSizeRow | null {
  const tradedLevels = rows.filter(row => Number.isFinite(row.traded) && row.traded > 1)
  if (tradedLevels.length !== 1 || tradedLevels[0]!.traded <= minimumTraded) return null
  return tradedLevels[0]!
}
