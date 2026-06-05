<script setup lang="ts">
import { Activity, ChevronRight, Flame, RefreshCw } from '@lucide/vue'

const { signals, pending, refresh } = useSignals(100)

const grouped = computed(() => {
  const byModel = new Map<string, typeof signals.value>()
  for (const s of signals.value) {
    const list = byModel.get(s.modelName) ?? []
    list.push(s)
    byModel.set(s.modelName, list)
  }
  return Array.from(byModel.entries()).map(([model, items]) => ({ model, items }))
})

function statusTone(status: string): string {
  if (status === 'Executable') return 'tone-positive'
  if (status === 'Conditional') return 'tone-warm'
  return 'tone-mute'
}

function formatTime(iso: string): string {
  if (!iso) return ''
  // "2026-05-28T14:31:00.0000000Z" → "14:31"
  const idx = iso.indexOf('T')
  if (idx < 0) return iso
  return iso.slice(idx + 1, idx + 6)
}

function matchKick(iso: string): string {
  if (!iso) return ''
  return iso.slice(11, 16)
}
</script>

<template>
  <section class="signals-page">
    <div class="page-head">
      <div class="head-info">
        <h1>
          <Flame :size="16" />
          <span>实时信号</span>
        </h1>
        <span class="muted num">{{ signals.length }} 条活跃</span>
      </div>
      <button class="refresh-btn focus-ring" :disabled="pending" @click="refresh()">
        <RefreshCw :size="14" :class="{ spinning: pending }" />
      </button>
    </div>

    <div v-if="pending && !signals.length" class="loading" role="status">
      加载中…
    </div>
    <div v-else-if="!signals.length" class="empty" role="status">
      <Activity :size="20" />
      <p>当前无活跃信号</p>
      <span class="muted">信号系统每 30s 扫描一次未开赛比赛</span>
    </div>

    <section v-for="group in grouped" :key="group.model" class="model-band">
      <div class="model-head">
        <b>{{ group.model }}</b>
        <span class="muted num">{{ group.items.length }}</span>
      </div>

      <NuxtLink
        v-for="s in group.items"
        :key="s.signalId"
        :to="`/football/${s.eventId}`"
        class="signal-row focus-ring"
      >
        <div class="row-main">
          <span :class="['status-dot', statusTone(s.status)]" />
          <b class="teams">{{ s.homeTeam }} vs {{ s.awayTeam }}</b>
        </div>
        <div class="row-meta">
          <span class="kick num">开赛 {{ matchKick(s.matchTime) }}</span>
          <span class="dot">·</span>
          <span class="trigger num">触发 {{ formatTime(s.triggeredAt) }}</span>
          <span v-if="s.triggerCount > 1" class="trigger-count num">×{{ s.triggerCount }}</span>
          <span :class="['status-tag', statusTone(s.status)]">{{ s.status }}</span>
        </div>
        <ChevronRight :size="14" />
      </NuxtLink>
    </section>
  </section>
</template>

<style scoped>
.signals-page {
  display: grid;
  gap: 10px;
  padding: 12px 12px 16px;
}

.page-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 30px;
  align-items: center;
  gap: 10px;
}

.head-info {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.head-info h1 {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin: 0;
  color: #b1253c;
  font-size: 1rem;
  font-weight: 820;
}

.muted {
  color: var(--muted);
  font-size: 0.74rem;
  font-weight: 720;
}

.refresh-btn {
  display: inline-grid;
  min-height: 30px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--panel);
  color: var(--muted);
}

.spinning {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.loading,
.empty {
  display: grid;
  place-items: center;
  gap: 5px;
  padding: 32px 16px;
  text-align: center;
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 720;
  border: 1px dashed var(--line);
  border-radius: 5px;
  background: #f9fafc;
}

.empty p {
  margin: 4px 0 0;
  color: var(--ink);
  font-size: 0.92rem;
  font-weight: 800;
}

.model-band {
  display: grid;
  gap: 4px;
  padding: 8px 10px 9px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
}

.model-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  padding-bottom: 4px;
  border-bottom: 1px solid var(--divider);
}

.model-head b {
  font-size: 0.88rem;
  font-weight: 820;
  color: var(--ink);
}

.signal-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  color: var(--ink);
  text-decoration: none;
}

.row-main {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.status-dot {
  flex: 0 0 auto;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-dot.tone-positive { background: var(--sell); }
.status-dot.tone-warm { background: #c46613; }
.status-dot.tone-mute { background: var(--muted); }

.teams {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.86rem;
  font-weight: 760;
}

.row-meta {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  gap: 5px;
  padding-left: 13px;
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 720;
}

.dot {
  opacity: 0.5;
}

.trigger-count {
  padding: 0 5px;
  border-radius: 2px;
  background: #fde0e7;
  color: #b1253c;
  font-weight: 800;
}

.status-tag {
  margin-left: auto;
  padding: 1px 6px;
  border-radius: 2px;
  font-size: 0.68rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.status-tag.tone-positive { background: var(--draw-bg); color: var(--sell); }
.status-tag.tone-warm { background: var(--away-bg); color: #8a6212; }
.status-tag.tone-mute { background: var(--canvas); color: var(--muted); }

/* 桌面：信号流居中限宽，便于阅读 */
@media (min-width: 1024px) {
  .signals-page { max-width: var(--w-read); margin-inline: auto; }
}
</style>
