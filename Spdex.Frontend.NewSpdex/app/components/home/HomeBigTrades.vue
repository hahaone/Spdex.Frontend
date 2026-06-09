<script setup lang="ts">
/** 首页模块「🔥 大单」：必发最大现场单跑马灯。无数据时不渲染。 */
const { bigTradesTicker } = useDashboardMetrics()

function tickerSideClass(selection: string): string {
  if (selection.includes('主')) return 'side-home'
  if (selection.includes('客')) return 'side-away'
  if (selection.includes('平')) return 'side-draw'
  return 'side-mute'
}
</script>

<template>
  <section v-if="bigTradesTicker.length" class="ticker-band">
    <span class="ticker-label">🔥 大单</span>
    <div class="ticker-scroll scrollbar-none">
      <NuxtLink
        v-for="t in bigTradesTicker"
        :key="`${t.eventId}-${t.timeText}`"
        :to="`/football/${t.eventId}`"
        :class="['ticker-item', tickerSideClass(t.selection)]"
        :title="`${t.league ? t.league + ' · ' : ''}${t.homeTeam} vs ${t.awayTeam} ${t.attr}`"
      >
        <span class="t-match">
          <span v-if="t.league" class="t-league">{{ t.league }}</span>
          <span class="t-teams">{{ t.homeTeam }} <i>vs</i> {{ t.awayTeam }}</span>
        </span>
        <span class="t-bet">
          <span class="t-amount num">{{ t.amountText }}</span>
          <span class="t-side">{{ t.selection }}</span>
          <span class="t-odds num">@{{ t.odds.toFixed(2) }}</span>
          <span class="t-time num">{{ t.timeText }}</span>
        </span>
      </NuxtLink>
    </div>
  </section>
</template>

<style scoped>
.ticker-band {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  background: var(--away-bg);
  border: 1px solid var(--away-strong);
  border-radius: 6px;
}

.ticker-label {
  padding: 1px 6px;
  border-radius: 2px;
  background: #c46613;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.ticker-scroll {
  display: flex;
  overflow-x: auto;
  gap: 6px;
}

.ticker-item {
  display: inline-flex;
  flex: 0 0 auto;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  padding: 5px 9px;
  border: 1px solid transparent;
  border-radius: 5px;
  font-size: 0.72rem;
  font-weight: 760;
  text-decoration: none;
  white-space: nowrap;
}

.ticker-item.side-home { background: var(--brand-tint); color: var(--brand-deep); border-color: var(--brand-tint-strong); }
.ticker-item.side-away { background: var(--away-bg); color: var(--warn); border-color: var(--away-strong); }
.ticker-item.side-draw { background: var(--canvas); color: var(--muted); border-color: var(--line); }
.ticker-item.side-mute { background: var(--surface); color: var(--muted); border-color: var(--line); }

/* 第一行：联赛 + 球队（中文，显示全） */
.t-match {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.t-league {
  flex: 0 0 auto;
  padding: 0 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.55);
  font-size: 0.64rem;
  font-weight: 800;
}

.t-teams {
  font-size: 0.75rem;
  font-weight: 820;
}

.t-teams i {
  font-style: normal;
  font-weight: 600;
  opacity: 0.5;
  padding: 0 2px;
}

/* 第二行：金额 + 方向 + 赔率 + 时间 */
.t-bet {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.t-amount { font-weight: 820; }
.t-side { padding: 0 4px; border-radius: 2px; background: rgba(255, 255, 255, 0.6); font-weight: 800; }
.t-odds { opacity: 0.86; }
.t-time { opacity: 0.7; font-size: 0.68rem; }

/* #2 宽屏:大单从单行横向跑马灯改 3 列网格 + 纵向滚动,便于查看全部(仅宽屏 ≥1200px;窄屏维持横向跑马灯)。 */
@media (min-width: 1200px) {
  .ticker-band {
    align-items: start;
  }

  .ticker-scroll {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    grid-auto-rows: 46px;
    gap: 6px;
    overflow-x: hidden;
    overflow-y: auto;
    /* 只显 3 行(高度与右侧「快速入口」看齐),其余可滚动:3×46 + 2×6 gap = 150。 */
    max-height: 150px;
  }

  .ticker-item {
    overflow: hidden;
  }
}
</style>
