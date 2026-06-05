// 镜像后端 AdminPermissions，供前端显隐控制。
export const P = {
  systemAdminManage: 'system.admin.manage',
  systemRoleManage: 'system.role.manage',
  systemAuditView: 'system.audit.view',
  userView: 'user.view',
  userMembershipEdit: 'user.membership.edit',
  userStatusEdit: 'user.status.edit',
  userPasswordReset: 'user.password.reset',
  orderView: 'order.view',
  silkView: 'silk.view',
  silkAdjustSmall: 'silk.adjust.small',
  silkAdjustLarge: 'silk.adjust.large',
  silkConfig: 'silk.config',
  planView: 'plan.view',
  planEdit: 'plan.edit',
  signalView: 'signal.view',
  signalConfig: 'signal.config',
} as const
