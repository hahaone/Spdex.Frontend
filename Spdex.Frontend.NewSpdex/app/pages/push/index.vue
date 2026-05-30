<script setup lang="ts">
import { Bell, BellOff, ChevronRight, Flame, RefreshCw } from '@lucide/vue'

const { signals, pending, refresh } = useSignals(50)

// 桌面通知权限
const notifyPerm = ref<NotificationPermission | 'unsupported'>('unsupported')
const seenSignalIds = useState<Set<string>>('push_seen_signal_ids', () => new Set())

onMounted(() => {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    notifyPerm.value = 'unsupported'
    return
  }
  notifyPerm.value = Notification.permission

  // 初始化 seen 集合，避免首次加载时弹通知
  if (signals.value.length > 0 && seenSignalIds.value.size === 0) {
    signals.value.forEach(s => seenSignalIds.value.add(s.signalId))
  }
})

async function requestPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  const result = await Notification.requestPermission()
  notifyPerm.value = result
}

// 新信号到达时弹桌面通知
watch(signals, (current) => {
  if (notifyPerm.value !== 'granted') {
    // 即使没权限也要更新 seen 集合
    current.forEach(s => seenSignalIds.value.add(s.signalId))
    return
  }
  const newcomers = current.filter(s => !seenSignalIds.value.has(s.signalId))
  for (const s of newcomers.slice(0, 3)) {  // 一次最多 3 条
    try {
      new Notification(`${s.modelName}：${s.homeTeam} vs ${s.awayTeam}`, {
        body: `状态 ${s.status}，触发 ×${s.triggerCount}`,
        tag: `signal-${s.signalId}`,
      })
    }
    catch {
      // 浏览器可能限制，忽略
    }
    seenSignalIds.value.add(s.signalId)
  }
}, { deep: false })

function formatTime(iso: string): string {
  if (!iso) return ''
  const idx = iso.indexOf('T')
  if (idx < 0) return iso
  return iso.slice(idx + 1, idx + 6)
}

const permLabel = computed(() => {
  switch (notifyPerm.value) {
    case 'granted': return '通知已开启'
    case 'denied': return '通知已拒绝（请到浏览器设置开启）'
    case 'default': return '未开启桌面通知'
    case 'unsupported': return '当前浏览器不支持通知'
    default: return ''
  }
})
</script>

<template>
  <section class="push-page">
    <div class="page-head">
      <div class="head-info">
        <h1>
          <Bell :size="16" />
          <span>推送</span>
        </h1>
        <span class="muted num">{{ signals.length }} 条最新信号</span>
      </div>
      <button class="refresh-btn focus-ring" :disabled="pending" @click="refresh()">
        <RefreshCw :size="14" :class="{ spinning: pending }" />
      </button>
    </div>

    <div class="perm-banner" :class="{ active: notifyPerm === 'granted', denied: notifyPerm === 'denied' }">
      <component :is="notifyPerm === 'granted' ? Bell : BellOff" :size="14" />
      <span>{{ permLabel }}</span>
      <button v-if="notifyPerm === 'default'" class="perm-btn focus-ring" type="button" @click="requestPermission">
        开启桌面通知
      </button>
    </div>

    <div v-if="pending && !signals.length" class="empty">加载中…</div>
    <div v-else-if="!signals.length" class="empty">
      <Flame :size="20" />
      <p>暂无活跃信号</p>
      <span class="muted">信号系统每 30s 扫描一次，新触发将自动推送到这里</span>
    </div>

    <section v-else class="signal-stream">
      <NuxtLink
        v-for="s in signals"
        :key="s.signalId"
        :to="`/football/${s.eventId}`"
        class="signal-card focus-ring"
      >
        <div class="card-head">
          <span class="model">{{ s.modelName }}</span>
          <span class="trig num">{{ formatTime(s.triggeredAt) }}</span>
        </div>
        <div class="card-body">
          <b>{{ s.homeTeam }} vs {{ s.awayTeam }}</b>
        </div>
        <div class="card-foot">
          <span class="status-tag" :class="{ exec: s.status === 'Executable', cond: s.status === 'Conditional' }">{{ s.status }}</span>
          <span v-if="s.triggerCount > 1" class="trig-cnt num">×{{ s.triggerCount }}</span>
          <ChevronRight :size="13" class="chev" />
        </div>
      </NuxtLink>
    </section>
  </section>
</template>

<style scoped>
.push-page {
  display: grid;
  gap: 9px;
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
  color: var(--brand);
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

.spinning { animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.perm-banner {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 6px 9px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: #f9fafc;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 720;
}

.perm-banner.active {
  border-color: var(--sell);
  background: #e9f7ef;
  color: var(--sell);
}

.perm-banner.denied {
  border-color: var(--buy);
  background: #fde0e7;
  color: #b1253c;
}

.perm-btn {
  margin-left: auto;
  padding: 3px 9px;
  border: 1px solid var(--brand);
  border-radius: 3px;
  background: var(--brand);
  color: #fff;
  font-size: 0.74rem;
  font-weight: 800;
}

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

.signal-stream {
  display: grid;
  gap: 6px;
}

.signal-card {
  display: grid;
  gap: 3px;
  padding: 8px 11px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
  color: var(--ink);
  text-decoration: none;
}

.card-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 0.74rem;
  font-weight: 740;
}

.model {
  padding: 1px 6px;
  border-radius: 2px;
  background: #fde0e7;
  color: #b1253c;
  font-weight: 800;
}

.trig {
  color: var(--muted);
}

.card-body b {
  display: block;
  margin: 2px 0;
  font-size: 0.92rem;
  font-weight: 780;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-foot {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.72rem;
  font-weight: 720;
}

.status-tag {
  padding: 1px 6px;
  border-radius: 2px;
  background: var(--canvas);
  color: var(--muted);
  font-weight: 800;
}

.status-tag.exec {
  background: var(--draw-bg);
  color: var(--sell);
}

.status-tag.cond {
  background: var(--away-bg);
  color: #8a6212;
}

.trig-cnt {
  padding: 0 5px;
  border-radius: 2px;
  background: #fde0e7;
  color: #b1253c;
  font-weight: 800;
}

.chev {
  margin-left: auto;
  color: var(--brand);
}
</style>
