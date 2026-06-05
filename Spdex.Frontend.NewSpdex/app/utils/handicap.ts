export interface FormatHandicapLineOptions {
  fixed?: number
}

function formatNumberToken(token: string, fixed?: number): string {
  const n = Number.parseFloat(token.replace('＋', '+'))
  if (!Number.isFinite(n)) return token
  if (Math.abs(n) < 0.0001) return fixed == null ? '0' : (0).toFixed(fixed)

  const abs = Math.abs(n)
  const body = fixed == null
    ? abs.toString().replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
    : abs.toFixed(fixed)

  return `${n > 0 ? '+' : '-'}${body}`
}

/** 让球/让分盘口显示：正数补 +，负数保留 -，0 不带符号。 */
export function formatHandicapLine(value: string | number | null | undefined, options: FormatHandicapLineOptions = {}): string {
  if (value == null) return ''
  const raw = String(value).trim()
  if (!raw) return ''
  return raw
    .replace(/＋/g, '+')
    .replace(/[+-]?\d+(?:\.\d+)?/g, token => formatNumberToken(token, options.fixed))
}
