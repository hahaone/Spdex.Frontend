/**
 * 信号页面访问控制。
 * 通过 userId 白名单限制信号监控页面的访问权限。
 * 修改下方 ALLOWED_USER_IDS 数组即可增减授权用户。
 */

/** 允许访问信号页面的用户 ID 列表 */
const ALLOWED_USER_IDS: number[] = [1, 131501]

export function useSignalAccess() {
  const { user } = useAuth()

  /** 当前用户是否有权访问信号页面 */
  const canAccessSignals = computed(() => {
    if (!user.value) return false
    return ALLOWED_USER_IDS.includes(user.value.userId)
  })

  return { canAccessSignals }
}
