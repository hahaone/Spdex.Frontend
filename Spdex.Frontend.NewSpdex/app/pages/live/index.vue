<script setup lang="ts">
import { ChevronRight, RefreshCw } from '@lucide/vue'
import type { LiveListItem, LiveOdds, LiveTabKey } from '~/composables/useLiveList'

const tab = ref<LiveTabKey>('running')
const tabOptions = [
  { label: '进行中', value: 'running' },
  { label: '未开赛', value: 'upcoming' },
  { label: '已结束', value: 'finished' },
  { label: '昨日', value: 'yesterday' },
  { label: '前日', value: 'before' },
]

const { grouped, matches, count, pending, refresh } = useLiveList(tab)

function badge(m: LiveListItem, side: 'home' | 'away', color: 'yellow' | 'red'): number {
  return m.cardBadges.find(b => b.side === side && b.color === color)?.count ?? 0
}
/** 取某市场的赔率单元（按 label）。 */
function odd(lo: LiveOdds | null, market: string, label: string): string {
  return lo?.markets.find(x => x.market === market)?.cells.find(c => c.label === label)?.odd ?? '-'
}
function line(lo: LiveOdds | null, market: string): string {
  return lo?.markets.find(x => x.market === market)?.line ?? ''
}
function hasOdds(lo: LiveOdds | null): boolean {
  return !!lo?.markets?.length
}
/** 模型价值倾向 → 配色类（大球价值 / 小球价值 / 中性）。 */
function leanCls(lean: string): string {
  if (lean.includes('大')) return 'over'
  if (lean.includes('小')) return 'under'
  return 'neutral'
}
/** 模型 vs 盘口的价值差，带符号整百分比。 */
function fmtEdge(e: number): string {
  return `${e > 0 ? '+' : ''}${e.toFixed(0)}%`
}

// ── 桌面主从视图:选中赛事在右侧预览，不跳转(移动端仍跳转) ──
const isDesktop = useIsDesktop()
const selectedId = ref<number | null>(null)

watch([matches, isDesktop], () => {
  if (!isDesktop.value)
    return
  const list = matches.value
  if (!list.length) {
    selectedId.value = null
    return
  }
  if (selectedId.value == null || !list.some(m => m.eventId === selectedId.value))
    selectedId.value = list[0]!.eventId
}, { immediate: true })

function onCardClick(m: LiveListItem, e: MouseEvent) {
  if (isDesktop.value) {
    e.preventDefault()
    selectedId.value = m.eventId
  }
}
</script>

<template>
  <div class="live-page">
    <section class="live-head">
      <div class="head-top">
        <h2>实时赛事</h2>
        <button class="refresh-btn focus-ring" :disabled="pending" @click="refresh()">
          <RefreshCw :size="14" :class="{ spinning: pending }" />
        </button>
      </div>
      <SegmentedControl v-model="tab" :options="tabOptions" dense tone="ink" />
      <span class="muted num">{{ count }} 场</span>
    </section>

    <section class="live-body">
      <div class="live-master">
      <div v-if="pending && !grouped.length" class="empty" role="status">加载中…</div>
      <div v-else-if="!grouped.length" class="empty" role="status">本范围暂无赛事</div>

      <div v-for="g in grouped" v-else :key="g.league" class="league-group">
        <div class="league-bar">{{ g.league }}</div>

        <NuxtLink
          v-for="m in g.items"
          :key="m.eventId"
          :to="`/live/${m.eventId}`"
          :class="['live-card focus-ring', { selected: m.eventId === selectedId }]"
          @click="onCardClick(m, $event)"
        >
          <!-- 时间栏：时间/分钟/状态 · 盘口线 · 双红 -->
          <div class="c-head">
            <span class="kick num">{{ m.kickoffTime }}</span>
            <span v-if="m.status === 'running'" class="minute num">{{ m.minute }}</span>
            <span v-else-if="m.status === 'finished'" class="st-pill done">完场</span>
            <span v-else class="st-pill up">未开</span>
            <span class="hsp" />
            <span v-if="m.status === 'running' && hasOdds(m.liveOdds)" class="odds-line num">让 {{ line(m.liveOdds, '让球') || '-' }}</span>
            <span v-else-if="m.status === 'upcoming' && m.prematchHandicap" class="odds-line num">让 {{ m.prematchHandicap }}</span>
            <span v-else class="odds-line" aria-hidden="true" />
            <span v-if="m.status === 'running' && hasOdds(m.liveOdds)" class="odds-line num">大 {{ line(m.liveOdds, '大小') || '-' }}</span>
            <span v-else class="odds-line" aria-hidden="true" />
            <span v-if="m.doubleRed" class="dr-tag">双红</span>
          </div>

          <!-- 球队 + 比分 + 行内赔率(进行中: 让球主客 / 大小;未开赛走下方必发行) -->
          <div class="c-teams">
            <div class="trow" :class="{ 'has-odds': m.status === 'running' && hasOdds(m.liveOdds) }">
              <span class="tname">{{ m.homeTeam }}</span>
              <span class="tbadges">
                <i v-if="badge(m, 'home', 'yellow')" class="bdg y num" role="img" :aria-label="`主队黄牌${badge(m, 'home', 'yellow')}`">{{ badge(m, 'home', 'yellow') }}</i>
                <i v-if="badge(m, 'home', 'red')" class="bdg r num" role="img" :aria-label="`主队红牌${badge(m, 'home', 'red')}`">{{ badge(m, 'home', 'red') }}</i>
              </span>
              <b v-if="m.status !== 'upcoming'" class="tscore num">{{ m.score[0] }}</b>
              <template v-if="m.status === 'running' && hasOdds(m.liveOdds)">
                <i class="oc num">{{ odd(m.liveOdds, '让球', '主') }}</i>
                <i class="oc num">{{ odd(m.liveOdds, '大小', '大') }}</i>
              </template>
            </div>
            <div class="trow" :class="{ 'has-odds': m.status === 'running' && hasOdds(m.liveOdds) }">
              <span class="tname">{{ m.awayTeam }}</span>
              <span class="tbadges">
                <i v-if="badge(m, 'away', 'yellow')" class="bdg y num" role="img" :aria-label="`客队黄牌${badge(m, 'away', 'yellow')}`">{{ badge(m, 'away', 'yellow') }}</i>
                <i v-if="badge(m, 'away', 'red')" class="bdg r num" role="img" :aria-label="`客队红牌${badge(m, 'away', 'red')}`">{{ badge(m, 'away', 'red') }}</i>
              </span>
              <b v-if="m.status !== 'upcoming'" class="tscore num">{{ m.score[1] }}</b>
              <template v-if="m.status === 'running' && hasOdds(m.liveOdds)">
                <i class="oc num">{{ odd(m.liveOdds, '让球', '客') }}</i>
                <i class="oc num">{{ odd(m.liveOdds, '大小', '小') }}</i>
              </template>
            </div>
          </div>

          <!-- 未开赛: 必发 主/平/客 赛前赔率 -->
          <div v-if="m.status === 'upcoming' && m.prematchOdds" class="c-pre">
            <span class="pre-l">必发</span>
            <i class="oc num">主 {{ (m.prematchOdds[0] ?? 0).toFixed(2) }}</i>
            <i class="oc num">平 {{ (m.prematchOdds[1] ?? 0).toFixed(2) }}</i>
            <i class="oc num">客 {{ (m.prematchOdds[2] ?? 0).toFixed(2) }}</i>
          </div>
          <div v-else-if="m.status === 'running' && !hasOdds(m.liveOdds)" class="c-odds-empty">本场暂无现场盘口</div>

          <!-- 半场 + 角球（进行中/完场） -->
          <div v-if="m.status !== 'upcoming'" class="c-micro">
            <span>半 <b class="num">{{ m.halfScore }}</b></span>
            <span>角 <b class="num">{{ m.corners[0] }}-{{ m.corners[1] }}</b></span>
            <span class="hsp" />
            <ChevronRight :size="14" class="chev" />
          </div>

          <!-- 赛中模型分析（进行中）：价值倾向 + xG + 预测总进球 -->
          <div v-if="m.status === 'running' && m.model" class="c-model">
            <span class="lean" :class="leanCls(m.model.lean)">
              {{ m.model.lean }}<i v-if="m.model.goalLine && m.model.edgePct != null" class="edge num"> {{ fmtEdge(m.model.edgePct) }}</i>
            </span>
            <span class="ms">xG <b class="num">{{ m.model.xgHome.toFixed(2) }}-{{ m.model.xgAway.toFixed(2) }}</b></span>
            <span class="ms">预测Σ <b class="num">{{ m.model.modelTotalGoals.toFixed(2) }}</b></span>
          </div>

        </NuxtLink>
      </div>
      </div>

      <aside class="live-detail-pane">
        <LiveListPreview v-if="selectedId" :key="selectedId" :event-id="selectedId" />
        <div v-else class="pane-empty">选择左侧赛事查看赛况</div>
      </aside>
    </section>
  </div>
</template>

<style scoped>
.live-page { display: grid; }

.live-head {
  display: grid;
  gap: 6px;
  padding: 9px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
}

.head-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.head-top h2 { margin: 0; font-size: 1rem; font-weight: 820; }

.refresh-btn {
  display: inline-grid;
  width: 30px;
  min-height: 30px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--muted);
}

.muted { color: var(--muted); font-size: 0.72rem; font-weight: 720; }

.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.live-body { padding: 9px 10px 16px; }
.live-master { display: grid; gap: 9px; }
.live-detail-pane { display: none; }
.live-card.selected { box-shadow: 0 0 0 2px var(--brand); }
.pane-empty {
  padding: 60px 20px;
  text-align: center;
  color: var(--muted);
  font-size: 0.86rem;
  font-weight: 720;
  border: 1px dashed var(--line);
  border-radius: 8px;
}

.empty {
  padding: 30px 0;
  color: var(--muted);
  text-align: center;
  font-size: 0.84rem;
  font-weight: 720;
}

.league-group { display: grid; gap: 6px; }

.league-bar {
  padding: 3px 8px;
  border-radius: 3px;
  background: linear-gradient(90deg, var(--surface), var(--panel));
  border-left: 3px solid var(--brand);
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 800;
}

.live-card {
  display: grid;
  gap: 5px;
  padding: 8px 10px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
  color: var(--ink);
  box-shadow: 0 2px 6px rgba(26, 34, 51, 0.05);
}

.c-head {
  display: grid;
  grid-template-columns: auto auto minmax(0, 1fr) 44px 44px auto;
  align-items: center;
  gap: 7px;
}

.kick { color: var(--muted); font-size: 0.76rem; font-weight: 760; }

.minute {
  padding: 1px 6px;
  border-radius: 2px;
  background: var(--buy);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 820;
}

.st-pill {
  padding: 1px 6px;
  border-radius: 2px;
  font-size: 0.7rem;
  font-weight: 760;
}
.st-pill.done { background: var(--surface); color: var(--muted); }
.st-pill.up { background: var(--brand-tint); color: var(--brand-deep); }

.dr-tag {
  padding: 1px 6px;
  border-radius: 2px;
  background: #fde0e7;
  color: #b1253c;
  font-size: 0.7rem;
  font-weight: 820;
}

.chev { color: var(--brand); flex: 0 0 auto; }

.c-teams {
  display: grid;
  gap: 2px;
  padding: 3px 0;
  border-top: 1px solid var(--divider);
  border-bottom: 1px solid var(--divider);
}

.trow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 3px 0;
  font-size: 0.9rem;
  font-weight: 760;
}

/* 进行中:球队行 = 名称 | 牌 | 比分 | 让球赔 | 大小赔 */
.trow.has-odds {
  grid-template-columns: minmax(0, 1fr) auto 22px 44px 44px;
  gap: 6px;
}

.oc {
  text-align: center;
  font-style: normal;
  font-weight: 820;
  color: var(--brand-deep);
}

.tname { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.tbadges { display: inline-flex; gap: 3px; }

.bdg {
  display: inline-grid;
  min-width: 15px;
  height: 15px;
  place-items: center;
  border-radius: 2px;
  font-size: 0.62rem;
  font-weight: 800;
  font-style: normal;
  color: #fff;
}
.bdg.y { background: #d5b300; color: var(--ink); }
.bdg.r { background: var(--buy); }

.tscore { min-width: 20px; text-align: right; font-size: 1rem; font-weight: 860; }

.c-micro {
  display: flex;
  align-items: center;
  gap: 12px;
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 720;
}
.c-micro b { color: var(--ink); }

.c-model {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 3px 10px;
  padding: 4px 0 1px;
  border-top: 1px dashed var(--divider);
  color: var(--muted);
  font-size: 0.73rem;
  font-weight: 720;
}
.c-model .ms b { color: var(--ink); }
.c-model .lean {
  padding: 1px 6px;
  border-radius: 2px;
  font-size: 0.7rem;
  font-weight: 820;
}
.c-model .lean.over { background: #ffe9d6; color: #b4541a; }
.c-model .lean.under { background: var(--brand-tint); color: var(--brand-deep); }
.c-model .lean.neutral { background: var(--surface); color: var(--muted); }
.c-model .lean .edge { font-style: normal; }

/* 进行中无 BSW 盘口提示 */
.c-odds-empty {
  padding: 4px 0;
  color: var(--soft);
  font-size: 0.72rem;
  font-weight: 700;
  border-top: 1px dashed var(--divider);
}

/* 时间栏:撑开 + 盘口线 */
.hsp { flex: 1 1 auto; }

.odds-line {
  color: var(--brand-deep);
  font-size: 0.74rem;
  font-weight: 820;
  min-height: 17px;
  text-align: center;
  white-space: nowrap;
}

/* 未开赛:必发赛前赔率行(主/平/客) */
.c-pre {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 4px 0 1px;
  border-top: 1px dashed var(--divider);
  font-size: 0.82rem;
}
.c-pre .pre-l { color: var(--accent-deep); font-weight: 820; font-size: 0.72rem; }
.c-pre .oc { color: var(--ink); }

@media (min-width: 768px) {
  .live-body { grid-template-columns: 1fr; }
  .league-group { gap: 6px; }
}

/* 桌面：主从视图 — 左联赛列表 + 右赛况预览(sticky) */
@media (min-width: 1024px) {
  .live-body {
    display: grid;
    grid-template-columns: minmax(0, 400px) minmax(0, 1fr);
    gap: 14px;
    align-items: start;
    padding: 12px 0 24px;
  }

  .live-detail-pane {
    display: block;
    position: sticky;
    top: 72px;
  }
}

@media (min-width: 1440px) {
  .live-body {
    grid-template-columns: minmax(0, 440px) minmax(0, 1fr);
  }
}
</style>
