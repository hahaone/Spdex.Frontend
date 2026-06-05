<script setup lang="ts">
/**
 * 实时列表「主从视图」右侧预览面板(仅桌面)。
 * 点击左侧赛事即在此展示比分/统计/赔率/模型，无需跳转;底部可进完整赛况页。
 */
import { ArrowUpRight } from '@lucide/vue'
import { formatHandicapLine } from '~/utils/handicap'

const props = defineProps<{ eventId: number }>()

const { snapshot, pending } = useLiveSnapshot(toRef(props, 'eventId'))

const statusLabel = computed(() => {
  const s = snapshot.value?.status
  return s === 'upcoming' ? '未开赛' : s === 'finished' ? '已完场' : '进行中'
})

function toNum(v: string): number {
  const n = Number.parseFloat(v)
  return Number.isFinite(n) ? n : 0
}
/** 统计条:主队占比(主/(主+客))。 */
function homePct(home: string, away: string): number {
  const h = toNum(home)
  const a = toNum(away)
  const t = h + a
  return t > 0 ? Math.round((h / t) * 100) : 50
}

const homeCards = computed(() => snapshot.value?.cardBadges.filter(b => b.side === 'home') ?? [])
const awayCards = computed(() => snapshot.value?.cardBadges.filter(b => b.side === 'away') ?? [])

const model = computed(() => snapshot.value?.model ?? null)
const leanClass = computed(() => {
  const l = model.value?.lean ?? ''
  return l.includes('大') ? 'over' : l.includes('小') ? 'under' : 'neutral'
})

// 取首个有数据的滚球赔率市场展示
const oddsMarket = computed(() => snapshot.value?.liveOdds?.markets?.find(m => m.cells.length) ?? null)
const oddsMarketLine = computed(() => {
  const market = oddsMarket.value
  if (!market?.line) return ''
  return market.market === '让球' ? formatHandicapLine(market.line) : market.line
})
</script>

<template>
  <div class="preview">
    <div v-if="pending && !snapshot" class="pv-empty" role="status">加载赛况…</div>
    <template v-else-if="snapshot">
      <div class="pv-head">
        <span class="pv-league ellip">{{ snapshot.leagueName || '—' }}</span>
        <span :class="['pv-status', snapshot.status]">{{ statusLabel }}</span>
        <span v-if="snapshot.status === 'running'" class="pv-min num">{{ snapshot.minute }}</span>
      </div>

      <div class="pv-score">
        <span class="pv-team ellip">{{ snapshot.homeTeam }}</span>
        <b class="pv-sc num">
          <span>{{ snapshot.score[0] }}</span><i>:</i><span>{{ snapshot.score[1] }}</span>
        </b>
        <span class="pv-team away ellip">{{ snapshot.awayTeam }}</span>
      </div>

      <div class="pv-micro">
        <span class="pv-cl">
          <span v-for="c in homeCards" :key="`h-${c.color}`" :class="['pv-card', c.color]" role="img" :aria-label="`主队${c.color === 'red' ? '红牌' : '黄牌'}${c.count}`">{{ c.count }}</span>
          <span class="num">角 {{ snapshot.corners[0] }}</span>
        </span>
        <span class="pv-half num">半 {{ snapshot.halfScore }}</span>
        <span class="pv-cl">
          <span class="num">{{ snapshot.corners[1] }} 角</span>
          <span v-for="c in awayCards" :key="`a-${c.color}`" :class="['pv-card', c.color]" role="img" :aria-label="`客队${c.color === 'red' ? '红牌' : '黄牌'}${c.count}`">{{ c.count }}</span>
        </span>
      </div>

      <!-- 模型 -->
      <div v-if="model" class="pv-model">
        <div class="pv-mrow">
          <span :class="['pv-lean', leanClass]">{{ model.lean }}</span>
          <span v-if="model.edgePct != null" class="num pv-edge" :class="model.edgePct > 3 ? 'pos' : model.edgePct < -3 ? 'neg' : ''">
            Edge {{ model.edgePct > 0 ? '+' : '' }}{{ model.edgePct }}%
          </span>
        </div>
        <div class="pv-mmeta">
          <span>xG <b class="num">{{ model.xgHome.toFixed(2) }}-{{ model.xgAway.toFixed(2) }}</b></span>
          <span>模型Σ <b class="num">{{ model.modelTotalGoals.toFixed(2) }}</b></span>
        </div>
      </div>

      <!-- 统计条 -->
      <div v-if="snapshot.stats.length" class="pv-stats">
        <div v-for="s in snapshot.stats" :key="s.label" class="pv-stat">
          <span class="num sh">{{ s.home }}</span>
          <span class="sl">
            <i class="sl-label">{{ s.label }}</i>
            <i class="sl-bar"><em :style="{ width: `${homePct(s.home, s.away)}%` }" /></i>
          </span>
          <span class="num sa">{{ s.away }}</span>
        </div>
      </div>

      <!-- 滚球赔率 -->
      <div v-if="oddsMarket" class="pv-odds">
        <span class="pv-odds-h">{{ oddsMarket.market }}<i v-if="oddsMarketLine"> {{ oddsMarketLine }}</i></span>
        <span v-for="c in oddsMarket.cells" :key="c.label" class="pv-cell">
          <i>{{ c.label }}</i><b class="num">{{ c.odd }}</b>
        </span>
      </div>

      <NuxtLink :to="`/live/${eventId}`" class="pv-full focus-ring">
        查看完整赛况<ArrowUpRight :size="14" />
      </NuxtLink>
    </template>
    <div v-else class="pv-empty" role="status">暂无赛况数据</div>
  </div>
</template>

<style scoped>
.preview {
  display: grid;
  gap: 10px;
  padding: 14px 16px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
}

.pv-empty {
  padding: 48px 16px;
  text-align: center;
  color: var(--muted);
  font-size: 0.86rem;
  font-weight: 720;
}

.pv-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.8rem;
  font-weight: 760;
  color: var(--muted);
}

.ellip { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-league { flex: 1; min-width: 0; color: var(--ink); }

.pv-status { padding: 1px 7px; border-radius: 3px; font-size: 0.7rem; font-weight: 800; }
.pv-status.running { background: var(--draw-bg); color: var(--sell); }
.pv-status.finished { background: var(--surface); color: var(--muted); }
.pv-status.upcoming { background: var(--brand-tint); color: var(--brand-deep); }
.pv-min { color: var(--sell); font-weight: 820; }

.pv-score {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 10px;
}
.pv-team { font-size: 0.98rem; font-weight: 800; color: var(--ink); text-align: right; }
.pv-team.away { text-align: left; }
.pv-sc { display: inline-flex; align-items: center; gap: 6px; font-size: 1.5rem; font-weight: 880; color: var(--ink); }
.pv-sc i { color: var(--muted); font-style: normal; }

.pv-micro {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 0;
  border-top: 1px solid var(--divider);
  border-bottom: 1px solid var(--divider);
  font-size: 0.74rem;
  font-weight: 720;
  color: var(--muted);
}
.pv-cl { display: inline-flex; align-items: center; gap: 5px; }
.pv-card { padding: 0 5px; border-radius: 2px; font-size: 0.68rem; font-weight: 820; color: #fff; }
.pv-card.yellow { background: #e3b53d; }
.pv-card.red { background: #d3445a; }
.pv-half { font-weight: 800; color: var(--ink); }

.pv-model { display: grid; gap: 4px; }
.pv-mrow { display: flex; align-items: center; justify-content: space-between; }
.pv-lean { padding: 1px 8px; border-radius: 999px; font-size: 0.74rem; font-weight: 820; }
.pv-lean.over { background: var(--away-bg); color: #8a6212; }
.pv-lean.under { background: var(--brand-tint); color: var(--brand-deep); }
.pv-lean.neutral { background: var(--surface); color: var(--muted); }
.pv-edge { font-size: 0.76rem; font-weight: 820; color: var(--muted); }
.pv-edge.pos { color: var(--sell); }
.pv-edge.neg { color: var(--buy); }
.pv-mmeta { display: flex; flex-wrap: wrap; gap: 4px 12px; font-size: 0.76rem; color: var(--muted); font-weight: 720; }
.pv-mmeta b { color: var(--ink); font-weight: 820; }

.pv-stats { display: grid; gap: 5px; }
.pv-stat { display: grid; grid-template-columns: 34px minmax(0, 1fr) 34px; align-items: center; gap: 8px; font-size: 0.76rem; }
.pv-stat .sh { text-align: right; font-weight: 820; color: var(--ink); }
.pv-stat .sa { text-align: left; font-weight: 820; color: var(--ink); }
.sl { display: grid; gap: 2px; }
.sl-label { text-align: center; font-style: normal; font-size: 0.68rem; color: var(--muted); font-weight: 720; }
.sl-bar { height: 4px; border-radius: 2px; background: var(--away-strong); overflow: hidden; }
.sl-bar em { display: block; height: 100%; background: var(--brand); }

.pv-odds { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding-top: 4px; }
.pv-odds-h { font-size: 0.74rem; font-weight: 800; color: var(--accent-deep); }
.pv-odds-h i { font-style: normal; color: var(--muted); }
.pv-cell { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 4px; background: var(--surface); font-size: 0.76rem; }
.pv-cell i { font-style: normal; color: var(--muted); font-weight: 720; }
.pv-cell b { color: var(--brand-deep); font-weight: 820; }

.pv-full {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  margin-top: 2px;
  padding: 8px;
  border-radius: 6px;
  background: var(--brand);
  color: #fff;
  font-size: 0.84rem;
  font-weight: 800;
}
.pv-full:hover { background: var(--brand-deep); }
</style>
