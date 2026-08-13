<script setup lang="ts">
/**
 * 实时列表「主从视图」右侧预览面板(仅桌面)。
 * 点击左侧赛事即在此展示列表摘要，不额外请求完整快照；底部按会籍进入完整赛况页。
 */
import { ArrowUpRight, Lock } from '@lucide/vue'
import type { LiveListItem, LiveStatPair } from '~/composables/useLiveList'
import { formatHandicapLine } from '~/utils/handicap'

const props = defineProps<{
  match: LiveListItem
  canOpenFullDetail: boolean
}>()

const statusLabel = computed(() => {
  const s = props.match.status
  return s === 'upcoming' ? '未开赛' : s === 'finished' ? '已完场' : '进行中'
})

/** 统计条:主队占比(主/(主+客))。 */
function homePct(home: number, away: number): number {
  const total = home + away
  return total > 0 ? Math.round((home / total) * 100) : 50
}
function formatFixedNumber(value: string | number | null | undefined, fixed = 2): string {
  if (value == null) return ''
  const raw = String(value).trim()
  if (!raw) return ''
  return raw.replace(/[+-]?\d+(?:\.\d+)?/g, token => {
    const n = Number.parseFloat(token.replace('＋', '+'))
    return Number.isFinite(n) ? n.toFixed(fixed) : token
  })
}

const homeCards = computed(() => props.match.cardBadges.filter(b => b.side === 'home'))
const awayCards = computed(() => props.match.cardBadges.filter(b => b.side === 'away'))

const model = computed(() => props.canOpenFullDetail ? props.match.model : null)

const statRows = computed<LiveStatPair[]>(() => {
  const stats = props.match.stats
  if (!stats) return []
  const basic = [stats.shots, stats.shotsOnTarget]
  const full = props.canOpenFullDetail
    ? [stats.attacks, stats.dangerousAttacks, stats.xg, stats.penalties, stats.substitutions]
    : []
  return [...basic, ...full].filter((row): row is LiveStatPair => Boolean(row?.label))
})

// 取首个有数据的滚球赔率市场展示
const oddsMarket = computed(() => props.match.liveOdds?.markets?.find(m => m.cells.length) ?? null)
const oddsMarketLine = computed(() => {
  const market = oddsMarket.value
  if (!market?.line) return ''
  return market.market === '让球' ? formatHandicapLine(market.line, { fixed: 2 }) : formatFixedNumber(market.line)
})
</script>

<template>
  <div class="preview">
    <div class="pv-head">
        <span class="pv-league ellip">{{ match.leagueName || '—' }}</span>
        <span :class="['pv-status', match.status]">{{ statusLabel }}</span>
        <span v-if="match.status === 'running'" class="pv-min num">{{ match.minute }}</span>
      </div>

      <div class="pv-score">
        <span class="pv-team ellip">{{ match.homeTeam }}</span>
        <b class="pv-sc num">
          <span>{{ match.score[0] }}</span><i>:</i><span>{{ match.score[1] }}</span>
        </b>
        <span class="pv-team away ellip">{{ match.awayTeam }}</span>
      </div>

      <div class="pv-micro">
        <span class="pv-cl">
          <span v-for="c in homeCards" :key="`h-${c.color}`" :class="['pv-card', c.color]" role="img" :aria-label="`主队${c.color === 'red' ? '红牌' : '黄牌'}${c.count}`">{{ c.count }}</span>
          <span class="num">角 {{ match.corners[0] }}</span>
        </span>
        <span class="pv-half num">半 {{ match.halfScore }}</span>
        <span class="pv-cl">
          <span class="num">{{ match.corners[1] }} 角</span>
          <span v-for="c in awayCards" :key="`a-${c.color}`" :class="['pv-card', c.color]" role="img" :aria-label="`客队${c.color === 'red' ? '红牌' : '黄牌'}${c.count}`">{{ c.count }}</span>
        </span>
      </div>

      <!-- 模型 -->
      <div v-if="model" class="pv-model">
        <div v-if="model.edgePct != null" class="pv-mrow">
          <span class="num pv-edge" :class="model.edgePct > 3 ? 'pos' : model.edgePct < -3 ? 'neg' : ''">
            Edge {{ model.edgePct > 0 ? '+' : '' }}{{ model.edgePct }}%
          </span>
        </div>
        <div class="pv-mmeta">
          <span>xG <b class="num">{{ model.xgHome.toFixed(2) }}-{{ model.xgAway.toFixed(2) }}</b></span>
          <span>模型Σ <b class="num">{{ model.modelTotalGoals.toFixed(2) }}</b></span>
        </div>
      </div>

      <!-- 统计条 -->
      <div v-if="statRows.length" class="pv-stats">
        <div v-for="s in statRows" :key="s.label" class="pv-stat">
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
          <i>{{ c.label }}</i><b class="num">{{ formatFixedNumber(c.odd) || c.odd }}</b>
        </span>
      </div>

      <NuxtLink
        :to="canOpenFullDetail ? `/live/${match.eventId}` : '/account/upgrade'"
        :class="['pv-full', 'focus-ring', { locked: !canOpenFullDetail }]"
      >
        <template v-if="canOpenFullDetail">查看完整赛况<ArrowUpRight :size="14" /></template>
        <template v-else><Lock :size="14" />完整赛况 · 黄金及以上</template>
      </NuxtLink>
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
.pv-full.locked { background: var(--surface); color: var(--brand-deep); border: 1px solid var(--line); }
.pv-full.locked:hover { background: var(--brand-tint); }
</style>
