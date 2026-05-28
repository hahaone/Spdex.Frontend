<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import type { MatchSummary } from '~/types/match'

const props = withDefaults(defineProps<{
  match: MatchSummary
  /** twoWay=true 适配篮球：只显示主/客两行，让分线显示在头部 chip */
  twoWay?: boolean
  /** 跳转路径，默认 /football/{eventId} */
  to?: string
}>(), {
  twoWay: false,
})

const linkTo = computed(() => props.to ?? `/football/${props.match.eventId}`)

const maxTurnover = computed(() => Math.max(...props.match.turnovers.map(toNumber), 1))

function toNumber(value: string): number {
  const normalized = value.toUpperCase().replace(/[$,]/g, '')
  if (normalized.endsWith('M')) return parseFloat(normalized) * 1_000_000
  if (normalized.endsWith('K')) return parseFloat(normalized) * 1_000
  return parseFloat(normalized) || 0
}

function barWidth(value: string): string {
  return `${Math.max(8, (toNumber(value) / maxTurnover.value) * 100)}%`
}

function formatPrice(value: number): string {
  return value > 0 ? value.toFixed(2) : '-'
}

const kickOff = computed(() => props.match.matchTime.slice(11, 16))
</script>

<template>
  <NuxtLink :to="linkTo" class="match-card focus-ring">
    <div class="card-head">
      <span class="league">
        <span class="code">{{ match.leagueCode }}</span>
        <span class="name">{{ match.leagueName }}</span>
      </span>
      <span class="head-right">
        <span class="num kick-off">{{ kickOff }}</span>
        <span v-if="twoWay && match.handicap" class="tag tag-quant num">{{ match.handicap }}</span>
        <span v-if="match.isJc" class="tag tag-brand">竞彩</span>
        <span class="tag tag-mute">{{ match.marketType }}</span>
      </span>
    </div>

    <div :class="['market-grid', { 'two-way': twoWay }]">
      <span class="row-home cell selection home">{{ match.homeTeam }}</span>
      <span class="row-home cell num price">{{ formatPrice(match.prices[0]) }}</span>
      <span class="row-home cell turnover">
        <i :style="{ width: barWidth(match.turnovers[0]) }" />
        <b class="num">{{ match.turnovers[0] }}</b>
      </span>

      <template v-if="!twoWay">
        <span class="row-draw cell selection handicap">{{ match.handicap }}</span>
        <span class="row-draw cell num price">{{ formatPrice(match.prices[1]) }}</span>
        <span class="row-draw cell turnover">
          <i :style="{ width: barWidth(match.turnovers[1]) }" />
          <b class="num">{{ match.turnovers[1] }}</b>
        </span>
      </template>

      <span class="row-away cell selection away">{{ match.awayTeam }}</span>
      <span class="row-away cell num price">{{ formatPrice(match.prices[2]) }}</span>
      <span class="row-away cell turnover">
        <i :style="{ width: barWidth(match.turnovers[2]) }" />
        <b class="num">{{ match.turnovers[2] }}</b>
      </span>
    </div>

    <div v-if="match.euro" class="euro-row" :title="match.euroBookmaker">
      <span class="euro-label">欧赔</span>
      <span class="euro-cell num">{{ match.euro[0].toFixed(2) }}</span>
      <span class="euro-cell num">{{ match.euro[1].toFixed(2) }}</span>
      <span class="euro-cell num">{{ match.euro[2].toFixed(2) }}</span>
    </div>

    <div class="index-row">
      <span class="metric-pill">必指 <b class="num">{{ match.bfIndex.join('/') }}</b></span>
      <span class="metric-pill">P指 <b class="num">{{ match.polyIndex.join('/') }}</b></span>
      <span v-for="flag in match.flags" :key="flag" class="tag tag-signal">{{ flag }}</span>
      <ChevronRight :size="16" />
    </div>
  </NuxtLink>
</template>

<style scoped>
.match-card {
  display: block;
  padding: 0;
  border: 1px solid #dde2eb;
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(26, 34, 51, 0.05);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 9px;
  border-bottom: 1px solid #eaeef4;
  background: linear-gradient(180deg, #f9fbfd 0%, #f3f6fb 100%);
}

.league {
  display: inline-flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
  font-size: 0.82rem;
  font-weight: 760;
}

.code {
  padding: 0 4px;
  border-radius: 3px;
  background: #1a2233;
  color: #fff;
  font-size: 0.66rem;
  font-weight: 760;
  letter-spacing: 0.04em;
  line-height: 1.5;
}

.name {
  color: #1a2233;
  white-space: nowrap;
}

.head-right {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
}

.kick-off {
  color: #4a5364;
  font-size: 0.78rem;
  font-weight: 760;
}

.market-grid {
  display: grid;
  grid-template-columns: minmax(80px, 1.05fr) 48px minmax(76px, 0.95fr);
  gap: 1px;
  background: #eaeef4;
  border-bottom: 1px solid #eaeef4;
}

.cell {
  display: flex;
  align-items: center;
  min-height: 26px;
  padding: 3px 8px;
  font-size: 0.86rem;
  font-weight: 720;
}

.selection {
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.handicap {
  justify-content: center;
  color: #4a5364;
  font-size: 0.8rem;
}

.price {
  justify-content: flex-end;
  font-weight: 780;
}

.turnover {
  position: relative;
  min-width: 0;
  justify-content: flex-end;
  overflow: hidden;
  font-size: 0.78rem;
}

.turnover i {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  background: rgba(26, 140, 211, 0.18);
}

.turnover b {
  position: relative;
  font-weight: 740;
  color: #1a2233;
}

.euro-row {
  display: grid;
  grid-template-columns: auto repeat(3, minmax(0, 1fr));
  gap: 6px;
  align-items: center;
  padding: 4px 9px;
  background: #fff8e3;
  border-bottom: 1px solid #fce4a8;
  color: #8a6212;
  font-size: 0.74rem;
  font-weight: 740;
}

.euro-label {
  padding: 1px 5px;
  border-radius: 2px;
  background: #c8a64b;
  color: #fff;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.euro-cell {
  text-align: center;
  font-weight: 780;
  color: #4a5364;
}

.index-row {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  background: #fff;
  color: #4a5364;
  font-size: 0.74rem;
  font-weight: 720;
}

.index-row svg {
  flex: 0 0 auto;
  margin-left: auto;
  color: #1a8cd3;
}

@media (max-width: 370px) {
  .market-grid {
    grid-template-columns: minmax(72px, 1fr) 42px minmax(70px, 0.85fr);
  }

  .cell {
    padding-inline: 6px;
    font-size: 0.82rem;
  }
}
</style>
