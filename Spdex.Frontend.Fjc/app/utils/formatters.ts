/**
 * 公共格式化函数。
 * 从 cs3/cs4/cs5/index 页面中提取的重复格式化逻辑统一在此管理。
 */

/** 千分位格式化整数（与旧站 fmoney 一致） */
export function formatMoney(val: number): string {
  if (!val || val === 0) return '0'
  return Math.round(val).toLocaleString()
}

/** ISO 日期时间 → 可读格式（去掉 T 和毫秒尾部） */
export function formatDateTime(s: string | null | undefined): string {
  if (!s) return '-'
  return s.replace('T', ' ').replace(/\.\d+$/, '')
}

/** 日期时间 → MM-DD HH:mm（detail 页面通用） */
export function formatMatchTime(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

/** 日期时间 → YYYY-MM-DD HH:mm（亚盘页面用） */
export function formatMatchTimeFull(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
}

/** 日期时间 → MM/DD HH:mm（首页列表用） */
export function formatMatchTimeSlash(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  return `${mm}/${dd} ${hh}:${mi}`
}

/** 日期时间 → MM-DD HH:mm:ss（精确到秒） */
export function formatTimeWithSeconds(s: string | null | undefined): string {
  if (!s) return ''
  const d = new Date(s)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mi = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}:${ss}`
}

/** 百分比格式化（小数 → 百分比字符串） */
export function formatPercent(val: number, decimals: number = 1): string {
  return (val * 100).toFixed(decimals) + '%'
}

/** 赔率格式化（保留2位小数，0或负数返回空） */
export function formatOdds(val: number): string {
  return val > 0 ? val.toFixed(2) : ''
}

/** 密集度格式化（同 formatOdds） */
export function formatDense(val: number): string {
  return val > 0 ? val.toFixed(2) : ''
}

/** 最佳价格格式化（保留3位小数） */
export function formatBestPrice(val: number): string {
  return val > 0 ? val.toFixed(3) : '-'
}

/** 净赔付百分比格式化 */
export function formatNetPayout(val: number): string {
  return (val * 100).toFixed(2) + '%'
}

/** BfAmount 简写（K/M） */
export function formatBfAmount(amount: number): string {
  if (!amount || amount === 0) return '-'
  if (amount >= 1000000) return (amount / 1000000).toFixed(1) + 'M'
  if (amount >= 1000) return (amount / 1000).toFixed(0) + 'K'
  return String(Math.round(amount))
}

/** 日期格式化为中文显示（首页日期选择器用） */
const weekDays = ['日', '一', '二', '三', '四', '五', '六']
export function formatDateCN(dateStr: string): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 周${weekDays[d.getDay()]}`
}
