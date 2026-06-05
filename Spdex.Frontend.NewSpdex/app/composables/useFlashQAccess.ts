export function useFlashQAccess() {
  const { tier, user } = useAuth()

  const isFreeFlashQUser = computed(() => (
    !user.value
    || user.value.roleId === 2
    || tier.value === 'Free'
    || user.value.tier === 'Free'
    || user.value?.roleName === '免费版'
  ))
  const canOpenFlashQ = computed(() => !isFreeFlashQUser.value)
  const flashQLockMessage = computed(() => (
    isFreeFlashQUser.value ? '免费版暂未开放闪Q，请升级会籍后使用' : ''
  ))

  return {
    canOpenFlashQ,
    flashQLockMessage,
    isFreeFlashQUser,
  }
}
