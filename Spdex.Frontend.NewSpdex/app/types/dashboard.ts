/**
 * NewSpdex 首页 dashboard 接口的 TypeScript 类型镜像（与后端 NewSpdexDashboard* 对应）。
 */

export type DashboardMetricStatus = 'ok' | 'pending' | 'no-access'

export interface DashboardMetricRaw {
  id: string
  title: string
  threshold: string
  count: number
  eventIds: number[]
  status: DashboardMetricStatus
}

export interface DashboardMetricsResultRaw {
  bfVolume: DashboardMetricRaw
  polyVolume: DashboardMetricRaw
  bfIndex: DashboardMetricRaw
  polyIndex: DashboardMetricRaw
  doubleRed: DashboardMetricRaw
  generatedAt: string
  prematchSixHourLockApplied: boolean
}

/**
 * 前端友好的指标行，包含 UI tone 与目标路由。
 */
export interface DashboardMetric extends DashboardMetricRaw {
  tone: 'bf' | 'poly' | 'index' | 'signal'
  to: string
}
