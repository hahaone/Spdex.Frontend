import { isFreeMembership } from '~/utils/membership'

export function useFlashQAccess() {
  const { user } = useAuth()

  const isAnonymousFlashQUser = computed(() => !user.value)
  const isFreeFlashQUser = computed(() => isFreeMembership(user.value))
  const canOpenFlashQ = computed(() => !isAnonymousFlashQUser.value && !isFreeFlashQUser.value)
  const flashQLockMessage = computed(() => (
    isAnonymousFlashQUser.value
      ? '请先登录后访问闪Q'
      : isFreeFlashQUser.value ? '免费版暂未开放闪Q，请升级会籍后使用' : ''
  ))

  return {
    canOpenFlashQ,
    flashQLockMessage,
    isAnonymousFlashQUser,
    isFreeFlashQUser,
  }
}
