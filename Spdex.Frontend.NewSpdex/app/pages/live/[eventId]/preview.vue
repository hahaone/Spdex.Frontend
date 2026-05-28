<script setup lang="ts">
import { ArrowLeft, Clock } from '@lucide/vue'
import { upcomingDetail } from '~/data/mockPrototype'

const kickOff = computed(() => upcomingDetail.match.matchTime.slice(11, 16))
const day = computed(() => upcomingDetail.match.matchTime.slice(0, 10))
</script>

<template>
  <div class="preview-detail">
    <section class="header">
      <NuxtLink to="/live" class="back focus-ring">
        <ArrowLeft :size="15" />
        <span>返回实时</span>
      </NuxtLink>
      <div class="league-line">
        <span class="code">{{ upcomingDetail.match.leagueCode }}</span>
        <span>{{ upcomingDetail.match.leagueName }}</span>
        <span class="status-tag">未开赛</span>
      </div>
      <div class="vs-line">
        <span class="team home">{{ upcomingDetail.match.homeTeam }}</span>
        <b class="vs">VS</b>
        <span class="team away">{{ upcomingDetail.match.awayTeam }}</span>
      </div>
      <div class="micro-row">
        <Clock :size="13" />
        <span class="num">{{ day }}</span>
        <b class="num">{{ kickOff }}</b>
      </div>
    </section>

    <section class="venue-scroll scrollbar-none">
      <span v-for="item in upcomingDetail.venue" :key="item.label" class="venue-chip">
        <b>{{ item.label }}</b>
        <span>{{ item.value }}</span>
      </span>
    </section>

    <section class="odds">
      <div class="section-title brand">
        <span>价格面板</span>
        <span class="hint">更新到临场 · Bet365</span>
      </div>
      <div class="odds-grid">
        <div v-for="item in upcomingDetail.oddsPanel" :key="item.market" class="odds-row">
          <b class="lbl">{{ item.market }}</b>
          <span class="num">主 {{ item.home }}</span>
          <span class="num line">{{ item.drawOrLine }}</span>
          <span class="num">客 {{ item.away }}</span>
        </div>
      </div>
    </section>

    <section class="compare">
      <div class="section-title brand">
        <span>价格比较</span>
        <span class="book-count num">主流平台数 12</span>
      </div>
      <div class="compare-grid">
        <div v-for="book in upcomingDetail.priceCompare" :key="book.book" class="compare-row">
          <b class="book">{{ book.book }}</b>
          <span class="num">主 {{ book.home }}</span>
          <span class="num">平 {{ book.draw }}</span>
          <span class="num">客 {{ book.away }}</span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.preview-detail {
  display: grid;
}

.header {
  display: grid;
  gap: 7px;
  padding: 8px 12px 10px;
  background: linear-gradient(180deg, #ffffff 0%, #f7fafd 100%);
  border-bottom: 1px solid #eaeef4;
}

.back {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 4px;
  color: #1a8cd3;
  font-size: 0.78rem;
  font-weight: 740;
}

.league-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 760;
  color: #1a2233;
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

.status-tag {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(26, 140, 211, 0.16);
  color: #1672b3;
  font-size: 0.7rem;
  font-weight: 760;
}

.vs-line {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 10px;
  text-align: center;
}

.vs-line .team {
  min-width: 0;
  overflow: hidden;
  font-size: 1.04rem;
  font-weight: 820;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.vs-line .vs {
  padding: 2px 9px;
  border-radius: 3px;
  background: #6e5aaf;
  color: #fff;
  font-size: 0.84rem;
  font-weight: 800;
  letter-spacing: 0.04em;
}

.micro-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  color: #4a5364;
  font-size: 0.78rem;
  font-weight: 720;
}

.micro-row b {
  color: #1a8cd3;
  font-size: 0.92rem;
  font-weight: 820;
}

.venue-scroll {
  display: flex;
  overflow-x: auto;
  gap: 6px;
  padding: 7px 10px;
  background: #fff;
  border-bottom: 1px solid #eaeef4;
}

.venue-chip {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: baseline;
  gap: 4px;
  padding: 4px 8px;
  border: 1px solid #dde2eb;
  border-radius: 3px;
  background: #f7fafd;
  color: #1a2233;
  font-size: 0.74rem;
  font-weight: 740;
}

.venue-chip b {
  color: #6b7280;
  font-size: 0.7rem;
  font-weight: 740;
}

section.odds,
section.compare {
  padding: 8px 10px;
  background: #fff;
  border-bottom: 1px solid #eaeef4;
}

.section-title {
  margin-bottom: 6px;
}

.hint {
  font-weight: 720;
  font-size: 0.7rem;
  opacity: 0.85;
}

.odds-grid,
.compare-grid {
  display: grid;
  gap: 1px;
  background: #eaeef4;
  border: 1px solid #eaeef4;
  border-radius: 4px;
  overflow: hidden;
}

.odds-row,
.compare-row {
  display: grid;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: #fff;
  font-size: 0.78rem;
}

.odds-row {
  grid-template-columns: 60px repeat(3, minmax(0, 1fr));
}

.odds-row .lbl {
  font-weight: 800;
  color: #4f3f86;
  font-size: 0.76rem;
}

.odds-row .num {
  text-align: center;
  font-weight: 740;
}

.odds-row .num.line {
  color: #1672b3;
}

.compare-row {
  grid-template-columns: 70px repeat(3, minmax(0, 1fr));
}

.compare-row .book {
  font-weight: 800;
  color: #1a2233;
  font-size: 0.78rem;
}

.compare-row .num {
  text-align: center;
  font-weight: 740;
  color: #1a2233;
}

.book-count {
  font-weight: 720;
  font-size: 0.72rem;
  opacity: 0.85;
}

@media (max-width: 370px) {
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
</style>
