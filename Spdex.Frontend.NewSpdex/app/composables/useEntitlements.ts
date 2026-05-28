/**
 * 集中暴露当前用户的权益对象，给组件做"锁定/降级"渲染判断。
 * 用法：
 *   const ent = useEntitlements()
 *   if (!ent.standardChart) showLockOverlay()
 */

import type { Entitlements } from '~/types/auth'

const DEFAULT_ENTITLEMENTS: Entitlements = {
  mainstreamMatches: true,
  goalsEquilibrium: false,
  asianIndex: false,
  correctScoreIndex: false,
  dataReplay: false,
  standardChart: false,
  indexTrendChart: false,
  tradeDetailTable: false,
  europeanOddsTrend: false,
  qMyModels: 0,
  qMyPublish: 0,
  qConcurrentFactors: 0,
  qBaseFactors: false,
  qGoalsEquilibrium: false,
  qInOutBoard: false,
  flashQDailyQuota: 0,
  appCoreTrades: false,
  appInOutBoard: false,
  prematchSixHourLock: true,
  jcOnly: false,
  timeMachine: false,
}

export function useEntitlements(): Readonly<Entitlements> {
  const { entitlements } = useAuth()
  return entitlements.value ?? DEFAULT_ENTITLEMENTS
}
