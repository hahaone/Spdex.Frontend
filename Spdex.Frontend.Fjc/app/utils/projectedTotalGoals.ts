export interface ProjectedTotalGoalsSeriesPoint {
  capturedAt?: string | null
  minute?: number | null
  projectedTotalGoals?: number | null
}

export interface ProjectedTotalGoalsMaxChange {
  delta: number
  fromValue: number
  toValue: number
  minute: number
  clockLabel: string
  fromIndex: number
  toIndex: number
}

export interface ProjectedTotalGoalsSummary {
  initialValue: number
  maxChange: ProjectedTotalGoalsMaxChange | null
}

const DEFAULT_MAX_ADJACENT_GAP_MS = 3 * 60 * 1000

function finiteValue(value: number | null | undefined): number | null {
  if (value == null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function capturedAtMs(value: string | null | undefined): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

function isContinuousCapture(
  previous: ProjectedTotalGoalsSeriesPoint,
  current: ProjectedTotalGoalsSeriesPoint,
  maxAdjacentGapMs: number,
): boolean {
  const previousMs = capturedAtMs(previous.capturedAt)
  const currentMs = capturedAtMs(current.capturedAt)
  if (previousMs == null || currentMs == null) return true
  const gapMs = currentMs - previousMs
  return gapMs >= 0 && gapMs <= maxAdjacentGapMs
}

export function formatProjectedTotalGoalsClock(minuteValue: number | null | undefined): string {
  const minute = Math.max(0, Math.round(Number(minuteValue) || 0))
  if (minute <= 45) return `${minute}'上`
  if (minute <= 90) return `${minute}'下`
  return `${minute}'加`
}

export function summarizeProjectedTotalGoals(
  series: ProjectedTotalGoalsSeriesPoint[],
  maxAdjacentGapMs = DEFAULT_MAX_ADJACENT_GAP_MS,
): ProjectedTotalGoalsSummary | null {
  const initialIndex = series.findIndex(point => finiteValue(point.projectedTotalGoals) != null)
  if (initialIndex < 0) return null

  const initialValue = finiteValue(series[initialIndex]!.projectedTotalGoals)!
  let maxChange: ProjectedTotalGoalsMaxChange | null = null

  for (let index = 1; index < series.length; index += 1) {
    const previousPoint = series[index - 1]!
    const currentPoint = series[index]!
    const fromValue = finiteValue(previousPoint.projectedTotalGoals)
    const toValue = finiteValue(currentPoint.projectedTotalGoals)
    if (fromValue == null || toValue == null) continue
    if (!isContinuousCapture(previousPoint, currentPoint, maxAdjacentGapMs)) continue

    const delta = Math.abs(toValue - fromValue)
    if (maxChange != null && delta <= maxChange.delta) continue

    const minute = Math.max(0, Math.round(Number(currentPoint.minute) || 0))
    maxChange = {
      delta,
      fromValue,
      toValue,
      minute,
      clockLabel: formatProjectedTotalGoalsClock(minute),
      fromIndex: index - 1,
      toIndex: index,
    }
  }

  return { initialValue, maxChange }
}
