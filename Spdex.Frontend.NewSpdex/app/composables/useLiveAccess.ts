import { canUseLiveFullDetail, isFreeMembership } from '~/utils/membership'

/**
 * 实时赛事分层门禁：付费会员可看基础列表，黄金版及以上可进入完整赛况。
 * 分别与后端 Entitlements.LiveAccess / LiveFullDetail 对齐。
 */
export function useLiveAccess() {
  const { user } = useAuth()

  const isAnonymousLiveUser = computed(() => !user.value)
  const isFreeLiveUser = computed(() => isFreeMembership(user.value))
  const canOpenLive = computed(() => !isAnonymousLiveUser.value && !isFreeLiveUser.value)
  const canOpenLiveFullDetail = computed(() => canUseLiveFullDetail(user.value))
  const liveLockMessage = computed(() => (
    isAnonymousLiveUser.value
      ? '请先登录后访问实时赛事'
      : isFreeLiveUser.value ? '实时赛事为付费会员专享，请升级会籍后使用' : ''
  ))
  const liveFullDetailLockMessage = computed(() => (
    isAnonymousLiveUser.value
      ? '请先登录后查看完整赛况'
      : '完整赛况仅限黄金版及以上有效会籍，请升级后使用'
  ))

  return {
    canOpenLive,
    canOpenLiveFullDetail,
    liveLockMessage,
    liveFullDetailLockMessage,
    isAnonymousLiveUser,
    isFreeLiveUser,
  }
}
