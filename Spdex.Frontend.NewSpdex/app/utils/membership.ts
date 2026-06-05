import type { AuthUser } from '~/types/auth'

const roleRanks: Record<number, number> = {
  2: 1,
  4: 3,
  9: 4,
  10: 5,
  11: 6,
  12: 7,
  5: 8,
}

const roleNames: Record<number, string> = {
  2: '免费版',
  4: '专家版',
  9: '专业版',
  10: '黄金版',
  11: '翡翠版',
  12: '红宝石版',
  5: '白金版',
}

function roleRank(roleId: number): number {
  return roleRanks[roleId] ?? roleRanks[2]!
}

function isExpired(endDate: string | null | undefined, now: Date): boolean {
  if (!endDate) return false
  const time = new Date(endDate).getTime()
  return Number.isFinite(time) && time < now.getTime()
}

export function membershipDisplayName(roleId: number): string {
  return roleNames[roleId] ?? '当前会籍'
}

export function isActivePaidMembership(user: AuthUser | null | undefined, now = new Date()): boolean {
  if (!user) return false
  const rank = roleRank(user.roleId)
  return rank >= roleRanks[4]! && rank <= roleRanks[5]! && !isExpired(user.endDate, now)
}

export function canPurchaseTarget(user: AuthUser | null | undefined, targetRoleId: number, now = new Date()): boolean {
  if (!isActivePaidMembership(user, now)) return true
  return roleRank(targetRoleId) >= roleRank(user!.roleId)
}
