import { isFreeMembership } from '~/utils/membership'

/**
 * 实时赛事访问门禁：滚球赛况/现场盘口/赛中模型为付费会员专享，免费版与游客不开放。
 * 与后端 Entitlements.LiveAccess 对齐（免费档=false，付费档=true）。
 */
export function useLiveAccess() {
  const { user } = useAuth()

  const isAnonymousLiveUser = computed(() => !user.value)
  const isFreeLiveUser = computed(() => isFreeMembership(user.value))
  const canOpenLive = computed(() => !isAnonymousLiveUser.value && !isFreeLiveUser.value)
  const liveLockMessage = computed(() => (
    isAnonymousLiveUser.value
      ? '请先登录后访问实时赛事'
      : isFreeLiveUser.value ? '实时赛事为付费会员专享，请升级会籍后使用' : ''
  ))

  return {
    canOpenLive,
    liveLockMessage,
    isAnonymousLiveUser,
    isFreeLiveUser,
  }
}
