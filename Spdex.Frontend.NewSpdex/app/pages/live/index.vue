<script setup lang="ts">
import { ChevronRight, RefreshCw } from '@lucide/vue'

const { matches, runningCount, pending, refresh } = useLiveList()

function homeYellow(m: typeof matches.value[number]): number {
  return m.cardBadges.find(b => b.side === 'home' && b.color === 'yellow')?.count ?? 0
}
function homeRed(m: typeof matches.value[number]): number {
  return m.cardBadges.find(b => b.side === 'home' && b.color === 'red')?.count ?? 0
}
function awayYellow(m: typeof matches.value[number]): number {
  return m.cardBadges.find(b => b.side === 'away' && b.color === 'yellow')?.count ?? 0
}
function awayRed(m: typeof matches.value[number]): number {
  return m.cardBadges.find(b => b.side === 'away' && b.color === 'red')?.count ?? 0
}
</script>

<template>
  <div class="live-page">
    <section class="live-filters">
      <div class="filter-head">
        <h2>实时赛事</h2>
        <span class="muted num">{{ runningCount }} 场进行中 · 30 秒自动刷新</span>
      </div>
      <div class="refresh-row">
        <button class="refresh-btn focus-ring" :disabled="pending" @click="refresh()">
          <RefreshCw :size="14" :class="{ spinning: pending }" />
        </button>
      </div>
    </section>

    <section class="live-list">
      <div v-if="pending && !matches.length" class="empty">加载中…</div>
      <div v-else-if="!matches.length" class="empty">当前无进行中赛事</div>

      <NuxtLink
        v-for="m in matches"
        :key="m.eventId"
        :to="`/live/${m.eventId}`"
        class="live-card focus-ring"
      >
        <div class="card-head">
          <span class="league">{{ m.leagueName }}</span>
          <span class="minute num">{{ m.minute }}</span>
        </div>

        <div class="card-body">
          <div class="row team home">
            <span class="name">{{ m.homeTeam }}</span>
            <span class="indicators">
              <span v-if="homeYellow(m) > 0" class="card-badge yellow num">Y{{ homeYellow(m) }}</span>
              <span v-if="homeRed(m) > 0" class="card-badge red num">R{{ homeRed(m) }}</span>
            </span>
            <b class="score num">{{ m.score[0] }}</b>
          </div>
          <div class="row team away">
            <span class="name">{{ m.awayTeam }}</span>
            <span class="indicators">
              <span v-if="awayYellow(m) > 0" class="card-badge yellow num">Y{{ awayYellow(m) }}</span>
              <span v-if="awayRed(m) > 0" class="card-badge red num">R{{ awayRed(m) }}</span>
            </span>
            <b class="score num">{{ m.score[1] }}</b>
          </div>
        </div>

        <div class="card-stats">
          <span class="stat">
            <span class="stat-label">角球</span>
            <span class="stat-val num">{{ m.corners[0] }}-{{ m.corners[1] }}</span>
          </span>
          <span v-if="m.stats" class="stat">
            <span class="stat-label">射门</span>
            <span class="stat-val num">{{ m.stats.shots.home }}-{{ m.stats.shots.away }}</span>
          </span>
          <span v-if="m.stats" class="stat">
            <span class="stat-label">控球%</span>
            <span class="stat-val num">{{ m.stats.xg.home }}-{{ m.stats.xg.away }}</span>
          </span>
          <ChevronRight :size="14" class="chevron" />
        </div>
      </NuxtLink>
    </section>
  </div>
</template>

<style scoped>
.live-page { display: grid; }

.live-filters {
  display: grid;
  gap: 6px;
  padding: 9px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
}

.filter-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}

.filter-head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 820;
}

.muted {
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 720;
}

.refresh-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

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

.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.live-list {
  display: grid;
  gap: 7px;
  padding: 9px 10px 16px;
}

.empty {
  padding: 30px 0;
  color: var(--muted);
  text-align: center;
  font-size: 0.84rem;
  font-weight: 720;
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

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.card-head .league {
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 740;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 70%;
}

.card-head .minute {
  padding: 1px 6px;
  border-radius: 2px;
  background: var(--buy);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 820;
  letter-spacing: 0.02em;
}

.card-body {
  display: grid;
  gap: 2px;
  padding: 3px 0;
  border-top: 1px solid var(--divider);
  border-bottom: 1px solid var(--divider);
}

.row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 0.92rem;
  font-weight: 760;
}

.name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.indicators {
  display: inline-flex;
  gap: 3px;
}

.card-badge {
  padding: 1px 5px;
  border-radius: 2px;
  font-size: 0.68rem;
  font-weight: 800;
}

.card-badge.yellow { background: var(--away-bg); color: #8a6212; }
.card-badge.red { background: #fde0e7; color: #b1253c; }

.score {
  min-width: 24px;
  text-align: right;
  font-size: 1rem;
  font-weight: 860;
}

.card-stats {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 3px;
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 720;
}

.stat {
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.stat-label { color: var(--muted); }
.stat-val { color: var(--ink); font-weight: 780; }

.chevron {
  margin-left: auto;
  color: var(--brand);
}

@media (min-width: 1024px) {
  .live-page {
    gap: 14px;
    padding: 16px 0;
  }

  .live-filters {
    gap: 10px;
    padding: 14px 16px;
    border: 1px solid var(--line);
    border-radius: 6px;
    box-shadow: 0 2px 8px rgba(26, 34, 51, 0.05);
  }

  .live-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    padding: 0;
  }
}

@media (min-width: 1280px) {
  .live-list {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .live-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
