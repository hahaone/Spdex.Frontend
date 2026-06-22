<script setup lang="ts">
import { ArrowLeft, BarChart3, Flag, Lock } from '@lucide/vue'
import type { AnalysisReplayPoint, LiveCardBadge, LiveEvent } from '~/composables/useLiveSnapshot'

const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))

// 实时赛事为付费会员专享：免费版/游客显示升级卡，不发起 snapshot 请求。
const { canOpenLive, liveLockMessage } = useLiveAccess()
const { detail, euroOdds } = useMatchDetail(eventId)
const { snapshot } = useLiveSnapshot(eventId, canOpenLive)

const match = computed(() => detail.value?.match)

function eventTone(type: string): string {
  switch (type) {
    case 'goal':
    case 'penalty': return 'goal'
    case 'red': return 'red'
    case 'yellow': return 'yellow'
    case 'corner': return 'corner'
    default: return 'mute'
  }
}
function eventIcon(type: string) {
  if (type === 'corner') return Flag
  return null
}
function useFootballIcon(type: string): boolean {
  return type === 'goal'
}

type CardMarker = LiveCardBadge & { times: string[], title: string }

function cardLabel(color: string): string {
  return color === 'red' ? '红牌' : '黄牌'
}

function cardMarkers(side: 'home' | 'away'): CardMarker[] {
  const s = snapshot.value
  if (!s) return []
  return s.cardBadges
    .filter(b => b.side === side)
    .map((badge) => {
      const times = s.events
        .filter(e => e.side === side && e.type === badge.color && e.minute)
        .map(e => e.minute)
      const sideName = side === 'home' ? '主队' : '客队'
      const label = cardLabel(badge.color)
      return {
        ...badge,
        times,
        title: times.length
          ? `${sideName}${label}${badge.count}张：${times.join('、')}`
          : `${sideName}${label}${badge.count}张`,
      }
    })
}

const homeCards = computed(() => cardMarkers('home'))
const awayCards = computed(() => cardMarkers('away'))

function goalActor(event: LiveEvent): string {
  if (event.player) return event.player
  if (event.type === 'penalty') return '点球'
  return '进球'
}

function goalTitle(event: LiveEvent): string {
  const parts = [event.minute, event.text || goalActor(event), event.rawText].filter(Boolean)
  return parts.join(' · ')
}

type EventProgressKind = 'goal' | 'yellow' | 'red'
type EventProgressHalf = 'first' | 'second'
type EventProgressMarker = {
  id: string
  side: 'home' | 'away'
  half: EventProgressHalf
  kind: EventProgressKind
  left: number
  minute: string
  title: string
}

function progressKind(type: string): EventProgressKind | null {
  if (type === 'goal') return 'goal'
  if (type === 'yellow') return 'yellow'
  if (type === 'red') return 'red'
  return null
}

function parseEventMinute(value?: string): { base: number, total: number } | null {
  const match = `${value || ''}`.match(/(\d+)(?:\s*\+\s*(\d+))?/)
  if (!match) return null
  const base = Number(match[1])
  const extra = Number(match[2] || 0)
  if (!Number.isFinite(base)) return null
  return { base, total: base + (Number.isFinite(extra) ? extra : 0) }
}

function eventProgressTitle(event: LiveEvent, kind: EventProgressKind): string {
  if (kind === 'goal') return goalTitle(event)
  const sideName = event.side === 'home'
    ? (match.value?.homeTeam || snapshot.value?.homeTeam || '主队')
    : (match.value?.awayTeam || snapshot.value?.awayTeam || '客队')
  const label = kind === 'red' ? '红牌' : '黄牌'
  return [sideName, event.minute, label, event.player || event.text || event.rawText].filter(Boolean).join(' · ')
}

function isScoringGoalEvent(event: LiveEvent): boolean {
  if (event.type !== 'goal') return false
  const text = `${event.rawText || ''} ${event.text || ''}`.toLowerCase()
  return !/\b(disallow(?:ed)?|no goal|goal kick|cancelled|canceled|chalked off|ruled out|void)\b/.test(text)
}

const eventProgressMarkers = computed<EventProgressMarker[]>(() => {
  const s = snapshot.value
  const events = s?.events ?? []
  const visibleGoalBudget = {
    home: Math.max(0, s?.score[0] ?? 0),
    away: Math.max(0, s?.score[1] ?? 0),
  }
  return events.reduce<EventProgressMarker[]>((markers, event, index) => {
    if (event.side !== 'home' && event.side !== 'away') return markers
    const kind = progressKind(event.type)
    const parsed = parseEventMinute(event.minute)
    if (!kind || !parsed) return markers
    if (kind === 'goal') {
      if (!isScoringGoalEvent(event) || visibleGoalBudget[event.side] <= 0) return markers
      visibleGoalBudget[event.side] -= 1
    }

    const half: EventProgressHalf = parsed.base <= 45 ? 'first' : 'second'
    const halfMinute = half === 'first'
      ? Math.min(parsed.total, 45)
      : Math.max(45, Math.min(parsed.total, 90)) - 45

    markers.push({
      id: `${index}-${event.minute}-${event.type}-${event.text}`,
      side: event.side,
      half,
      kind,
      left: Math.max(0, Math.min(100, (halfMinute / 45) * 100)),
      minute: event.minute,
      title: eventProgressTitle(event, kind),
    })
    return markers
  }, [])
})
const firstHalfProgressMarkers = computed(() => eventProgressMarkers.value.filter(marker => marker.half === 'first'))
const secondHalfProgressMarkers = computed(() => eventProgressMarkers.value.filter(marker => marker.half === 'second'))
const hasEventProgress = computed(() => eventProgressMarkers.value.length > 0)
const hasHomeCardProgress = computed(() => eventProgressMarkers.value.some(marker => marker.side === 'home' && (marker.kind === 'yellow' || marker.kind === 'red')))
const hasAwayCardProgress = computed(() => eventProgressMarkers.value.some(marker => marker.side === 'away' && (marker.kind === 'yellow' || marker.kind === 'red')))

const statusLabel = computed(() => {
  const s = snapshot.value?.status
  if (s === 'upcoming') return '未开赛'
  if (s === 'finished') return '已完场'
  return '进行中'
})

const liveDataPending = computed(() => snapshot.value?.dataStatus === 'pending')

// 是否有任意实时内容（事件/统计/现场盘口）。
// 无 → 把三块"暂无…"空框收敛成一个统一占位，避免宽屏网格里散落多个 dashed 框。
const hasLiveContent = computed(() => {
  const s = snapshot.value
  return !!(s?.events.length || s?.stats.length || s?.liveOdds?.markets?.length)
})

const livePendingTitle = computed(() => {
  if (snapshot.value?.status === 'upcoming') return '比赛尚未开始'
  if (liveDataPending.value) return '实时数据获取中'
  return '本场暂无实时数据'
})
const livePendingMessage = computed(() => {
  if (snapshot.value?.status === 'upcoming') return '开赛后将实时显示事件时间线、技术统计与现场盘口'
  if (snapshot.value?.status === 'finished') return '本场暂无实时数据'
  return '稍候将自动刷新事件、统计与现场盘口'
})

// 现场赔率头部信息：只显示对应的比分 · 分钟（不暴露庄家名）
const liveOddsMeta = computed(() => {
  const lo = snapshot.value?.liveOdds
  if (!lo) return ''
  const parts: string[] = []
  if (lo.score) parts.push(lo.score)
  if (lo.minute) parts.push(`${lo.minute}'`)
  return parts.join(' · ')
})

// 赛前价格面板：从 useMatchDetail 的 3 个 section 提取主/平/客（封盘前赔率）
const oddsPanel = computed(() => {
  const d = detail.value
  if (!d) return []
  const rows: Array<{ market: string, home: string, drawOrLine: string, away: string }> = []
  if (d.standard.length) {
    const [h, dr, a] = [d.standard[0]?.price, d.standard[1]?.price, d.standard[2]?.price]
    rows.push({ market: '1X2', home: h ?? '-', drawOrLine: dr ?? '-', away: a ?? '-' })
  }
  if (d.handicap.length) {
    const note = d.handicap[1]?.price || match.value?.handicap || '-'
    rows.push({ market: '让球', home: d.handicap[0]?.price ?? '-', drawOrLine: note, away: d.handicap[2]?.price ?? '-' })
  }
  if (d.goals.length) {
    const line = d.goals[1]?.price || '2.5'
    rows.push({ market: '大小', home: d.goals[0]?.price ?? '-', drawOrLine: line, away: d.goals[2]?.price ?? '-' })
  }
  return rows
})

// 赛中统计模型（后端自算近似版）
const model = computed(() => snapshot.value?.model ?? null)
const edgeText = computed(() => {
  const e = model.value?.edgePct
  if (e == null) return '-'
  return `${e > 0 ? '+' : ''}${e}%`
})
const edgeClass = computed(() => {
  const e = model.value?.edgePct ?? 0
  return e > 3 ? 'pos' : e < -3 ? 'neg' : ''
})

// 公司名脱敏：Bet→B*t / bet→b*t（合规）
function maskBook(name: string): string {
  return (name || '').replace(/bet/gi, m => (m[0] === 'B' ? 'B*t' : 'b*t'))
}

// 价格比较：从富欧赔 1x2 盘口的即时赔率取（主/平/客 = cur[0..2]）
const priceCompare = computed(() => {
  const line = euroOdds.value?.markets?.find(x => x.key === '1x2')?.lines?.[0]
  if (!line) return []
  return line.rows.map(r => ({
    book: maskBook(r.name),
    home: (r.cur[0] ?? 0).toFixed(2),
    draw: (r.cur[1] ?? 0).toFixed(2),
    away: (r.cur[2] ?? 0).toFixed(2),
  }))
})

// (现场价位走势 sparkline 已移除：滚球盘口随时变动，走势无可比性)

// ── 赛中分析（BSW 网关：xG 模型 / 盘口资金流向 / 双红信号走势）──
const analysis = computed(() => snapshot.value?.analysis ?? null)


function driftText(dir: string): string {
  switch (dir) {
    case 'home_up': return '主胜走热'
    case 'away_up': return '客胜走热'
    case 'draw_up': return '平局走热'
    default: return '盘面平稳'
  }
}
function signed(n: number): string { return n > 0 ? `+${n}` : `${n}` }
function driftCls(n: number): string { return n > 1 ? 'up' : n < -1 ? 'down' : '' }

// 每个 sparkline 实测自身宽度 → viewBox 宽 = 渲染 px 宽，x 缩放恒为 1。
// 修复宽屏/详情分栏下文字被横向拉扁、圆点被拉成椭圆（preserveAspectRatio="none" 会把整图含文字一起拉伸）。
// SSR/首帧用 320 兜底，挂载后用 ResizeObserver 同步真实宽度（同 StaticTrendChart 套路）。
function useSparkWidth() {
  const elRef = ref<SVGSVGElement | null>(null)
  const w = ref(320)
  let ro: ResizeObserver | null = null
  watch(elRef, (node) => {
    ro?.disconnect()
    ro = null
    if (!node) return
    const sync = () => { const cw = Math.round(node.clientWidth); if (cw > 0) w.value = cw }
    sync()
    ro = new ResizeObserver(sync)
    ro.observe(node)
  })
  onScopeDispose(() => ro?.disconnect())
  return { elRef, w }
}
const { elRef: sigSvg, w: sigW } = useSparkWidth()
const { elRef: edgeSvg, w: edgeW } = useSparkWidth()
const { elRef: probSvg, w: probW } = useSparkWidth()
const { elRef: tgSvg, w: tgW } = useSparkWidth()

type ChartKey = 'totalGoals' | 'signal' | 'edge' | 'prob'
type HoverPointBase = { index: number, x: number }

const chartHover = reactive<Record<ChartKey, number | null>>({
  totalGoals: null,
  signal: null,
  edge: null,
  prob: null,
})
const chartClearTimers: Partial<Record<ChartKey, ReturnType<typeof setTimeout>>> = {}

function clearChartTimer(key: ChartKey) {
  const timer = chartClearTimers[key]
  if (timer) clearTimeout(timer)
  chartClearTimers[key] = undefined
}
function nearestByX<T extends HoverPointBase>(points: T[], x: number): T | null {
  if (!points.length) return null
  return points.reduce((best, point) => Math.abs(point.x - x) < Math.abs(best.x - x) ? point : best, points[0]!)
}
function updateChartHover<T extends HoverPointBase>(
  key: ChartKey,
  svgRef: { value: SVGSVGElement | null },
  points: T[],
  e: PointerEvent,
  width: number,
) {
  const svg = svgRef.value
  if (!svg || !points.length || width <= 0) return
  clearChartTimer(key)
  const rect = svg.getBoundingClientRect()
  const x = Math.max(0, Math.min(width, ((e.clientX - rect.left) / Math.max(rect.width, 1)) * width))
  const point = nearestByX(points, x)
  if (!point) return
  chartHover[key] = point.index
  if (key === 'edge' || key === 'prob')
    replayIndex.value = point.index
}
function leaveChartHover(key: ChartKey, e: PointerEvent) {
  if (e.pointerType === 'mouse')
    chartHover[key] = null
}
function endChartHover(key: ChartKey, e: PointerEvent) {
  if (e.pointerType === 'mouse') return
  clearChartTimer(key)
  chartClearTimers[key] = setTimeout(() => { chartHover[key] = null }, 1800)
}
onScopeDispose(() => {
  for (const key of Object.keys(chartClearTimers) as ChartKey[])
    clearChartTimer(key)
})

function tipAnchor(x: number, width: number): 'left' | 'right' {
  // 框始终移到光标侧旁(左半→右、右半→左),不再居中盖住光标列/数据点。
  return x < width * 0.5 ? 'left' : 'right'
}
function tipLeftPct(x: number, width: number): number {
  return Math.max(4, Math.min(96, (x / Math.max(width, 1)) * 100))
}
function fmtPct(value: number | null | undefined, digits = 1): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${value.toFixed(digits)}%`
}
function fmtSignedPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '-'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
}
function scoreText(point?: AnalysisReplayPoint): string {
  const score = point?.score
  return score ? `${score[0] ?? 0}-${score[1] ?? 0}` : '-'
}

// 双红信号强度走势 sparkline
const signalSpark = computed(() => {
  const pts = analysis.value?.signalTimeline ?? []
  if (pts.length < 3) return null
  const vals = pts.map(p => p.strength)
  const W = sigW.value, H = 42, pad = 4
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const span = max - min || 1
  const maxMinute = Math.max(90, ...pts.map(p => p.minute || 0))
  const xOfMinute = (minute: number) => pad + (W - pad * 2) * (Math.max(0, minute) / maxMinute)
  const points = pts.map((p, i) => {
    const v = p.strength
    const x = xOfMinute(p.minute || i)
    const y = pad + (H - pad * 2) * (1 - (v - min) / span)
    return { index: i, x, y, minute: p.minute || i, strength: v }
  })
  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const guides = [
    { minute: 20, x: xOfMinute(20), label: '20', dashed: true },
    { minute: 45, x: xOfMinute(45), label: 'HT', dashed: false },
  ]
  const triggers = pts
    .filter(p => p.strength >= 80)
    .map(p => ({
      x: xOfMinute(p.minute),
      y: pad + (H - pad * 2) * (1 - (p.strength - min) / span),
      minute: p.minute,
    }))
  return { path, w: W, h: H, max, guides, triggers, points }
})

// ── 完场回放：赛中分析时序（仅完场且有归档时非空）──
const replay = computed(() => snapshot.value?.analysisReplay ?? null)
const replaySeries = computed<AnalysisReplayPoint[]>(() => replay.value?.series ?? [])
const hasReplay = computed(() => replaySeries.value.length >= 2)

// 时间轴游标：默认停在末态（最后一条），序列变化时复位
const replayIndex = ref(0)
watch(replaySeries, (s) => { replayIndex.value = s.length ? s.length - 1 : 0 }, { immediate: true })
const replayPoint = computed(() => replaySeries.value[replayIndex.value] ?? null)

function edgeToneOf(e: number): string { return e > 3 ? 'pos' : e < -3 ? 'neg' : '' }
function pctSigned(e: number): string { return `${e > 0 ? '+' : ''}${e}%` }
function replayMaxMinute(series: AnalysisReplayPoint[]): number {
  return Math.max(90, ...series.map(p => Number.isFinite(p.minute) ? p.minute : 0))
}
function replayMinute(point: AnalysisReplayPoint | undefined, index: number): number {
  const minute = point?.minute
  return typeof minute === 'number' && Number.isFinite(minute) ? Math.max(0, minute) : index
}
function clampChartX(x: number, w: number, pad = 6): number {
  return Math.max(pad, Math.min(w - pad, x))
}
function buildTimeGuides(series: AnalysisReplayPoint[], w: number, h: number, pad: number) {
  const maxMinute = replayMaxMinute(series)
  const xOfMinute = (minute: number) => pad + (w - pad * 2) * (Math.max(0, minute) / maxMinute)
  return [
    { minute: 20, label: "20'", dashed: true },
    { minute: 45, label: '中场', dashed: false },
    { minute: 75, label: "75'", dashed: true },
  ]
    .filter(g => maxMinute >= g.minute)
    .map(g => {
      const x = xOfMinute(g.minute)
      return {
        ...g,
        x,
        labelX: clampChartX(x + 3, w),
        labelY: Math.max(7, h - 2),
        anchor: x > w - 18 ? 'end' : 'start',
      }
    })
}

// 单序列 sparkline：可选 0 基线 + 选中游标竖线 + 选中点 marker；断点（null）断线。
function buildReplaySpark(getter: (p: AnalysisReplayPoint) => number | null | undefined, baseZero = false, width = 320) {
  const series = replaySeries.value
  const vals = series.map(getter).map(v => (v == null ? null : Number(v)))
  const nums = vals.filter((v): v is number => v != null)
  if (nums.length < 2) return null
  const W = width, H = 50, pad = 4
  let min = Math.min(...nums), max = Math.max(...nums)
  if (baseZero) { min = Math.min(min, 0); max = Math.max(max, 0) }
  const span = max - min || 1
  const maxMinute = replayMaxMinute(series)
  const xOf = (p: AnalysisReplayPoint | undefined, i: number) => pad + (W - pad * 2) * (replayMinute(p, i) / maxMinute)
  const yOf = (v: number) => pad + (H - pad * 2) * (1 - (v - min) / span)
  let path = '', pen = false
  vals.forEach((v, i) => {
    if (v == null) { pen = false; return }
    const x = xOf(series[i], i)
    path += `${pen ? 'L' : 'M'}${x.toFixed(1)},${yOf(v).toFixed(1)} `
    pen = true
  })
  const cursorX = xOf(series[replayIndex.value] ?? series[series.length - 1], replayIndex.value)
  const sel = vals[replayIndex.value]
  const points = vals
    .map((v, i) => {
      if (v == null || !Number.isFinite(v)) return null
      return {
        index: i,
        x: xOf(series[i], i),
        y: yOf(v),
        value: v,
        minute: replayMinute(series[i], i),
        raw: series[i],
      }
    })
    .filter((p): p is { index: number, x: number, y: number, value: number, minute: number, raw: AnalysisReplayPoint } => p !== null)
  return {
    path, w: W, h: H,
    min: Math.round(min), max: Math.round(max),
    cursorX,
    marker: sel != null ? { x: cursorX, y: yOf(sel) } : null,
    zeroY: baseZero ? yOf(0) : null,
    guides: buildTimeGuides(series, W, H, pad),
    points,
  }
}

const edgeSpark = computed(() => buildReplaySpark(p => p.edgePct, true, edgeW.value))

// 大球概率走势：模型 vs 平台，两线共用一套刻度才可比。
const overProbSpark = computed(() => {
  const series = replaySeries.value
  const modelVals = series.map(p => (p.modelOverPct ?? null))
  const bookVals = series.map(p => (p.bookOverPct ?? null))
  const nums = [...modelVals, ...bookVals].filter((v): v is number => v != null)
  if (nums.length < 2) return null
  const W = probW.value, H = 50, pad = 4
  const min = Math.min(...nums), max = Math.max(...nums)
  const span = max - min || 1
  const maxMinute = replayMaxMinute(series)
  const xOf = (p: AnalysisReplayPoint | undefined, i: number) => pad + (W - pad * 2) * (replayMinute(p, i) / maxMinute)
  const yOf = (v: number) => pad + (H - pad * 2) * (1 - (v - min) / span)
  const draw = (arr: (number | null)[]) => {
    let d = '', pen = false
    arr.forEach((v, i) => {
      if (v == null) { pen = false; return }
      const x = xOf(series[i], i)
      const y = yOf(v)
      d += `${pen ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)} `
      pen = true
    })
    return d
  }
  const points = series
    .map((p, i) => {
      const modelValue = modelVals[i]
      const bookValue = bookVals[i]
      if (modelValue == null && bookValue == null) return null
      return {
        index: i,
        x: xOf(p, i),
        modelY: modelValue == null ? null : yOf(modelValue),
        bookY: bookValue == null ? null : yOf(bookValue),
        modelValue,
        bookValue,
        minute: replayMinute(p, i),
        raw: p,
      }
    })
    .filter((p): p is {
      index: number
      x: number
      modelY: number | null
      bookY: number | null
      modelValue: number | null
      bookValue: number | null
      minute: number
      raw: AnalysisReplayPoint
    } => p !== null)
  return {
    w: W,
    h: H,
    model: draw(modelVals),
    book: draw(bookVals),
    min: Math.round(min),
    max: Math.round(max),
    cursorX: xOf(series[replayIndex.value] ?? series[series.length - 1], replayIndex.value),
    guides: buildTimeGuides(series, W, H, pad),
    points,
  }
})

const TG_SPARK_MARK_DIFF_THRESHOLD = 1.09

const totalGoalsSpark = computed(() => {
  const series = replaySeries.value
  const vals = series.map(p => (p.projectedTotalGoals == null ? null : Number(p.projectedTotalGoals)))
  const nums = vals.filter((v): v is number => v != null && Number.isFinite(v))
  if (nums.length < 2) return null
  const W = tgW.value, H = 93, pad = 10
  const min = Math.min(...nums), max = Math.max(...nums)
  const span = max - min || 1
  const maxMinute = replayMaxMinute(series)
  const xOf = (p: AnalysisReplayPoint | undefined, i: number) => pad + (W - pad * 2) * (replayMinute(p, i) / maxMinute)
  const yOf = (v: number) => pad + (H - pad * 2) * (1 - (v - min) / span)
  let path = '', pen = false
  const candidates: Array<{ index: number, priority: number, tone: 'jump' | 'extreme' | 'latest', force?: boolean }> = []
  const addCandidate = (index: number, priority: number, tone: 'jump' | 'extreme' | 'latest', force = false) => {
    if (vals[index] == null || !Number.isFinite(vals[index])) return
    const existing = candidates.find(c => c.index === index)
    if (!existing) {
      candidates.push({ index, priority, tone, force })
      return
    }
    existing.force ||= force
    if (priority > existing.priority) {
      existing.priority = priority
      existing.tone = tone
    }
  }
  vals.forEach((v, i) => {
    if (v == null) { pen = false; return }
    const x = xOf(series[i], i)
    path += `${pen ? 'L' : 'M'}${x.toFixed(1)},${yOf(v).toFixed(1)} `
    pen = true
    const prev = vals[i - 1]
    if (prev != null && Math.abs(v - prev) > TG_SPARK_MARK_DIFF_THRESHOLD) {
      addCandidate(i - 1, 120, 'jump', true)
      addCandidate(i, 121, 'jump', true)
    }
  })

  const validIndexes = vals
    .map((v, index) => (v == null || !Number.isFinite(v) ? null : index))
    .filter((index): index is number => index !== null)
  const firstIndex = validIndexes[0]
  if (firstIndex == null) return null
  const lastIndex = validIndexes.at(-1)
  if (lastIndex != null) addCandidate(lastIndex, 110, 'latest')
  const minIndex = validIndexes.reduce((best, index) => (vals[index]! < vals[best]! ? index : best), firstIndex)
  const maxIndex = validIndexes.reduce((best, index) => (vals[index]! > vals[best]! ? index : best), firstIndex)
  addCandidate(minIndex, 86, 'extreme')
  addCandidate(maxIndex, 88, 'extreme')

  const overMarkers = vals
    .map((v, i) => {
      const point = series[i]
      const edge = point?.edgePct
      if (!point || v == null || edge == null || edge <= 3) return null
      return { x: xOf(point, i), y: yOf(v), minute: replayMinute(point, i), text: v.toFixed(2) }
    })
    .filter((m): m is { x: number, y: number, minute: number, text: string } => m !== null)

  const points = vals
    .map((v, i) => {
      if (v == null || !Number.isFinite(v)) return null
      const point = series[i]
      return {
        index: i,
        x: xOf(point, i),
        y: yOf(v),
        value: v,
        minute: replayMinute(point, i),
        raw: point,
      }
    })
    .filter((p): p is { index: number, x: number, y: number, value: number, minute: number, raw: AnalysisReplayPoint } => p !== null)

  const accepted: typeof candidates = []
  const minLabelGap = Math.max(32, Math.min(54, W / 8))
  candidates
    .sort((a, b) => b.priority - a.priority || Math.abs(vals[b.index]! - max) - Math.abs(vals[a.index]! - max))
    .forEach(candidate => {
      if (candidate.force) {
        accepted.push(candidate)
        return
      }
      const x = xOf(series[candidate.index], candidate.index)
      const crowded = accepted.some(label => Math.abs(x - xOf(series[label.index], label.index)) < minLabelGap)
      if (!crowded || candidate.tone === 'latest') accepted.push(candidate)
    })

  const labels = accepted.sort((a, b) => a.index - b.index).map((candidate, order) => {
    const i = candidate.index
    const v = vals[i]!
    const x = xOf(series[i], i)
    const y = yOf(v)
    const nearRight = x > W - 38
    const nearTop = y < 18
    const stagger = candidate.force ? (order % 2 === 0 ? 0 : 8) : 0
    return {
      x,
      y,
      textX: nearRight ? x - 5 : x + 5,
      textY: nearTop ? y + 12 + stagger : Math.max(12, y - 6 - stagger),
      text: v.toFixed(2),
      anchor: nearRight ? 'end' : 'start',
      tone: candidate.tone,
      force: candidate.force,
    }
  })
  const yGuides = [0.33, 0.66].map(ratio => ({ y: pad + (H - pad * 2) * ratio }))
  return {
    path,
    w: W,
    h: H,
    min: min.toFixed(2),
    max: max.toFixed(2),
    labels,
    overMarkers,
    yGuides,
    guides: buildTimeGuides(series, W, H, pad),
    points,
  }
})

type ChartTipRow = { label: string, value: string, tone?: string }
function compactRows(rows: Array<ChartTipRow | null | undefined | false>): ChartTipRow[] {
  return rows.filter((row): row is ChartTipRow => !!row)
}

const totalGoalsHoverPoint = computed(() => {
  const spark = totalGoalsSpark.value
  const index = chartHover.totalGoals
  return spark && index != null ? spark.points.find(p => p.index === index) ?? null : null
})
const signalHoverPoint = computed(() => {
  const spark = signalSpark.value
  const index = chartHover.signal
  return spark && index != null ? spark.points.find(p => p.index === index) ?? null : null
})
const edgeHoverPoint = computed(() => {
  const spark = edgeSpark.value
  const index = chartHover.edge
  return spark && index != null ? spark.points.find(p => p.index === index) ?? null : null
})
const probHoverPoint = computed(() => {
  const spark = overProbSpark.value
  const index = chartHover.prob
  return spark && index != null ? spark.points.find(p => p.index === index) ?? null : null
})

const totalGoalsTip = computed(() => {
  const spark = totalGoalsSpark.value
  const point = totalGoalsHoverPoint.value
  if (!spark || !point) return null
  const raw = point.raw
  return {
    leftPct: tipLeftPct(point.x, spark.w),
    anchor: tipAnchor(point.x, spark.w),
    title: `${point.minute}' · ${scoreText(raw)}`,
    rows: compactRows([
      { label: '预期总进球', value: point.value.toFixed(2) },
      raw.edgePct != null && { label: 'Edge', value: fmtSignedPct(raw.edgePct), tone: edgeToneOf(raw.edgePct) },
      raw.modelOverPct != null && { label: '模型大球', value: fmtPct(raw.modelOverPct) },
      raw.bookOverPct != null && { label: '平台隐含', value: fmtPct(raw.bookOverPct) },
      raw.signalStrength != null && { label: '双红信号', value: String(raw.signalStrength) },
    ]),
  }
})
const signalTip = computed(() => {
  const spark = signalSpark.value
  const point = signalHoverPoint.value
  if (!spark || !point) return null
  return {
    leftPct: tipLeftPct(point.x, spark.w),
    anchor: tipAnchor(point.x, spark.w),
    title: `${point.minute}'`,
    rows: [{ label: '双红信号', value: String(point.strength) }],
  }
})
const edgeTip = computed(() => {
  const spark = edgeSpark.value
  const point = edgeHoverPoint.value
  if (!spark || !point) return null
  const raw = point.raw
  return {
    leftPct: tipLeftPct(point.x, spark.w),
    anchor: tipAnchor(point.x, spark.w),
    title: `${point.minute}' · ${scoreText(raw)}`,
    rows: compactRows([
      { label: 'Edge', value: fmtSignedPct(point.value), tone: edgeToneOf(point.value) },
      raw.modelOverPct != null && { label: '模型大球', value: fmtPct(raw.modelOverPct) },
      raw.bookOverPct != null && { label: '平台隐含', value: fmtPct(raw.bookOverPct) },
      raw.signalStrength != null && { label: '双红信号', value: String(raw.signalStrength) },
    ]),
  }
})
const probTip = computed(() => {
  const spark = overProbSpark.value
  const point = probHoverPoint.value
  if (!spark || !point) return null
  const raw = point.raw
  return {
    leftPct: tipLeftPct(point.x, spark.w),
    anchor: tipAnchor(point.x, spark.w),
    title: `${point.minute}' · ${scoreText(raw)}`,
    rows: compactRows([
      point.modelValue != null && { label: '模型大球', value: fmtPct(point.modelValue) },
      point.bookValue != null && { label: '平台隐含', value: fmtPct(point.bookValue) },
      raw.edgePct != null && { label: 'Edge', value: fmtSignedPct(raw.edgePct), tone: edgeToneOf(raw.edgePct) },
      raw.homeProb != null && { label: '资金', value: `主 ${raw.homeProb} 平 ${raw.drawProb ?? '-'} 客 ${raw.awayProb ?? '-'}` },
    ]),
  }
})

function onTotalGoalsPointer(e: PointerEvent) {
  const spark = totalGoalsSpark.value
  if (spark) updateChartHover('totalGoals', tgSvg, spark.points, e, spark.w)
}
function onSignalPointer(e: PointerEvent) {
  const spark = signalSpark.value
  if (spark) updateChartHover('signal', sigSvg, spark.points, e, spark.w)
}
function onEdgePointer(e: PointerEvent) {
  const spark = edgeSpark.value
  if (spark) updateChartHover('edge', edgeSvg, spark.points, e, spark.w)
}
function onProbPointer(e: PointerEvent) {
  const spark = overProbSpark.value
  if (spark) updateChartHover('prob', probSvg, spark.points, e, spark.w)
}

// ── 赛前伤停情报 ──
const injuries = computed(() => snapshot.value?.injuries ?? null)
const hasInjuries = computed(() => (injuries.value?.home.length ?? 0) + (injuries.value?.away.length ?? 0) > 0)
function injStatus(s: string): { text: string, cls: string } {
  const u = (s || '').toUpperCase()
  if (u.includes('INJUR')) return { text: '伤', cls: 'out' }
  if (u.includes('DOUBT') || u.includes('QUESTION')) return { text: '疑', cls: 'doubt' }
  if (u.includes('SUSPEND') || u.includes('BAN')) return { text: '停', cls: 'susp' }
  return { text: '缺', cls: 'out' }
}
</script>

<template>
  <div class="live-detail">
    <section class="header">
      <NuxtLink to="/live" class="back focus-ring">
        <ArrowLeft :size="15" />
        <span>返回实时</span>
      </NuxtLink>
      <div v-if="canOpenLive" class="league-line">
        <span v-if="match?.leagueCode" class="code">{{ match.leagueCode }}</span>
        <span>{{ match?.leagueName || snapshot?.leagueName || '—' }}</span>
        <span class="status-pill">{{ statusLabel }}</span>
        <span class="minute num">{{ snapshot?.minute ?? '—' }}</span>
      </div>
      <div v-if="canOpenLive" class="score-line" aria-live="polite" aria-atomic="true">
        <span class="team home">{{ match?.homeTeam || snapshot?.homeTeam || '主队' }}</span>
        <b class="score-block">
          <span class="num">{{ snapshot?.score[0] ?? 0 }}</span>
          <span class="colon">:</span>
          <span class="num">{{ snapshot?.score[1] ?? 0 }}</span>
        </b>
        <span class="team away">{{ match?.awayTeam || snapshot?.awayTeam || '客队' }}</span>
      </div>
      <div v-if="canOpenLive && hasEventProgress" class="event-progress" aria-label="进球和红黄牌进度">
        <div class="ep-half" aria-label="上半场事件">
          <span class="ep-track" aria-hidden="true" />
          <span class="ep-label num">45'</span>
          <span
            v-for="marker in firstHalfProgressMarkers"
            :key="`fh-${marker.id}`"
            :class="['ep-marker', marker.kind, marker.side]"
            :style="{ left: `${marker.left}%` }"
            :title="marker.title"
            :aria-label="marker.title"
            role="img"
          >
            <span v-if="marker.kind === 'goal'" class="ep-ball" aria-hidden="true">&#9917;</span>
            <span v-else class="ep-card" aria-hidden="true" />
          </span>
        </div>
        <div class="ep-half" aria-label="下半场事件">
          <span class="ep-track" aria-hidden="true" />
          <span class="ep-label num">90'</span>
          <span
            v-for="marker in secondHalfProgressMarkers"
            :key="`sh-${marker.id}`"
            :class="['ep-marker', marker.kind, marker.side]"
            :style="{ left: `${marker.left}%` }"
            :title="marker.title"
            :aria-label="marker.title"
            role="img"
          >
            <span v-if="marker.kind === 'goal'" class="ep-ball" aria-hidden="true">&#9917;</span>
            <span v-else class="ep-card" aria-hidden="true" />
          </span>
        </div>
      </div>
      <div v-if="canOpenLive" class="micro-row">
        <span class="cluster home">
          <template v-if="!hasHomeCardProgress">
            <span
              v-for="c in homeCards"
              :key="`h-${c.color}`"
              class="stat-token"
              role="img"
              :title="c.title"
              :aria-label="c.title"
            >
              <span :class="['stat-icon', 'card-icon', c.color]" aria-hidden="true" />
              <span class="num">{{ c.count }}</span>
              <span v-if="c.times.length" class="stat-times num">{{ c.times.join(' ') }}</span>
            </span>
          </template>
          <span class="stat-token" role="img" :aria-label="`主队角球${snapshot?.corners[0] ?? 0}`">
            <Flag :size="13" class="stat-svg corner-svg" aria-hidden="true" />
            <span class="num">{{ snapshot?.corners[0] ?? 0 }}</span>
          </span>
        </span>
        <span class="half num">{{ snapshot?.halfScore ?? '-' }}</span>
        <span class="cluster away">
          <span class="stat-token" role="img" :aria-label="`客队角球${snapshot?.corners[1] ?? 0}`">
            <Flag :size="13" class="stat-svg corner-svg" aria-hidden="true" />
            <span class="num">{{ snapshot?.corners[1] ?? 0 }}</span>
          </span>
          <template v-if="!hasAwayCardProgress">
            <span
              v-for="c in awayCards"
              :key="`a-${c.color}`"
              class="stat-token"
              role="img"
              :title="c.title"
              :aria-label="c.title"
            >
              <span :class="['stat-icon', 'card-icon', c.color]" aria-hidden="true" />
              <span class="num">{{ c.count }}</span>
              <span v-if="c.times.length" class="stat-times num">{{ c.times.join(' ') }}</span>
            </span>
          </template>
        </span>
      </div>
    </section>

    <UpgradeUnlockCard
      v-if="!canOpenLive"
      variant="hero"
      headline="实时赛事 · 付费会员专享"
      :subline="liveLockMessage"
      :features="['滚球比分赛况', '现场盘口赔率', '赛中价值模型']"
    />
    <div v-else class="content-grid">
    <!-- 赛中统计模型（xG 外推 + 大小球 edge） -->
    <section v-if="model" class="model-card">
      <div class="section-title brand">
        <span>赛中分析</span>
      </div>
      <div class="model-twin">
        <div class="m-pair">
          <span class="num hv">{{ model.xgHome.toFixed(2) }}</span>
          <b class="m-lbl">xG</b>
          <span class="num av">{{ model.xgAway.toFixed(2) }}</span>
        </div>
        <div class="m-pair">
          <span class="num hv">{{ model.control[0] }}%</span>
          <b class="m-lbl">控场</b>
          <span class="num av">{{ model.control[1] }}%</span>
        </div>
      </div>
      <div class="m-goals">
        <span>当前 <b class="num">{{ model.currentGoals }}</b></span>
        <span>剩余估 <b class="num">{{ model.remainingGoals.toFixed(2) }}</b></span>
        <span>模型总进球 <b class="num">{{ model.modelTotalGoals.toFixed(2) }}</b></span>
        <span v-if="model.redCards" class="rd">红牌 {{ model.redCards }}（产能衰减）</span>
      </div>
      <div v-if="totalGoalsSpark" class="total-goals-chart">
        <div class="tg-head">
          <span>预期总进球</span>
          <span class="muted num">{{ totalGoalsSpark.min }} ~ {{ totalGoalsSpark.max }}</span>
        </div>
        <svg
          ref="tgSvg"
          class="tg-spark interactive-chart"
          :viewBox="`0 0 ${totalGoalsSpark.w} ${totalGoalsSpark.h}`"
          preserveAspectRatio="none"
          @pointerdown="onTotalGoalsPointer"
          @pointermove="onTotalGoalsPointer"
          @pointerleave="leaveChartHover('totalGoals', $event)"
          @pointerup="endChartHover('totalGoals', $event)"
          @pointercancel="endChartHover('totalGoals', $event)"
        >
          <line
            v-for="guide in totalGoalsSpark.yGuides"
            :key="`tg-y-${guide.y}`"
            class="tg-y-guide"
            x1="0"
            :y1="guide.y"
            :x2="totalGoalsSpark.w"
            :y2="guide.y"
          />
          <g v-for="guide in totalGoalsSpark.guides" :key="`tg-guide-${guide.label}`">
            <line :class="['tg-guide', { dashed: guide.dashed }]" :x1="guide.x" y1="0" :x2="guide.x" :y2="totalGoalsSpark.h" />
            <text :x="guide.labelX" :y="guide.labelY" :text-anchor="guide.anchor" class="tg-guide-label">{{ guide.label }}</text>
          </g>
          <path :d="totalGoalsSpark.path" class="tg-line" fill="none" />
          <circle
            v-for="marker in totalGoalsSpark.overMarkers"
            :key="`tg-over-${marker.minute}-${marker.x}`"
            :cx="marker.x"
            :cy="marker.y"
            r="2.7"
            class="tg-over-dot"
          >
            <title>{{ marker.minute }}' · {{ marker.text }}</title>
          </circle>
          <g v-for="label in totalGoalsSpark.labels" :key="`${label.x}-${label.text}`" :class="['tg-label-point', label.tone]">
            <circle :cx="label.x" :cy="label.y" r="2.5" class="tg-dot" />
            <text :x="label.textX" :y="label.textY" :text-anchor="label.anchor" class="tg-label">{{ label.text }}</text>
          </g>
          <g v-if="totalGoalsHoverPoint" class="chart-crosshair">
            <line class="chart-crosshair-line" :x1="totalGoalsHoverPoint.x" y1="0" :x2="totalGoalsHoverPoint.x" :y2="totalGoalsSpark.h" />
            <line class="chart-crosshair-line soft" x1="0" :y1="totalGoalsHoverPoint.y" :x2="totalGoalsSpark.w" :y2="totalGoalsHoverPoint.y" />
            <circle class="chart-focus-dot" :cx="totalGoalsHoverPoint.x" :cy="totalGoalsHoverPoint.y" r="3.2" />
          </g>
          <rect class="chart-hitbox" x="0" y="0" :width="totalGoalsSpark.w" :height="totalGoalsSpark.h" />
        </svg>
        <div v-if="totalGoalsTip" :class="['chart-tip', `a-${totalGoalsTip.anchor}`]" :style="{ left: `${totalGoalsTip.leftPct}%` }">
          <div class="chart-tip-title">{{ totalGoalsTip.title }}</div>
          <div v-for="row in totalGoalsTip.rows" :key="row.label" class="chart-tip-row">
            <span>{{ row.label }}</span>
            <b :class="['num', row.tone]">{{ row.value }}</b>
          </div>
        </div>
      </div>
      <div v-if="model.goalLine" class="m-edge">
        <div class="edge-title">大小 <b class="num">{{ model.goalLine }}</b> · 模型 vs 主流平台</div>
        <div class="edge-bars">
          <span class="eb">模型大球 <b class="num">{{ model.modelOverPct }}%</b></span>
          <span class="eb">主流平台隐含 <b class="num">{{ model.bookOverPct }}%</b></span>
          <span class="eb hi">Edge <b :class="['num', edgeClass]">{{ edgeText }}</b></span>
        </div>
      </div>
      <div v-else class="m-edge-empty">无 Goal Line 盘口，仅展示 xG / 剩余进球估计</div>
    </section>

    <!-- 赛中分析（BSW 网关：xG 模型 / 盘口资金流向 / 双红信号走势）-->
    <section
      v-if="analysis && (analysis.oddsMove || signalSpark)"
      class="analysis-card"
    >
      <!-- 盘口资金流向 -->
      <div v-if="analysis.oddsMove" class="an-block">
        <div class="an-sub">
          <span>盘口资金流向</span>
          <span :class="['drift', analysis.oddsMove.driftDirection]">{{ driftText(analysis.oddsMove.driftDirection) }}</span>
          <span v-if="analysis.oddsMove.steamDetected" class="steam">蒸汽走势</span>
          <span v-if="analysis.oddsMove.reverseLine" class="steam rev">反向盘</span>
        </div>
        <div class="an-probs">
          <span class="p"><i>主</i><b class="num">{{ analysis.oddsMove.homeProb }}%</b><em :class="driftCls(analysis.oddsMove.homeDriftPct)">{{ signed(analysis.oddsMove.homeDriftPct) }}</em></span>
          <span class="p"><i>平</i><b class="num">{{ analysis.oddsMove.drawProb }}%</b><em :class="driftCls(analysis.oddsMove.drawDriftPct)">{{ signed(analysis.oddsMove.drawDriftPct) }}</em></span>
          <span class="p"><i>客</i><b class="num">{{ analysis.oddsMove.awayProb }}%</b><em :class="driftCls(analysis.oddsMove.awayDriftPct)">{{ signed(analysis.oddsMove.awayDriftPct) }}</em></span>
        </div>
      </div>

      <!-- 双红信号走势 -->
      <div v-if="signalSpark" class="an-block">
        <div class="an-sub"><span>双红信号走势</span><span class="muted">峰值 {{ signalSpark.max }}</span></div>
        <svg
          ref="sigSvg"
          class="sig-spark interactive-chart"
          :viewBox="`0 0 ${signalSpark.w} ${signalSpark.h}`"
          preserveAspectRatio="none"
          @pointerdown="onSignalPointer"
          @pointermove="onSignalPointer"
          @pointerleave="leaveChartHover('signal', $event)"
          @pointerup="endChartHover('signal', $event)"
          @pointercancel="endChartHover('signal', $event)"
        >
          <line
            v-for="guide in signalSpark.guides"
            :key="guide.label"
            :x1="guide.x"
            y1="0"
            :x2="guide.x"
            :y2="signalSpark.h"
            :class="['sig-guide', { dashed: guide.dashed }]"
          />
          <path :d="signalSpark.path" fill="none" stroke="currentColor" stroke-width="1.5" />
          <g v-for="(trigger, index) in signalSpark.triggers" :key="`${trigger.minute}-${index}`">
            <circle :cx="trigger.x" :cy="trigger.y" r="2.7" class="sig-trigger" />
            <text :x="trigger.x" :y="signalSpark.h - 1" text-anchor="middle" class="sig-label">{{ trigger.minute }}'</text>
          </g>
          <g v-if="signalHoverPoint" class="chart-crosshair">
            <line class="chart-crosshair-line" :x1="signalHoverPoint.x" y1="0" :x2="signalHoverPoint.x" :y2="signalSpark.h" />
            <line class="chart-crosshair-line soft" x1="0" :y1="signalHoverPoint.y" :x2="signalSpark.w" :y2="signalHoverPoint.y" />
            <circle class="chart-focus-dot red" :cx="signalHoverPoint.x" :cy="signalHoverPoint.y" r="3" />
          </g>
          <rect class="chart-hitbox" x="0" y="0" :width="signalSpark.w" :height="signalSpark.h" />
        </svg>
        <div v-if="signalTip" :class="['chart-tip', `a-${signalTip.anchor}`]" :style="{ left: `${signalTip.leftPct}%` }">
          <div class="chart-tip-title">{{ signalTip.title }}</div>
          <div v-for="row in signalTip.rows" :key="row.label" class="chart-tip-row">
            <span>{{ row.label }}</span>
            <b class="num">{{ row.value }}</b>
          </div>
        </div>
      </div>
    </section>

    <!-- 完场回放：赛中分析时序（Edge / 大球概率 演变 + 时间轴拖动）-->
    <section v-if="hasReplay" class="replay-card">
      <div class="section-title brand">
        <span>赛中回放</span>
        <span class="model-tag">完场时序 · {{ replaySeries.length }} 点</span>
      </div>

      <!-- 时间轴滑块 + 选中时刻读数 -->
      <div class="rp-scrub">
        <input
          v-model.number="replayIndex"
          class="rp-range focus-ring"
          type="range"
          min="0"
          :max="replaySeries.length - 1"
          step="1"
          :aria-label="`赛中时间轴，共 ${replaySeries.length} 个采样点`"
        >
        <div v-if="replayPoint" class="rp-head">
          <span class="rp-min num">{{ replayPoint.minute }}'</span>
          <span class="rp-score num">{{ replayPoint.score[0] ?? 0 }}-{{ replayPoint.score[1] ?? 0 }}</span>
          <span v-if="replayPoint.edgePct != null" class="rp-edge">Edge <b :class="['num', edgeToneOf(replayPoint.edgePct)]">{{ pctSigned(replayPoint.edgePct) }}</b></span>
          <span v-if="replayPoint.signalStrength != null" class="rp-sig">信号 <b class="num">{{ replayPoint.signalStrength }}</b></span>
        </div>
      </div>
      <div v-if="replayPoint" class="rp-detail">
        <span v-if="replayPoint.modelOverPct != null">模型大球 <b class="num">{{ Math.round(replayPoint.modelOverPct) }}%</b></span>
        <span v-if="replayPoint.bookOverPct != null">平台隐含 <b class="num">{{ Math.round(replayPoint.bookOverPct) }}%</b></span>
        <span v-if="replayPoint.homeProb != null" class="rp-flow">资金 主<b class="num">{{ replayPoint.homeProb }}</b> 平<b class="num">{{ replayPoint.drawProb }}</b> 客<b class="num">{{ replayPoint.awayProb }}</b></span>
      </div>

      <!-- Edge 走势 -->
      <div v-if="edgeSpark" class="rp-chart">
        <div class="rp-clbl"><span>Edge 走势</span><span class="muted">{{ edgeSpark.min }}% ~ {{ edgeSpark.max }}%</span></div>
        <svg
          ref="edgeSvg"
          class="rp-spark edge interactive-chart"
          :viewBox="`0 0 ${edgeSpark.w} ${edgeSpark.h}`"
          preserveAspectRatio="none"
          @pointerdown="onEdgePointer"
          @pointermove="onEdgePointer"
          @pointerleave="leaveChartHover('edge', $event)"
          @pointerup="endChartHover('edge', $event)"
          @pointercancel="endChartHover('edge', $event)"
        >
          <g v-for="guide in edgeSpark.guides" :key="`edge-guide-${guide.label}`">
            <line :class="['rp-guide', { dashed: guide.dashed }]" :x1="guide.x" y1="0" :x2="guide.x" :y2="edgeSpark.h" />
            <text :x="guide.labelX" :y="guide.labelY" :text-anchor="guide.anchor" class="rp-guide-label">{{ guide.label }}</text>
          </g>
          <line v-if="edgeSpark.zeroY != null" class="rp-zero" :x1="0" :y1="edgeSpark.zeroY" :x2="edgeSpark.w" :y2="edgeSpark.zeroY" />
          <line class="rp-cursor" :x1="edgeSpark.cursorX" :y1="0" :x2="edgeSpark.cursorX" :y2="edgeSpark.h" />
          <path :d="edgeSpark.path" fill="none" stroke="currentColor" stroke-width="1.5" />
          <circle v-if="edgeSpark.marker" :cx="edgeSpark.marker.x" :cy="edgeSpark.marker.y" r="2.6" class="rp-dot" />
          <g v-if="edgeHoverPoint" class="chart-crosshair">
            <line class="chart-crosshair-line" :x1="edgeHoverPoint.x" y1="0" :x2="edgeHoverPoint.x" :y2="edgeSpark.h" />
            <line class="chart-crosshair-line soft" x1="0" :y1="edgeHoverPoint.y" :x2="edgeSpark.w" :y2="edgeHoverPoint.y" />
            <circle class="chart-focus-dot" :cx="edgeHoverPoint.x" :cy="edgeHoverPoint.y" r="3" />
          </g>
          <rect class="chart-hitbox" x="0" y="0" :width="edgeSpark.w" :height="edgeSpark.h" />
        </svg>
        <div v-if="edgeTip" :class="['chart-tip', `a-${edgeTip.anchor}`]" :style="{ left: `${edgeTip.leftPct}%` }">
          <div class="chart-tip-title">{{ edgeTip.title }}</div>
          <div v-for="row in edgeTip.rows" :key="row.label" class="chart-tip-row">
            <span>{{ row.label }}</span>
            <b :class="['num', row.tone]">{{ row.value }}</b>
          </div>
        </div>
      </div>

      <!-- 大球概率走势：模型 vs 平台 -->
      <div v-if="overProbSpark" class="rp-chart">
        <div class="rp-clbl">
          <span>大球概率走势</span>
          <span class="rp-legend"><i class="lg model" />模型<i class="lg book" />平台</span>
        </div>
        <svg
          ref="probSvg"
          class="rp-spark interactive-chart"
          :viewBox="`0 0 ${overProbSpark.w} ${overProbSpark.h}`"
          preserveAspectRatio="none"
          @pointerdown="onProbPointer"
          @pointermove="onProbPointer"
          @pointerleave="leaveChartHover('prob', $event)"
          @pointerup="endChartHover('prob', $event)"
          @pointercancel="endChartHover('prob', $event)"
        >
          <g v-for="guide in overProbSpark.guides" :key="`over-guide-${guide.label}`">
            <line :class="['rp-guide', { dashed: guide.dashed }]" :x1="guide.x" y1="0" :x2="guide.x" :y2="overProbSpark.h" />
            <text :x="guide.labelX" :y="guide.labelY" :text-anchor="guide.anchor" class="rp-guide-label">{{ guide.label }}</text>
          </g>
          <line class="rp-cursor" :x1="overProbSpark.cursorX" :y1="0" :x2="overProbSpark.cursorX" :y2="overProbSpark.h" />
          <path :d="overProbSpark.book" fill="none" class="ln-book" stroke-width="1.5" />
          <path :d="overProbSpark.model" fill="none" class="ln-model" stroke-width="1.5" />
          <g v-if="probHoverPoint" class="chart-crosshair">
            <line class="chart-crosshair-line" :x1="probHoverPoint.x" y1="0" :x2="probHoverPoint.x" :y2="overProbSpark.h" />
            <circle v-if="probHoverPoint.bookY != null" class="chart-focus-dot muted" :cx="probHoverPoint.x" :cy="probHoverPoint.bookY" r="2.8" />
            <circle v-if="probHoverPoint.modelY != null" class="chart-focus-dot" :cx="probHoverPoint.x" :cy="probHoverPoint.modelY" r="2.8" />
          </g>
          <rect class="chart-hitbox" x="0" y="0" :width="overProbSpark.w" :height="overProbSpark.h" />
        </svg>
        <div v-if="probTip" :class="['chart-tip', `a-${probTip.anchor}`]" :style="{ left: `${probTip.leftPct}%` }">
          <div class="chart-tip-title">{{ probTip.title }}</div>
          <div v-for="row in probTip.rows" :key="row.label" class="chart-tip-row">
            <span>{{ row.label }}</span>
            <b :class="['num', row.tone]">{{ row.value }}</b>
          </div>
        </div>
      </div>
    </section>

    <!-- 完场但无赛中分析归档（系统上线前进行的老比赛）-->
    <section v-else-if="snapshot?.status === 'finished' && !model" class="replay-empty">
      <BarChart3 :size="15" />
      <span>该场无赛中分析归档（仅系统上线后进行过的比赛可回放）</span>
    </section>

    <!-- 赛前伤停情报（BSW 网关 Kinetel）-->
    <section v-if="hasInjuries && injuries" class="injury-card">
      <div class="section-title brand">
        <span>伤停情报 <span class="model-tag">Kinetel</span></span>
      </div>
      <div class="inj-twin">
        <div class="inj-col">
          <div class="inj-team"><span class="ellip">{{ snapshot?.homeTeam }}</span><span class="inj-n">{{ injuries.home.length }}</span></div>
          <div v-if="injuries.home.length" class="inj-list">
            <div v-for="(p, i) in injuries.home" :key="`h${i}`" class="inj-row">
              <span :class="['inj-st', injStatus(p.status).cls]">{{ injStatus(p.status).text }}</span>
              <b class="inj-name">{{ p.player }}</b>
              <i v-if="p.position" class="inj-pos">{{ p.position }}</i>
              <span v-if="p.reason" class="inj-reason">{{ p.reason }}</span>
            </div>
          </div>
          <div v-else class="inj-empty">无伤停</div>
        </div>
        <div class="inj-col">
          <div class="inj-team"><span class="ellip">{{ snapshot?.awayTeam }}</span><span class="inj-n">{{ injuries.away.length }}</span></div>
          <div v-if="injuries.away.length" class="inj-list">
            <div v-for="(p, i) in injuries.away" :key="`a${i}`" class="inj-row">
              <span :class="['inj-st', injStatus(p.status).cls]">{{ injStatus(p.status).text }}</span>
              <b class="inj-name">{{ p.player }}</b>
              <i v-if="p.position" class="inj-pos">{{ p.position }}</i>
              <span v-if="p.reason" class="inj-reason">{{ p.reason }}</span>
            </div>
          </div>
          <div v-else class="inj-empty">无伤停</div>
        </div>
      </div>
    </section>

    <template v-if="hasLiveContent">
    <section class="timeline live-timeline-section">
      <div class="section-title">
        <span>事件时间线</span>
        <span v-if="liveDataPending" class="pending-pill">
          <Lock :size="11" /> 实时获取中
        </span>
      </div>
      <div v-if="snapshot?.events.length" class="timeline-grid">
        <div
          v-for="event in snapshot.events"
          :key="`${event.minute}-${event.text}`"
          :class="['event-row', event.side, eventTone(event.type)]"
        >
          <span class="minute num">{{ event.minute }}</span>
          <b>
            <span v-if="useFootballIcon(event.type)" class="event-ball" aria-hidden="true">&#9917;</span>
            <component :is="eventIcon(event.type)" v-else-if="eventIcon(event.type)" class="event-icon" :size="13" />
            <span>{{ event.text }}</span>
          </b>
        </div>
      </div>
      <div v-else class="empty-section">
        {{ liveDataPending ? '实时事件数据获取中，稍候自动刷新…' : '本场暂无事件记录' }}
      </div>
    </section>

    <section class="stats live-stats-section">
      <div class="section-title">
        <span>实时技术统计</span>
        <NuxtLink :to="`/football/${eventId}/chart`" class="head-link focus-ring">
          <BarChart3 :size="14" />
        </NuxtLink>
      </div>
      <div v-if="snapshot?.stats.length" class="stats-grid">
        <div v-for="item in snapshot.stats" :key="item.label" class="stat-row">
          <span class="num home-val">{{ item.home }}</span>
          <b class="lbl">{{ item.label }}</b>
          <span class="num away-val">{{ item.away }}</span>
        </div>
      </div>
      <div v-else class="empty-section">
        {{ liveDataPending ? '实时统计数据获取中，稍候自动刷新…' : '本场暂无统计数据' }}
      </div>
    </section>

    <section class="odds live-odds-section">
      <div class="section-title brand">
        <span>现场价位 <span class="live-tag">LIVE</span></span>
        <span v-if="liveOddsMeta" class="lo-meta num">{{ liveOddsMeta }}</span>
      </div>
      <div v-if="snapshot?.liveOdds?.markets?.length" class="lodds-grid">
        <div v-for="m in snapshot.liveOdds.markets" :key="m.market" class="lodds-row">
          <div class="lodds-main">
            <b class="lbl">{{ m.market }}<span v-if="m.line" class="ln"> {{ m.line }}</span></b>
            <span v-for="c in m.cells" :key="c.label" class="cell">
              <i>{{ c.label }}</i><b class="num">{{ c.odd }}</b>
            </span>
          </div>
        </div>
      </div>
      <div v-else class="empty-section">本场暂无现场盘口（未开盘或已封盘）</div>
    </section>
    </template>

    <section v-else class="live-pending">
      <div class="lp-icon"><BarChart3 :size="22" /></div>
      <b>{{ livePendingTitle }}</b>
      <span>{{ livePendingMessage }}</span>
    </section>

    <section v-if="oddsPanel.length" class="odds prematch-odds-section">
      <div class="section-title seg">
        <span>赛前价位 <span class="seg-tag">封盘价</span></span>
      </div>
      <div class="odds-grid">
        <div v-for="item in oddsPanel" :key="item.market" class="odds-row">
          <b class="lbl">{{ item.market }}</b>
          <span class="num">主 {{ item.home }}</span>
          <span :class="['num', { line: item.market !== '1X2' }]">{{ item.drawOrLine }}</span>
          <span class="num">客 {{ item.away }}</span>
        </div>
      </div>
    </section>

    <section v-if="priceCompare.length" class="compare price-compare-section">
      <div class="section-title seg">
        <span>价格比较 <span class="seg-tag">赛前价位</span></span>
        <span class="book-count num">{{ priceCompare.length }} 家公司</span>
      </div>
      <div class="compare-grid">
        <div v-for="book in priceCompare" :key="book.book" class="compare-row">
          <b class="book">{{ book.book }}</b>
          <span class="num">主 {{ book.home }}</span>
          <span class="num">平 {{ book.draw }}</span>
          <span class="num">客 {{ book.away }}</span>
        </div>
      </div>
    </section>
    </div>
  </div>
</template>

<style scoped>
.live-detail {
  display: grid;
}

.content-grid {
  display: grid;
}

.status-pill {
  padding: 1px 6px;
  border-radius: 2px;
  background: #e6f2ff;
  color: var(--brand-deep);
  font-size: 0.7rem;
  font-weight: 760;
}

.pending-pill {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 6px;
  border-radius: 2px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 720;
}

.empty-section {
  padding: 20px 12px;
  border: 1px dashed var(--line);
  border-radius: 4px;
  background: var(--surface);
  color: var(--muted);
  text-align: center;
  font-size: 0.78rem;
  font-weight: 720;
}

/* 未开赛/无实时数据：三块空框收敛为一个全宽占位（桌面跨整行，不散落） */
.live-pending {
  display: flex;
  grid-column: 1 / -1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 34px 18px;
  border: 1px dashed var(--line);
  border-radius: 6px;
  background: var(--panel);
  text-align: center;
}
.live-pending .lp-icon { color: var(--brand); margin-bottom: 2px; }
.live-pending b { color: var(--ink); font-size: 0.92rem; font-weight: 820; }
.live-pending span { max-width: 28em; color: var(--muted); font-size: 0.78rem; font-weight: 700; }

.header {
  display: grid;
  gap: 7px;
  padding: 8px 12px 10px;
  background: linear-gradient(180deg, var(--panel) 0%, var(--surface) 100%);
  border-bottom: 1px solid var(--divider);
}

.back {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 4px;
  color: var(--brand);
  font-size: 0.78rem;
  font-weight: 740;
}

.league-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 760;
  color: var(--ink);
}

.code {
  padding: 0 5px;
  border-radius: 3px;
  background: #1a2233;
  color: #fff;
  font-size: 0.68rem;
  letter-spacing: 0.04em;
  line-height: 1.5;
}

.minute {
  margin-left: auto;
  padding: 1px 7px;
  border-radius: 3px;
  background: var(--buy);
  color: #fff;
  font-size: 0.76rem;
  font-weight: 800;
}

.score-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  text-align: center;
}

.team {
  min-width: 0;
  overflow: hidden;
  font-size: 1.02rem;
  font-weight: 820;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-block {
  display: inline-flex;
  align-items: baseline;
  gap: 6px;
  font-size: 1.42rem;
  font-weight: 860;
  letter-spacing: 0.02em;
}

.score-block .num:first-child {
  color: var(--ink);
}

.score-block .num:last-child {
  color: var(--ink);
}

.colon {
  color: var(--soft);
  font-size: 1.1rem;
}

.event-progress {
  display: grid;
  width: min(100%, 720px);
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  margin: 0 auto;
  padding: 5px 10px 7px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: linear-gradient(180deg, #ffffff 0%, #f8fbff 100%);
  box-shadow: 0 1px 3px rgb(15 23 42 / 0.06);
}

.ep-half {
  position: relative;
  min-width: 0;
  height: 30px;
}

.ep-track {
  position: absolute;
  top: 13px;
  right: 0;
  left: 0;
  height: 5px;
  border-radius: 999px;
  background: linear-gradient(180deg, #1edc43 0%, #069b18 100%);
  box-shadow: inset 0 -1px 0 rgb(15 23 42 / 0.12), 0 0 0 1px rgb(22 163 74 / 0.08);
}

.ep-label {
  position: absolute;
  right: 0;
  bottom: -2px;
  color: var(--muted);
  font-size: 0.58rem;
  font-weight: 760;
  line-height: 1;
}

.ep-marker {
  position: absolute;
  z-index: 1;
  box-sizing: border-box;
  display: inline-grid;
  place-items: center;
  transform: translateX(-50%);
}

.ep-marker.home {
  top: 0;
}

.ep-marker.away {
  top: 16px;
}

.ep-marker.goal {
  width: 18px;
  height: 18px;
  border: 1px solid rgb(148 163 184 / 0.46);
  border-radius: 999px;
  background: #ffffff;
  box-shadow: 0 1px 3px rgb(15 23 42 / 0.16);
}

.ep-marker.goal.away {
  top: 15px;
}

.ep-ball,
.event-ball {
  display: inline-block;
  font-size: 12px;
  line-height: 1;
}

.ep-marker.yellow,
.ep-marker.red {
  width: 10px;
  height: 18px;
}

.ep-marker.yellow.home,
.ep-marker.red.home {
  top: 3px;
}

.ep-marker.yellow.away,
.ep-marker.red.away {
  top: 12px;
}

.ep-card {
  width: 100%;
  height: 100%;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgb(15 23 42 / 0.10), 0 1px 2px rgb(15 23 42 / 0.16);
}

.ep-marker.yellow .ep-card {
  background: #f6b800;
}

.ep-marker.red .ep-card {
  background: var(--buy);
}

.micro-row {
  display: grid;
  width: min(100%, 560px);
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  margin: -2px auto 0;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 720;
}

.cluster {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.cluster.home {
  justify-self: end;
}

.cluster.away {
  justify-self: start;
}

.half {
  padding: 1px 7px;
  border-radius: 3px;
  border: 1px solid var(--brand-tint-strong);
  background: var(--brand-tint);
  color: var(--brand-deep);
  font-size: 0.72rem;
  font-weight: 760;
}

.stat-token {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 780;
  line-height: 1;
}

.stat-icon {
  flex: 0 0 auto;
}

.card-icon {
  width: 8px;
  height: 13px;
  border-radius: 2px;
  box-shadow: 0 0 0 1px rgba(15, 23, 42, 0.06);
}

.card-icon.red {
  background: var(--buy);
}

.card-icon.yellow {
  background: #f6b800;
}

.stat-svg {
  flex: 0 0 auto;
  stroke-width: 2.2;
}

.corner-svg {
  color: #16a34a;
  fill: rgba(22, 163, 74, 0.16);
}

.stat-token .num {
  color: var(--ink);
}

.stat-times {
  max-width: 92px;
  overflow: hidden;
  color: var(--muted) !important;
  font-size: 0.68rem;
  font-weight: 720;
  text-overflow: ellipsis;
  white-space: nowrap;
}

section.timeline,
section.stats,
section.odds,
section.compare {
  padding: 8px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
}

.section-title {
  margin-bottom: 6px;
}

.head-link {
  display: inline-grid;
  width: 24px;
  height: 24px;
  place-items: center;
  border-radius: 3px;
  background: rgba(124, 92, 250, 0.14);
  color: var(--brand-deep);
}

.timeline-grid,
.stats-grid,
.odds-grid,
.lodds-grid,
.compare-grid {
  display: grid;
  gap: 1px;
  background: var(--divider);
  border: 1px solid var(--divider);
  border-radius: 4px;
  overflow: hidden;
}

.event-row {
  display: grid;
  grid-template-columns: 40px minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  padding: 6px 9px;
  background: var(--panel);
  font-size: 0.78rem;
}

.event-row.away {
  grid-template-columns: minmax(0, 1fr) 40px;
  text-align: right;
}

.event-row.home {
  background: var(--brand-tint);
}

.event-row.away {
  background: var(--away-bg);
}

/* 时间线分钟：清爽的中性时间码，不复用 header 的红底徽章（避免红底蓝字看不清） */
.event-row .minute {
  justify-self: start;
  margin-left: 0;
  padding: 1px 5px;
  border-radius: 3px;
  background: var(--surface);
  color: var(--muted);
  font-weight: 800;
  font-size: 0.72rem;
  white-space: nowrap;
}

.event-row.away .minute {
  grid-column: 2;
  justify-self: end;
  color: var(--muted);
}

.event-row.away b {
  grid-column: 1;
  grid-row: 1;
}

.event-row b {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 4px;
}

.event-row.away b {
  justify-self: end;
}

.event-icon {
  flex: 0 0 auto;
  stroke-width: 2.3;
}

.event-ball {
  flex: 0 0 auto;
  font-size: 11px;
}

.event-row.goal b {
  color: var(--sell);
}

.event-row.red b {
  color: var(--buy);
}

.event-row.yellow b {
  color: #b08113;
}

.event-row.corner b {
  color: var(--brand-deep);
  font-weight: 720;
}

.event-row.mute b {
  color: var(--muted);
  font-weight: 720;
}

.stat-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--panel);
}

.stat-row .lbl {
  padding: 0 8px;
  font-size: 0.76rem;
  font-weight: 780;
  color: var(--muted);
}

.stat-row .home-val {
  text-align: right;
  font-weight: 800;
  font-size: 0.92rem;
  color: var(--brand);
}

.stat-row .away-val {
  text-align: left;
  font-weight: 800;
  font-size: 0.92rem;
  color: var(--buy);
}

.odds-row,
.compare-row {
  display: grid;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: var(--panel);
  font-size: 0.78rem;
}

.odds-row {
  grid-template-columns: 60px repeat(3, minmax(0, 1fr));
}

.odds-row .lbl {
  font-weight: 800;
  color: var(--accent-deep);
  font-size: 0.76rem;
}

.odds-row .num {
  text-align: center;
  font-weight: 740;
}

.odds-row .num.line {
  color: var(--brand-deep);
}

.compare-row {
  grid-template-columns: 70px repeat(3, minmax(0, 1fr));
}

.compare-row .book {
  font-weight: 800;
  color: var(--ink);
  font-size: 0.78rem;
}

.compare-row .num {
  text-align: center;
  font-weight: 740;
  color: var(--ink);
}

.book-count {
  font-weight: 720;
  font-size: 0.72rem;
  opacity: 0.85;
}

/* 现场赔率面板（in-play） */
.lodds-row {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 8px 10px;
  background: var(--panel);
  font-size: 0.8rem;
}

.lodds-main {
  display: flex;
  align-items: center;
  gap: 6px;
}

.lodds-row .lbl {
  flex: 0 0 66px;
  font-weight: 800;
  color: var(--accent-deep);
  font-size: 0.78rem;
}

/* 赔率走势 sparkline */
/* (现场价位走势 sparkline 样式已移除) */

.lodds-row .lbl .ln {
  margin-left: 3px;
  color: var(--brand-deep);
  font-weight: 760;
  font-size: 0.72rem;
}

.lodds-row .cell {
  flex: 1 1 0;
  display: inline-flex;
  align-items: baseline;
  justify-content: center;
  gap: 5px;
  min-width: 0;
}

.lodds-row .cell i {
  font-style: normal;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 720;
}

.lodds-row .cell b {
  font-weight: 800;
  color: var(--ink);
}

.live-tag {
  display: inline-block;
  margin-left: 5px;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--buy);
  color: #fff;
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  vertical-align: middle;
}

.lo-meta {
  color: var(--muted);
  font-size: 0.7rem;
  font-weight: 720;
}

/* 赛前赔率标识：明确告知价格比较是封盘前赔率，非现场实时价 */
.seg-tag {
  display: inline-block;
  margin-left: 5px;
  padding: 0 5px;
  border-radius: 3px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.62rem;
  font-weight: 760;
  vertical-align: middle;
}

/* ── 赛中统计模型卡 ── */
.model-card {
  padding: 9px 10px;
  background: linear-gradient(180deg, #f6f3fe 0%, var(--panel) 60%);
  border-bottom: 1px solid var(--divider);
}

.model-card .section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 820;
}

.model-tag {
  margin-left: 5px;
  padding: 0 5px;
  border-radius: 3px;
  background: rgba(124, 92, 250, 0.14);
  color: var(--brand-deep);
  font-size: 0.62rem;
  font-weight: 760;
}

.lean {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 820;
}
.lean.over { background: var(--brand-tint); color: var(--brand-deep); }
.lean.under { background: var(--away-bg); color: #8a6212; }
.lean.neutral { background: var(--surface); color: var(--muted); }

.model-twin {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin: 7px 0;
}

.m-pair {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 6px;
  padding: 5px 8px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
}

.m-pair .m-lbl { color: var(--muted); font-size: 0.74rem; font-weight: 780; }
.m-pair .hv { text-align: right; font-weight: 860; font-size: 0.96rem; color: var(--ink); }
.m-pair .av { text-align: left; font-weight: 860; font-size: 0.96rem; color: var(--ink); }

.m-goals {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  padding: 5px 0;
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 720;
}
.m-goals b { color: var(--ink); font-weight: 820; }
.m-goals .rd { color: #b1253c; font-weight: 760; }

.total-goals-chart {
  position: relative;
  --tip-top: 34px;
  margin: 2px 0 6px;
  padding: 7px 8px 6px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
}

.tg-head {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--ink);
  font-size: 0.74rem;
  font-weight: 800;
}
.tg-head .muted { color: var(--muted); font-size: 0.68rem; font-weight: 720; }
.tg-spark { display: block; width: 100%; height: 93px; margin-top: 4px; color: var(--brand-deep); }
.tg-line {
  stroke: currentColor;
  stroke-width: 1.7;
  stroke-linecap: round;
  stroke-linejoin: round;
  vector-effect: non-scaling-stroke;
}
.tg-y-guide {
  stroke: rgba(148, 163, 184, 0.22);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.tg-guide {
  stroke: rgba(107, 115, 133, 0.42);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.tg-guide.dashed { stroke-dasharray: 3 3; }
.tg-guide-label {
  fill: var(--muted);
  font-size: 8px;
  font-weight: 780;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 2px;
  vector-effect: non-scaling-stroke;
}
.tg-dot {
  fill: #fff;
  stroke: var(--sell);
  stroke-width: 1.5;
  vector-effect: non-scaling-stroke;
}
.tg-label-point.jump .tg-dot {
  fill: #fff7ed;
  stroke: #d97706;
  stroke-width: 1.6;
}
.tg-label-point.extreme .tg-dot {
  stroke: var(--brand-deep);
}
.tg-label-point.latest .tg-dot {
  fill: var(--brand-deep);
  stroke: #fff;
  stroke-width: 1.4;
}
.tg-label-point.over .tg-dot {
  fill: var(--buy);
  stroke: #fff;
  stroke-width: 1.4;
}
.tg-over-dot {
  fill: var(--buy);
  stroke: #fff;
  stroke-width: 1.4;
  vector-effect: non-scaling-stroke;
}
.tg-label {
  fill: var(--ink);
  font-size: 8.4px;
  font-weight: 800;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 1.8px;
  vector-effect: non-scaling-stroke;
}

.interactive-chart {
  cursor: crosshair;
  touch-action: pan-y;
}
.chart-hitbox {
  fill: transparent;
  pointer-events: all;
}
.chart-crosshair {
  pointer-events: none;
}
.chart-crosshair-line {
  stroke: rgba(26, 34, 51, 0.42);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.chart-crosshair-line.soft {
  stroke: rgba(100, 116, 139, 0.26);
  stroke-dasharray: 3 3;
}
.chart-focus-dot {
  fill: var(--brand-deep);
  stroke: #fff;
  stroke-width: 1.7;
  vector-effect: non-scaling-stroke;
}
.chart-focus-dot.red {
  fill: var(--buy);
}
.chart-focus-dot.muted {
  fill: var(--soft);
}
.chart-tip {
  position: absolute;
  z-index: 6;
  top: var(--tip-top, 28px);
  min-width: 136px;
  max-width: min(220px, calc(100% - 16px));
  padding: 6px 8px;
  border: 1px solid rgba(124, 92, 250, 0.26);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 10px 24px rgba(27, 35, 55, 0.14);
  color: var(--ink);
  pointer-events: none;
}
/* 提示框移到光标侧旁留 9px 间隙,避免盖住十字准线/数据点(原 a-mid 居中会遮挡)。 */
.chart-tip.a-left { transform: translateX(9px); }
.chart-tip.a-mid { transform: translateX(-50%); }
.chart-tip.a-right { transform: translateX(calc(-100% - 9px)); }
.chart-tip-title {
  margin-bottom: 4px;
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 800;
}
.chart-tip-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  font-size: 0.68rem;
  font-weight: 740;
  line-height: 1.45;
}
.chart-tip-row span {
  color: var(--muted);
}
.chart-tip-row b {
  color: var(--ink);
  font-weight: 860;
}
.chart-tip-row b.pos {
  color: var(--sell);
}
.chart-tip-row b.neg {
  color: var(--buy);
}

.m-edge {
  margin-top: 4px;
  padding: 7px 9px;
  border: 1px solid var(--brand-tint-strong);
  border-radius: 5px;
  background: var(--brand-tint);
}

.edge-title { color: var(--brand-deep); font-size: 0.76rem; font-weight: 780; margin-bottom: 5px; }
.edge-title b { color: var(--brand-deep); }

.edge-bars { display: flex; flex-wrap: wrap; gap: 6px 14px; align-items: baseline; }
.eb { font-size: 0.78rem; color: var(--muted); font-weight: 720; }
.eb b { color: var(--ink); font-weight: 820; margin-left: 3px; }
.eb.hi b { font-size: 0.92rem; }
.eb .pos { color: var(--sell); }
.eb .neg { color: var(--buy); }

.m-edge-empty {
  margin-top: 4px;
  padding: 6px 9px;
  border: 1px dashed var(--line);
  border-radius: 5px;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 700;
}

@media (max-width: 370px) {
  .event-progress {
    gap: 10px;
    padding-right: 7px;
    padding-left: 7px;
  }

  .micro-row {
    gap: 6px;
  }

  .cluster {
    gap: 4px;
  }

  .stat-times {
    max-width: 52px;
  }

  .odds-row {
    grid-template-columns: 52px repeat(3, minmax(0, 1fr));
    gap: 5px;
    font-size: 0.74rem;
  }

  .compare-row {
    grid-template-columns: 58px repeat(3, minmax(0, 1fr));
    gap: 5px;
    font-size: 0.74rem;
  }
}

@media (min-width: 1024px) {
  .live-detail {
    width: min(100%, 1280px);
    margin: 0 auto;
    padding: 16px 0;
    gap: 12px;
  }

  .header {
    border: 1px solid var(--line);
    border-radius: 6px;
  }

  .header {
    padding: 16px 20px;
  }

  .score-block {
    font-size: 1.8rem;
  }

  .score-line {
    width: min(100%, 900px);
    margin: 0 auto;
  }

  .team {
    font-size: 1.2rem;
  }

  .content-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    grid-auto-flow: dense;
    align-items: start;
  }

  section.model-card,
  section.analysis-card,
  section.replay-card,
  section.replay-empty,
  section.injury-card,
  section.timeline,
  section.stats,
  section.odds,
  section.compare {
    min-width: 0;
    border-radius: 6px;
    border: 1px solid var(--line);
  }

  .replay-card,
  .replay-empty,
  .injury-card,
  .live-pending,
  .price-compare-section {
    grid-column: 1 / -1;
  }
}

/* 宽屏：切为看板式多列，避免 CSS Grid 同行高卡撑出大面积空白。 */
@media (min-width: 1440px) {
  .live-detail {
    width: min(100%, 1360px);
  }

  .content-grid {
    display: block;
    column-count: 3;
    column-gap: 14px;
  }

  .content-grid > section {
    display: inline-block;
    width: 100%;
    margin: 0 0 14px;
    break-inside: avoid;
    vertical-align: top;
  }
}

@media (min-width: 1700px) {
  .live-detail {
    width: min(100%, 1520px);
  }

  .content-grid {
    column-count: 4;
  }
}

/* ── 赛中分析（BSW 网关）── */
.analysis-card {
  padding: 9px 10px;
  background: linear-gradient(180deg, #f6f3fe 0%, var(--panel) 60%);
  border-bottom: 1px solid var(--divider);
}
.analysis-card .section-title { font-weight: 820; }

.an-block {
  position: relative;
  --tip-top: 30px;
  margin-top: 7px;
  padding: 7px 9px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
}

.an-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin-top: 6px;
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 720;
}
.an-meta b { color: var(--ink); font-weight: 820; }

.perf { padding: 1px 7px; border-radius: 999px; font-size: 0.7rem; font-weight: 800; }
.perf.over { background: var(--away-bg); color: #8a6212; }
.perf.under { background: var(--brand-tint); color: var(--brand-deep); }
.perf.neutral { background: var(--surface); color: var(--muted); }

.an-sub {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 800;
}
.an-sub .muted { color: var(--muted); font-weight: 700; font-size: 0.72rem; }

.drift { padding: 1px 7px; border-radius: 999px; font-size: 0.7rem; font-weight: 800; background: var(--surface); color: var(--muted); }
.drift.home_up { background: var(--brand-tint); color: var(--brand-deep); }
.drift.away_up { background: var(--away-bg); color: #8a6212; }
.drift.draw_up { background: var(--surface); color: var(--ink); }

.steam { padding: 1px 7px; border-radius: 999px; background: #fde0e7; color: #b1253c; font-size: 0.68rem; font-weight: 820; }
.steam.rev { background: #fff2d6; color: #8a6212; }

.an-probs { display: flex; gap: 6px; margin-top: 7px; }
.an-probs .p {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  padding: 5px 4px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--surface);
}
.an-probs .p i { color: var(--muted); font-size: 0.7rem; font-weight: 760; font-style: normal; }
.an-probs .p b { color: var(--ink); font-size: 0.92rem; font-weight: 860; }
.an-probs .p em { font-size: 0.68rem; font-weight: 800; font-style: normal; color: var(--soft); }
.an-probs .p em.up { color: var(--sell); }
.an-probs .p em.down { color: var(--buy); }

.sig-spark { display: block; width: 100%; height: 42px; margin-top: 6px; color: #b1253c; }
.sig-guide {
  stroke: rgba(107, 115, 133, 0.5);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.sig-guide.dashed { stroke-dasharray: 3 3; }
.sig-trigger { fill: #fff; stroke: var(--buy); stroke-width: 1.8; vector-effect: non-scaling-stroke; }
.sig-label {
  fill: var(--buy);
  font-size: 8px;
  font-weight: 800;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 2px;
}

/* ── 完场回放：赛中分析时序 ── */
.replay-card {
  padding: 9px 10px;
  background: linear-gradient(180deg, #f6f3fe 0%, var(--panel) 60%);
  border-bottom: 1px solid var(--divider);
}
.replay-card .section-title { font-weight: 820; }

.rp-scrub { margin-top: 8px; }
.rp-range { width: 100%; margin: 0; accent-color: var(--brand-deep); cursor: pointer; }

.rp-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 12px;
  margin-top: 6px;
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 740;
}
.rp-head .rp-min { color: var(--brand-deep); font-weight: 860; font-size: 0.9rem; }
.rp-head .rp-score { color: var(--ink); font-weight: 860; font-size: 0.9rem; }
.rp-head b { color: var(--ink); font-weight: 840; margin-left: 2px; }
.rp-head .pos { color: var(--sell); }
.rp-head .neg { color: var(--buy); }

.rp-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-top: 5px;
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 720;
}
.rp-detail b { color: var(--ink); font-weight: 820; margin-left: 2px; }

.rp-chart { margin-top: 9px; }
.rp-chart {
  position: relative;
  --tip-top: 25px;
}
.rp-clbl {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--ink);
  font-size: 0.76rem;
  font-weight: 780;
}
.rp-clbl .muted { color: var(--muted); font-weight: 700; font-size: 0.7rem; }

.rp-legend { display: inline-flex; align-items: center; gap: 3px; color: var(--muted); font-size: 0.7rem; font-weight: 720; }
.rp-legend .lg { display: inline-block; width: 11px; height: 0; border-top: 2px solid currentColor; }
.rp-legend .lg.model { color: var(--brand-deep); }
.rp-legend .lg.book { color: var(--soft); margin-left: 7px; }

.rp-spark { display: block; width: 100%; height: 50px; margin-top: 4px; color: var(--brand-deep); }
.rp-guide {
  stroke: rgba(107, 115, 133, 0.48);
  stroke-width: 1;
  vector-effect: non-scaling-stroke;
}
.rp-guide.dashed { stroke-dasharray: 3 3; }
.rp-guide-label {
  fill: var(--muted);
  font-size: 8px;
  font-weight: 780;
  paint-order: stroke;
  stroke: #fff;
  stroke-width: 2px;
  vector-effect: non-scaling-stroke;
}
.rp-zero { stroke: var(--line); stroke-width: 1; stroke-dasharray: 3 3; }
.rp-cursor { stroke: var(--soft); stroke-width: 1; opacity: 0.5; }
.rp-dot { fill: var(--brand-deep); }
.ln-model { stroke: var(--brand-deep); }
.ln-book { stroke: var(--soft); stroke-dasharray: 4 3; }

.replay-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px 10px;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 700;
  border-bottom: 1px solid var(--divider);
}

/* ── 赛前伤停情报 ── */
.injury-card {
  padding: 9px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
}
.injury-card .section-title { font-weight: 820; }
.inj-twin { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 7px; }
.inj-col { min-width: 0; }
.inj-team {
  display: flex;
  align-items: center;
  gap: 6px;
  padding-bottom: 5px;
  margin-bottom: 6px;
  border-bottom: 1px solid var(--divider);
  font-size: 0.8rem;
  font-weight: 820;
  color: var(--ink);
}
.inj-team .ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.inj-n { flex: 0 0 auto; padding: 0 6px; border-radius: 999px; background: var(--away-bg); color: #8a6212; font-size: 0.66rem; font-weight: 820; }
.inj-list { display: grid; gap: 6px; }
.inj-row { display: flex; align-items: baseline; flex-wrap: wrap; gap: 4px; font-size: 0.77rem; }
.inj-st { flex: 0 0 auto; padding: 0 5px; border-radius: 3px; font-size: 0.64rem; font-weight: 820; }
.inj-st.out { background: #fde0e7; color: #b1253c; }
.inj-st.doubt { background: #fff2d6; color: #8a6212; }
.inj-st.susp { background: var(--surface); color: var(--muted); }
.inj-name { color: var(--ink); font-weight: 760; }
.inj-pos { color: var(--soft); font-size: 0.66rem; font-style: normal; }
.inj-reason { width: 100%; color: var(--muted); font-size: 0.68rem; font-weight: 600; }
.inj-empty { color: var(--soft); font-size: 0.72rem; font-weight: 700; padding: 3px 0; }
</style>
