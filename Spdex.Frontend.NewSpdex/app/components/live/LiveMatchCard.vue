<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import type { LiveMatchSummary } from '~/types/live'

const props = defineProps<{
  match: LiveMatchSummary
}>()

const homeCards = computed(() => props.match.cardBadges.filter(b => b.side === 'home'))
const awayCards = computed(() => props.match.cardBadges.filter(b => b.side === 'away'))
</script>

<template>
  <NuxtLink :to="`/live/${match.eventId}`" class="live-card focus-ring">
    <div class="live-head">
      <span class="league">
        <span class="code">{{ match.leagueCode }}</span>
        <span class="name">{{ match.leagueName }}</span>
      </span>
      <span v-if="match.topTrade" class="top-trade">
        <span class="trade-amt num">{{ match.topTrade.amountText }}</span>
        <span class="trade-meta">{{ match.topTrade.selection }} {{ match.topTrade.price }} {{ match.topTrade.state }}</span>
      </span>
    </div>

    <div class="score-grid">
      <span class="minute num">{{ match.minute }}</span>
      <span class="team home">{{ match.homeTeam }}</span>
      <b class="score num row-home-bg">{{ match.score[0] }}</b>
      <span class="model num">{{ match.models[0] || '—' }}</span>
      <span class="team away">{{ match.awayTeam }}</span>
      <b class="score num row-away-bg">{{ match.score[1] }}</b>
    </div>

    <div class="subline">
      <span class="side-cluster home">
        <span
          v-for="badge in homeCards"
          :key="`home-${badge.color}`"
          :class="['card-badge', badge.color]"
        >{{ badge.count }}</span>
        <span class="corner num">角 {{ match.corners[0] }}</span>
      </span>
      <span class="half num">{{ match.halfScore }}</span>
      <span class="side-cluster away">
        <span class="corner num">{{ match.corners[1] }} 角</span>
        <span
          v-for="badge in awayCards"
          :key="`away-${badge.color}`"
          :class="['card-badge', badge.color]"
        >{{ badge.count }}</span>
      </span>
      <span v-if="match.models.length" class="tag tag-double-red">{{ match.models.join(' · ') }}</span>
      <ChevronRight :size="16" />
    </div>

    <div class="odds-grid">
      <span class="odds-row">
        <b class="lbl">1X2</b>
        <span class="num">{{ match.liveOdds.oneXTwo[0] }}</span>
        <span class="num">{{ match.liveOdds.oneXTwo[1] }}</span>
        <span class="num">{{ match.liveOdds.oneXTwo[2] }}</span>
      </span>
      <span class="odds-row">
        <b class="lbl">让球</b>
        <span class="num">{{ match.liveOdds.handicap[0] }}</span>
        <span class="num line">{{ match.liveOdds.handicap[2] }}</span>
        <span class="num">{{ match.liveOdds.handicap[1] }}</span>
      </span>
      <span class="odds-row">
        <b class="lbl">大小</b>
        <span class="num">{{ match.liveOdds.total[0] }}</span>
        <span class="num line">{{ match.liveOdds.total[2] }}</span>
        <span class="num">{{ match.liveOdds.total[1] }}</span>
      </span>
    </div>
  </NuxtLink>
</template>

<style scoped>
.live-card {
  display: block;
  border: 1px solid #dde2eb;
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(26, 34, 51, 0.05);
}

.live-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 5px 9px;
  background: linear-gradient(180deg, #f9fbfd 0%, #f3f6fb 100%);
  border-bottom: 1px solid #eaeef4;
}

.league {
  display: inline-flex;
  flex: 0 0 auto;
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
  letter-spacing: 0.04em;
  line-height: 1.5;
}

.name {
  color: #1a2233;
  white-space: nowrap;
}

.top-trade {
  display: inline-flex;
  flex: 0 1 auto;
  min-width: 0;
  align-items: center;
  gap: 4px;
  padding: 1px 6px;
  border-radius: 3px;
  background: linear-gradient(180deg, #ffe6e6 0%, #fcd1d1 100%);
  color: #b1253c;
  font-size: 0.72rem;
  font-weight: 760;
  overflow: hidden;
}

.trade-amt {
  font-weight: 820;
}

.trade-meta {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score-grid {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) 30px;
  gap: 3px 7px;
  align-items: center;
  padding: 6px 9px 4px;
}

.minute {
  color: #b1253c;
  font-size: 0.82rem;
  font-weight: 820;
}

.team {
  min-width: 0;
  overflow: hidden;
  font-size: 0.92rem;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.score {
  text-align: center;
  font-size: 1.06rem;
  font-weight: 860;
  line-height: 1.1;
  border-radius: 3px;
}

.row-home-bg {
  background: #dceefd;
  color: #1a2233;
}

.row-away-bg {
  background: #fff4d8;
  color: #1a2233;
}

.model {
  color: #4f3f86;
  font-size: 0.78rem;
  font-weight: 720;
}

.subline {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 9px 5px;
  color: #4a5364;
  font-size: 0.74rem;
  font-weight: 720;
}

.subline svg {
  margin-left: auto;
  color: #1a8cd3;
}

.side-cluster {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.corner {
  color: #4a5364;
}

.half {
  padding: 0 4px;
  color: #1a2233;
  font-weight: 760;
}

.card-badge {
  display: inline-grid;
  min-width: 16px;
  height: 16px;
  place-items: center;
  border-radius: 2px;
  color: #fff;
  font-size: 0.66rem;
  font-weight: 760;
}

.card-badge.red {
  background: #d6324c;
}

.card-badge.yellow {
  background: #d5b300;
  color: #1a2233;
}

.odds-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 1px;
  background: #eaeef4;
  border-top: 1px solid #eaeef4;
}

.odds-row {
  display: grid;
  grid-template-columns: 28px repeat(3, minmax(0, 1fr));
  gap: 4px;
  align-items: center;
  padding: 4px 6px;
  background: #fff;
  font-size: 0.74rem;
  font-weight: 740;
  color: #1a2233;
}

.odds-row .lbl {
  color: #4f3f86;
  font-size: 0.7rem;
  font-weight: 800;
}

.odds-row .num {
  text-align: center;
}

.odds-row .num.line {
  color: #1672b3;
}
</style>
