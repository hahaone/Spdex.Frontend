<script setup lang="ts">
import { ArrowLeft, BarChart3, Lock } from '@lucide/vue'

const route = useRoute()
const eventId = computed(() => Number(route.params.eventId))

const { detail, euroOdds } = useMatchDetail(eventId)
const { snapshot } = useLiveSnapshot(eventId)

const match = computed(() => detail.value?.match)

function eventTone(type: string): string {
  if (type === 'goal') return 'goal'
  if (type === 'red') return 'red'
  return 'yellow'
}

const homeCards = computed(() => snapshot.value?.cardBadges.filter(b => b.side === 'home') ?? [])
const awayCards = computed(() => snapshot.value?.cardBadges.filter(b => b.side === 'away') ?? [])

const statusLabel = computed(() => {
  const s = snapshot.value?.status
  if (s === 'upcoming') return '未开赛'
  if (s === 'finished') return '已完场'
  return '进行中'
})

const liveDataPending = computed(() => snapshot.value?.dataStatus === 'pending')

// 价格面板：从 useMatchDetail 的 3 个 section 提取主/平/客
const oddsPanel = computed(() => {
  const d = detail.value
  if (!d) return []
  const rows: Array<{ market: string, home: string, drawOrLine: string, away: string }> = []
  if (d.standard.length) {
    const [h, dr, a] = [d.standard[0]?.price, d.standard[1]?.price, d.standard[2]?.price]
    rows.push({ market: '标盘 1X2', home: h ?? '-', drawOrLine: dr ?? '-', away: a ?? '-' })
  }
  if (d.handicap.length) {
    const note = d.handicap[1]?.price || match.value?.handicap || '-'
    rows.push({ market: '让分', home: d.handicap[0]?.price ?? '-', drawOrLine: note, away: d.handicap[2]?.price ?? '-' })
  }
  if (d.goals.length) {
    const line = d.goals[1]?.price || '2.5'
    rows.push({ market: '大小', home: d.goals[0]?.price ?? '-', drawOrLine: line, away: d.goals[2]?.price ?? '-' })
  }
  return rows
})

// 价格比较：从富欧赔 1x2 盘口的即时赔率取（主/平/客 = cur[0..2]）
const priceCompare = computed(() => {
  const m = euroOdds.value?.markets?.find(x => x.key === '1x2')
  if (!m) return []
  return m.rows.map(r => ({
    book: r.name,
    home: (r.cur[0] ?? 0).toFixed(2),
    draw: (r.cur[1] ?? 0).toFixed(2),
    away: (r.cur[2] ?? 0).toFixed(2),
  }))
})
</script>

<template>
  <div class="live-detail">
    <section class="header">
      <NuxtLink to="/live" class="back focus-ring">
        <ArrowLeft :size="15" />
        <span>返回实时</span>
      </NuxtLink>
      <div class="league-line">
        <span v-if="match?.leagueCode" class="code">{{ match.leagueCode }}</span>
        <span>{{ match?.leagueName ?? '—' }}</span>
        <span class="status-pill">{{ statusLabel }}</span>
        <span class="minute num">{{ snapshot?.minute ?? '—' }}</span>
      </div>
      <div class="score-line">
        <span class="team home">{{ match?.homeTeam ?? '主队' }}</span>
        <b class="score-block">
          <span class="num">{{ snapshot?.score[0] ?? 0 }}</span>
          <span class="colon">:</span>
          <span class="num">{{ snapshot?.score[1] ?? 0 }}</span>
        </b>
        <span class="team away">{{ match?.awayTeam ?? '客队' }}</span>
      </div>
      <div class="micro-row">
        <span class="cluster">
          <span v-for="c in homeCards" :key="`h-${c.color}`" :class="['card-badge', c.color]">{{ c.count }}</span>
          <span class="num">角 {{ snapshot?.corners[0] ?? 0 }}</span>
        </span>
        <span class="half num">{{ snapshot?.halfScore ?? '-' }}</span>
        <span class="cluster">
          <span class="num">{{ snapshot?.corners[1] ?? 0 }} 角</span>
          <span v-for="c in awayCards" :key="`a-${c.color}`" :class="['card-badge', c.color]">{{ c.count }}</span>
        </span>
      </div>
    </section>

    <section class="venue-scroll scrollbar-none">
      <span class="venue-chip">场地 待接入</span>
      <span class="venue-chip">主教练 待接入</span>
      <span class="venue-chip">裁判 待接入</span>
      <span class="venue-chip">轮次 待接入</span>
      <span class="venue-chip">排名 待接入</span>
    </section>

    <div class="content-grid">
    <section class="timeline">
      <div class="section-title">
        <span>事件时间线</span>
        <span v-if="liveDataPending" class="pending-pill">
          <Lock :size="11" /> 待接入
        </span>
      </div>
      <div v-if="snapshot?.events.length" class="timeline-grid">
        <div
          v-for="event in snapshot.events"
          :key="`${event.minute}-${event.text}`"
          :class="['event-row', event.side, eventTone(event.type)]"
        >
          <span class="minute num">{{ event.minute }}</span>
          <b>{{ event.text }}</b>
        </div>
      </div>
      <div v-else class="empty-section">
        {{ liveDataPending ? '事件时间线待 stage 3.5 接入 BetsAPI 后填充' : '暂无事件' }}
      </div>
    </section>

    <section class="stats">
      <div class="section-title">
        <span>双红指标 / 轻量化 xG</span>
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
        {{ liveDataPending ? 'xG / 射门数据待 stage 3.5 接入 BetsAPI 后填充' : '暂无统计' }}
      </div>
    </section>

    <section class="odds">
      <div class="section-title brand">
        <span>价格面板</span>
      </div>
      <div class="odds-grid">
        <div v-for="item in oddsPanel" :key="item.market" class="odds-row">
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
  background: #f9fafc;
  color: var(--muted);
  text-align: center;
  font-size: 0.78rem;
  font-weight: 720;
}

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
  color: var(--brand);
}

.score-block .num:last-child {
  color: var(--buy);
}

.colon {
  color: var(--soft);
  font-size: 1.1rem;
}

.micro-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 720;
}

.cluster {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.half {
  padding: 1px 7px;
  border-radius: 3px;
  background: #1a2233;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 760;
}

.card-badge {
  display: inline-grid;
  min-width: 17px;
  height: 17px;
  place-items: center;
  border-radius: 2px;
  color: #fff;
  font-size: 0.66rem;
  font-weight: 760;
}

.card-badge.red {
  background: var(--buy);
}

.card-badge.yellow {
  background: #d5b300;
  color: var(--ink);
}

.venue-scroll {
  display: flex;
  overflow-x: auto;
  gap: 6px;
  padding: 7px 10px;
  background: var(--panel);
  border-bottom: 1px solid var(--divider);
}

.venue-chip {
  flex: 0 0 auto;
  padding: 4px 8px;
  border: 1px solid var(--line);
  border-radius: 3px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 720;
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
  background: rgba(26, 140, 211, 0.14);
  color: var(--brand-deep);
}

.timeline-grid,
.stats-grid,
.odds-grid,
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
  background: #f3f9ff;
}

.event-row.away {
  background: #fffbf0;
}

.event-row .minute {
  font-weight: 800;
  color: var(--brand);
}

.event-row.away .minute {
  grid-column: 2;
  color: #b08113;
}

.event-row.away b {
  grid-column: 1;
  grid-row: 1;
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

@media (min-width: 1024px) {
  .live-detail {
    padding: 16px 0;
    gap: 12px;
  }

  .header,
  .venue-scroll {
    border: 1px solid var(--line);
    border-radius: 6px;
  }

  .header {
    padding: 16px 20px;
  }

  .score-block {
    font-size: 1.8rem;
  }

  .team {
    font-size: 1.2rem;
  }

  .content-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 14px;
    align-items: start;
  }

  section.timeline,
  section.stats,
  section.odds,
  section.compare {
    border-radius: 6px;
    border: 1px solid var(--line);
  }

  section.timeline {
    grid-row: span 2;
  }
}
</style>
