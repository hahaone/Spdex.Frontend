import type { AuthUser } from '~/types/auth'

const roleRanks: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 3,
  9: 4,
  10: 5,
  11: 6,
  12: 7,
  5: 8,
  13: 8,
  16: 5,
}

const roleNames: Record<number, string> = {
  1: '保留帐号',
  2: '免费版',
  3: '基础版',
  4: '专家版',
  9: '专业版',
  10: '黄金版',
  11: '翡翠版',
  12: '红宝石版',
  5: '白金版',
  13: '彩店会员',
  16: '赢在 Q 群',
}

const tierNames: Record<string, string> = {
  Reserved: '保留帐号',
  Free: '免费版',
  Basic: '基础版',
  Expert: '专家版',
  Professional: '专业版',
  Gold: '黄金版',
  Emerald: '翡翠版',
  Ruby: '红宝石版',
  Platinum: '白金版',
  Lottery: '彩店会员',
  QGroup: '赢在 Q 群',
  Studio: '工作室版',
}

const mainlinePaidRoleIds = new Set([4, 9, 10, 11, 12, 5])

function roleRank(roleId: number): number {
  return roleRanks[roleId] ?? roleRanks[2]!
}

function isExpired(endDate: string | null | undefined, now: Date): boolean {
  if (!endDate) return false
  const time = new Date(endDate).getTime()
  return Number.isFinite(time) && time < now.getTime()
}

function normalizedRawRoleName(rawName: string | null | undefined): string {
  const name = rawName?.trim() ?? ''
  if (!name) return ''
  if (/^role\s*\d+$/i.test(name)) return ''
  return name
}

export function membershipDisplayName(
  roleId: number | null | undefined,
  rawName?: string | null,
  tier?: string | null,
): string {
  const normalized = normalizedRawRoleName(rawName)
  if (normalized) return normalized
  if (roleId && roleNames[roleId]) return roleNames[roleId]
  if (tier && tierNames[tier]) return tierNames[tier]
  return '当前会籍'
}

export function membershipDisplayNameForUser(user: AuthUser | null | undefined): string {
  return membershipDisplayName(user?.roleId, user?.roleName, user?.tier)
}

export function isFreeMembership(user: AuthUser | null | undefined): boolean {
  if (!user) return false
  return user.roleId === 2
    || user.tier === 'Free'
    || membershipDisplayNameForUser(user).includes('免费')
}

export function canUseDataReplay(user: AuthUser | null | undefined, now = new Date()): boolean {
  if (!user || isExpired(user.endDate, now)) return false
  if (user.entitlements?.dataReplay !== undefined) return user.entitlements.dataReplay
  return !isFreeMembership(user)
}

export function isActivePaidMembership(user: AuthUser | null | undefined, now = new Date()): boolean {
  if (!user) return false
  return mainlinePaidRoleIds.has(user.roleId) && !isExpired(user.endDate, now)
}

export function canPurchaseTarget(user: AuthUser | null | undefined, targetRoleId: number, now = new Date()): boolean {
  if (!isActivePaidMembership(user, now)) return true
  return roleRank(targetRoleId) >= roleRank(user!.roleId)
}
