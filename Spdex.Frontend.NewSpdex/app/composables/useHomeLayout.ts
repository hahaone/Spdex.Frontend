/**
 * 首页自定义布局：模块/指标 显隐+排序 + 指标自定义阈值。
 *
 * 持久化（双层）：
 * - cookie `newspdex_home_layout`（L0）：即时首屏(SSR 可读，无闪烁) + 匿名 + 离线兜底；
 * - 后端账号级 `/account/prefs/home-layout`（Redis，跨设备真相）：登录后同步、防抖写穿透。
 * 后端 Redis 不可达时优雅降级到 cookie（前端无感）。
 *
 * 无状态前端护栏：状态只在 cookie(每客户端) + 后端(单一真相)，useState 仅请求内共享、不跨实例。
 */
import type { ApiResponse } from '~/types/auth'

export type HomeSectionId = 'big-trades' | 'metrics' | 'features' | 'info'
export type HomeMetricId = 'bf-volume' | 'poly-volume' | 'bf-index' | 'poly-index' | 'double-red'

export interface HomeSectionPref { id: HomeSectionId, visible: boolean }
export interface HomeMetricPref { id: HomeMetricId, visible: boolean }
export interface HomeThresholds { bfVolume: number, polyVolume: number, bfIndex: number, polyIndex: number }
export interface HomeLayout {
  sections: HomeSectionPref[]
  metrics: HomeMetricPref[]
  thresholds: HomeThresholds
}

/** 阈值边界（与后端 clamp 对齐）：必发成交 10万–1000万/步10万；POLY成交 50K–2M/步50K；指数 0–100/步5。 */
export const THRESHOLD_BOUNDS = {
  bfVolume: { min: 100_000, max: 10_000_000, step: 100_000 },
  polyVolume: { min: 50_000, max: 2_000_000, step: 50_000 },
  bfIndex: { min: 0, max: 100, step: 5 },
  polyIndex: { min: 0, max: 100, step: 5 },
} as const

const DEFAULT_SECTIONS: HomeSectionPref[] = [
  { id: 'big-trades', visible: true },
  { id: 'metrics', visible: true },
  { id: 'features', visible: true },
  { id: 'info', visible: true },
]
const DEFAULT_METRICS: HomeMetricPref[] = [
  { id: 'bf-volume', visible: true },
  { id: 'poly-volume', visible: true },
  { id: 'bf-index', visible: true },
  { id: 'poly-index', visible: true },
  { id: 'double-red', visible: true },
]
const DEFAULT_THRESHOLDS: HomeThresholds = { bfVolume: 1_000_000, polyVolume: 200_000, bfIndex: 60, polyIndex: 90 }

const SECTION_IDS = DEFAULT_SECTIONS.map(s => s.id) as string[]
const METRIC_IDS = DEFAULT_METRICS.map(m => m.id) as string[]

function defaults(): HomeLayout {
  return {
    sections: DEFAULT_SECTIONS.map(s => ({ ...s })),
    metrics: DEFAULT_METRICS.map(m => ({ ...m })),
    thresholds: { ...DEFAULT_THRESHOLDS },
  }
}

function clampThreshold(key: keyof HomeThresholds, v: unknown): number {
  const b = THRESHOLD_BOUNDS[key]
  const n = typeof v === 'number' && isFinite(v) ? v : DEFAULT_THRESHOLDS[key]
  const stepped = Math.round(n / b.step) * b.step
  return Math.min(b.max, Math.max(b.min, stepped))
}

/** 合并存量(可能不完整/含旧字段)与默认：保留已知项顺序+visible，丢未知 id，补缺失项(默认可见、置末)。 */
function mergeList<T extends { id: string, visible: boolean }>(stored: unknown, knownIds: string[], def: T[]): T[] {
  const out: T[] = []
  const seen = new Set<string>()
  if (Array.isArray(stored)) {
    for (const item of stored) {
      const id = (item as { id?: string })?.id
      if (id && knownIds.includes(id) && !seen.has(id)) {
        out.push({ id, visible: (item as { visible?: boolean }).visible !== false } as T)
        seen.add(id)
      }
    }
  }
  for (const d of def) if (!seen.has(d.id)) { out.push({ ...d }); seen.add(d.id) }
  return out
}

/** 任意来源(cookie/服务端)→ 规整完整 HomeLayout。 */
export function mergeHomeLayout(stored: Partial<HomeLayout> | null | undefined): HomeLayout {
  if (!stored || typeof stored !== 'object') return defaults()
  const t = (stored.thresholds ?? {}) as Partial<HomeThresholds>
  return {
    sections: mergeList(stored.sections, SECTION_IDS, DEFAULT_SECTIONS),
    metrics: mergeList(stored.metrics, METRIC_IDS, DEFAULT_METRICS),
    thresholds: {
      bfVolume: clampThreshold('bfVolume', t.bfVolume),
      polyVolume: clampThreshold('polyVolume', t.polyVolume),
      bfIndex: clampThreshold('bfIndex', t.bfIndex),
      polyIndex: clampThreshold('polyIndex', t.polyIndex),
    },
  }
}

const COOKIE = 'newspdex_home_layout'
const PREF_PATH = '/api/newspdex/account/prefs/home-layout'

export function useHomeLayout() {
  const cookie = useCookie<HomeLayout | null>(COOKIE, {
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    default: () => null,
  })
  // 共享反应式状态：SSR 从 cookie 初始化 → 首屏即正确个性化（无状态前端，cookie 承载）
  const layout = useState<HomeLayout>('newspdex-home-layout', () => mergeHomeLayout(cookie.value))
  const synced = useState<boolean>('newspdex-home-layout-synced', () => false)
  // 内联编辑模式开关（首页与自定义面板共享）
  const editMode = useState<boolean>('newspdex-home-edit', () => false)

  const { isLoggedIn } = useAuth()

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  /** 落 cookie(立即) + 防抖写服务端(登录时)。 */
  function persist() {
    cookie.value = layout.value
    if (!isLoggedIn.value) return
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      $apiFetch(PREF_PATH, { method: 'PUT', body: layout.value })
        .catch(() => { /* Redis 降级/网络异常 → cookie 已兜底 */ })
    }, 600)
  }

  /** 登录后从服务端拉账号级真相（仅客户端、整会话一次）。服务端空则用当前预热。 */
  async function syncFromServer() {
    if (synced.value || !isLoggedIn.value || typeof window === 'undefined') return
    synced.value = true
    try {
      const res = await $apiFetch<ApiResponse<Partial<HomeLayout> | null>>(PREF_PATH)
      if (res?.data) {
        layout.value = mergeHomeLayout(res.data)
        cookie.value = layout.value
      }
      else {
        await $apiFetch(PREF_PATH, { method: 'PUT', body: layout.value }).catch(() => {})
      }
    }
    catch { /* 拉取失败 → cookie 兜底 */ }
  }

  // 渲染用：可见 + 有序
  const orderedSections = computed(() => layout.value.sections.filter(s => s.visible).map(s => s.id))
  const orderedMetrics = computed(() => layout.value.metrics.filter(m => m.visible).map(m => m.id))
  const allHidden = computed(() => orderedSections.value.length === 0)

  // —— 编辑态 mutations ——
  function move<T extends { id: string }>(arr: T[], id: string, dir: -1 | 1) {
    const i = arr.findIndex(x => x.id === id)
    if (i < 0) return
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    const tmp = arr[i]!
    arr[i] = arr[j]!
    arr[j] = tmp
    persist()
  }
  function toggleSection(id: HomeSectionId) {
    const s = layout.value.sections.find(x => x.id === id)
    if (s) { s.visible = !s.visible; persist() }
  }
  function moveSection(id: HomeSectionId, dir: -1 | 1) { move(layout.value.sections, id, dir) }
  function toggleMetric(id: HomeMetricId) {
    const m = layout.value.metrics.find(x => x.id === id)
    if (m) { m.visible = !m.visible; persist() }
  }
  function moveMetric(id: HomeMetricId, dir: -1 | 1) { move(layout.value.metrics, id, dir) }
  function setThreshold(key: keyof HomeThresholds, value: number) {
    layout.value.thresholds[key] = clampThreshold(key, value)
    persist()
  }
  function reset() { layout.value = defaults(); persist() }

  return {
    layout,
    editMode,
    orderedSections,
    orderedMetrics,
    allHidden,
    syncFromServer,
    toggleSection,
    moveSection,
    toggleMetric,
    moveMetric,
    setThreshold,
    reset,
  }
}
