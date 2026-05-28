<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import type { LiveMatchSummary } from '~/types/live'

const props = defineProps<{
  match: LiveMatchSummary
}>()

const kickOff = computed(() => props.match.matchTime.slice(11, 16))
const day = computed(() => props.match.matchTime.slice(5, 10))
</script>

<template>
  <NuxtLink :to="`/live/${match.eventId}/preview`" class="upcoming-card focus-ring">
    <div class="upcoming-head">
      <span class="league">
        <span class="code">{{ match.leagueCode }}</span>
        <span class="name">{{ match.leagueName }}</span>
      </span>
      <span class="schedule">
        <span class="num">{{ day }}</span>
        <b class="num">{{ kickOff }}</b>
      </span>
    </div>

    <div class="vs-grid">
      <span class="team home">{{ match.homeTeam }}</span>
      <span class="vs">vs</span>
      <span class="team away">{{ match.awayTeam }}</span>
    </div>

    <div class="odds-grid">
      <span class="odds-row">
        <b class="lbl">标盘</b>
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

    <div class="foot">
      <span class="hint">临场更新 · Bet365</span>
      <ChevronRight :size="16" />
    </div>
  </NuxtLink>
</template>

<style scoped>
.upcoming-card {
  display: block;
  border: 1px solid #dde2eb;
  border-radius: 6px;
  background: #fff;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(26, 34, 51, 0.05);
}

.upcoming-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 5px 9px;
  background: linear-gradient(180deg, #f9fbfd 0%, #f3f6fb 100%);
  border-bottom: 1px solid #eaeef4;
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
  letter-spacing: 0.04em;
  line-height: 1.5;
}

.name {
  white-space: nowrap;
}

.schedule {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: baseline;
  gap: 5px;
  color: #4a5364;
  font-size: 0.76rem;
  font-weight: 720;
}

.schedule b {
  color: #1a8cd3;
  font-size: 0.9rem;
  font-weight: 820;
}

.vs-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 8px;
  padding: 7px 10px 4px;
  text-align: center;
}

.team {
  min-width: 0;
  overflow: hidden;
  font-size: 0.96rem;
  font-weight: 800;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.team.home {
  text-align: right;
}

.team.away {
  text-align: left;
}

.vs {
  color: #6b7280;
  font-size: 0.78rem;
  font-weight: 720;
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

.foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 9px;
  background: #fff;
  border-top: 1px solid #eaeef4;
}

.hint {
  color: #6b7280;
  font-size: 0.72rem;
  font-weight: 720;
}

.foot svg {
  color: #1a8cd3;
}
</style>
