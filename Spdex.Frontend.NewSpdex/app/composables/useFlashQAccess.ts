export function useFlashQAccess() {
  const { tier, user } = useAuth()

  const isAnonymousFlashQUser = computed(() => !user.value)
  const roleName = computed(() => user.value?.roleName?.trim() ?? '')
  const isFreeFlashQUser = computed(() => Boolean(user.value) && (
    user.value?.roleId === 2
    || tier.value === 'Free'
    || user.value?.tier === 'Free'
    || roleName.value.includes('免费')
  ))
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
