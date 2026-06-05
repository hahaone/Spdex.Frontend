/** 基于当前管理员 permissions 的前端显隐控制（真正拦截在后端 policy）。 */
export function usePermission() {
  const { admin } = useAuth()

  function can(permission: string): boolean {
    return !!admin.value?.permissions?.includes(permission)
  }

  function canAny(...perms: string[]): boolean {
    return perms.some(p => can(p))
  }

  return { can, canAny }
}
