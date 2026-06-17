<script setup lang="ts">
import { Lock } from '@lucide/vue'
import { useInnerOuter } from '~/composables/useInnerOuter'

const props = defineProps<{ eventId: number }>()

const { data, pending } = useInnerOuter(computed(() => props.eventId))

const locked = computed(() => data.value?.accessLocked === true)

// ── 内盘/外盘金额(主/平/客 切换)──
const sideLabels = ['主胜', '平局', '客胜']
const tab = ref(0)
const inner = computed(() => data.value?.innerAmount?.[tab.value] ?? 0)
const outer = computed(() => data.value?.outerAmount?.[tab.value] ?? 0)

const IO_COLORS = ['#e8845c', '#6a9fe0'] // 内=橙, 外=蓝
const ioGradient = computed(() => pieGradient([inner.value, outer.value], IO_COLORS))
const ioLabels = computed(() => pieLabels([inner.value, outer.value], ['内', '外']))

// ── 核心交易时段 ──
const TIME_COLORS = ['#e8845c', '#e6b84d', '#6a9fe0', '#5cb88a']
const TIME_LABELS = ['临1', '临1-6', '临6-24', '临24']
const preVals = computed(() => {
  const d = data.value
  return d ? [d.pre1, d.pre6, d.pre24, d.pre48].map(v => Math.max(0, v)) : [0, 0, 0, 0]
})
const timeGradient = computed(() => pieGradient(preVals.value, TIME_COLORS))
const timeLabels = computed(() => pieLabels(preVals.value, TIME_LABELS))

// ── 饼图(conic-gradient + 居中标签)──
function pieGradient(values: number[], colors: string[]): string {
  const total = values.reduce((a, b) => a + b, 0)
  if (total <= 0) return 'conic-gradient(#e5e7eb 0 100%)'
  let acc = 0
  const stops: string[] = []
  values.forEach((v, i) => {
    if (v <= 0) return
    const start = (acc / total) * 100
    acc += v
    const end = (acc / total) * 100
    stops.push(`${colors[i]} ${start}% ${end}%`)
  })
  return `conic-gradient(${stops.join(', ')})`
}
function pieLabels(values: number[], labels: string[]) {
  const total = values.reduce((a, b) => a + b, 0)
  if (total <= 0) return [] as { label: string, pct: number, left: number, top: number }[]
  let acc = 0
  const rr = 0.6
  const out: { label: string, pct: number, left: number, top: number }[] = []
  values.forEach((v, i) => {
    if (v <= 0) return
    const mid = (acc + v / 2) / total
    acc += v
    const ang = mid * 2 * Math.PI
    out.push({
      label: labels[i] ?? '',
      pct: (v / total) * 100,
      left: 50 + rr * 50 * Math.sin(ang),
      top: 50 - rr * 50 * Math.cos(ang),
    })
  })
  return out
}

function fmtAmt(n: number): string {
  return Math.round(n).toLocaleString('en-US')
}
function fmtPay(n: number): string {
  return Math.round(n).toString()
}
function fmtPct(n: number): string {
  return `${n.toFixed(2)}%`
}
function plCls(v: number): string {
  return v < 0 ? 'neg' : ''
}
</script>

<template>
  <div class="io-panel">
    <div v-if="locked" class="io-locked">
      <Lock :size="14" />
      <span>{{ data?.lockMessage || '内外盘明细未对当前会籍开放' }}</span>
    </div>

    <div v-else-if="!data && pending" class="io-empty">加载中…</div>

    <div v-else-if="!data || !data.hasData" class="io-empty">本场暂无内外盘数据</div>

    <template v-else>
      <!-- 内盘/外盘金额 -->
      <section class="io-sec">
        <header class="io-head">
          <h4>内盘/外盘</h4>
          <div class="io-tabs">
            <button
              v-for="(s, i) in sideLabels"
              :key="i"
              type="button"
              :class="['io-tab', { active: tab === i }]"
              @click="tab = i"
            >{{ s }}</button>
          </div>
        </header>
        <div class="io-body">
          <div class="io-nums">
            <div class="io-num"><span class="dot inner" />内：<b>{{ fmtAmt(inner) }}</b></div>
            <div class="io-num"><span class="dot outer" />外：<b>{{ fmtAmt(outer) }}</b></div>
          </div>
          <div class="io-pie" :style="{ background: ioGradient }">
            <span
              v-for="(l, i) in ioLabels"
              :key="i"
              class="io-pie-lb"
              :style="{ left: `${l.left}%`, top: `${l.top}%` }"
            ><b>{{ l.pct.toFixed(1) }}%</b><i>{{ l.label }}</i></span>
          </div>
        </div>
      </section>

      <!-- 内盘/外盘模拟盈亏 -->
      <section class="io-sec">
        <header class="io-head"><h4>内盘/外盘模拟盈亏</h4></header>
        <table class="io-pl">
          <tbody>
            <tr>
              <th>内盘</th>
              <td v-for="(v, i) in data.innerPayout" :key="i" :class="plCls(v)">{{ fmtPay(v) }}</td>
            </tr>
            <tr>
              <th>外盘</th>
              <td v-for="(v, i) in data.outerPayout" :key="i" :class="plCls(v)">{{ fmtPay(v) }}</td>
            </tr>
          </tbody>
        </table>
      </section>

      <!-- 核心交易时段 -->
      <section class="io-sec">
        <header class="io-head"><h4>核心交易时段</h4></header>
        <div class="io-body">
          <ul class="io-time">
            <li><span>临场1小时</span><b>{{ fmtPct(data.pre1) }}</b></li>
            <li><span>临场1-6小时</span><b>{{ fmtPct(data.pre6) }}</b></li>
            <li><span>临场6-24小时</span><b>{{ fmtPct(data.pre24) }}</b></li>
            <li><span>临场24小时</span><b>{{ fmtPct(data.pre48) }}</b></li>
          </ul>
          <div class="io-pie" :style="{ background: timeGradient }">
            <span
              v-for="(l, i) in timeLabels"
              :key="i"
              class="io-pie-lb sm"
              :style="{ left: `${l.left}%`, top: `${l.top}%` }"
            ><i>{{ l.label }}</i></span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.io-panel {
  display: grid;
  gap: 10px;
  color: var(--ink, #1a2233);
}

.io-locked,
.io-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 22px 10px;
  color: var(--muted, #8a94a6);
  font-size: 0.78rem;
}

.io-sec {
  border: 1px solid var(--line, #e3e8f0);
  border-radius: 6px;
  background: var(--panel, #fff);
  overflow: hidden;
}

.io-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--divider, #eef1f6);
  background: var(--surface, #f7f9fc);
}

.io-head h4 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 820;
}

.io-tabs {
  display: inline-flex;
  border: 1px solid var(--line, #e3e8f0);
  border-radius: 6px;
  overflow: hidden;
}

.io-tab {
  padding: 3px 10px;
  border: 0;
  background: var(--panel, #fff);
  color: var(--muted, #8a94a6);
  font-size: 0.74rem;
  font-weight: 760;
  cursor: pointer;
}

.io-tab + .io-tab {
  border-left: 1px solid var(--line, #e3e8f0);
}

.io-tab.active {
  background: var(--brand, #7c5cfa);
  color: #fff;
}

.io-body {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 14px;
}

.io-nums {
  display: grid;
  gap: 10px;
}

.io-num {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.84rem;
  font-weight: 700;
  color: var(--muted, #8a94a6);
}

.io-num b {
  font-size: 1.35rem;
  font-weight: 860;
  color: var(--brand-deep, #5a3fd6);
  font-variant-numeric: tabular-nums;
}

.io-num .dot {
  width: 9px;
  height: 9px;
  border-radius: 2px;
  flex: 0 0 auto;
}

.io-num .dot.inner { background: #e8845c; }
.io-num .dot.outer { background: #6a9fe0; }

/* 饼图 */
.io-pie {
  position: relative;
  width: 128px;
  height: 128px;
  flex: 0 0 auto;
  border-radius: 50%;
}

.io-pie-lb {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  line-height: 1.1;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.28);
  pointer-events: none;
}

.io-pie-lb b {
  font-size: 0.78rem;
  font-weight: 840;
  font-variant-numeric: tabular-nums;
}

.io-pie-lb i {
  font-style: normal;
  font-size: 0.66rem;
  font-weight: 760;
}

.io-pie-lb.sm i {
  font-size: 0.62rem;
}

/* 模拟盈亏表 */
.io-pl {
  width: 100%;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

.io-pl th {
  width: 22%;
  padding: 10px 8px;
  text-align: center;
  font-size: 0.92rem;
  font-weight: 820;
  color: var(--muted, #8a94a6);
  border-right: 1px solid var(--divider, #eef1f6);
}

.io-pl tr + tr th,
.io-pl tr + tr td {
  border-top: 1px solid var(--divider, #eef1f6);
}

.io-pl td {
  padding: 10px 8px;
  text-align: center;
  font-size: 0.92rem;
  font-weight: 760;
  color: var(--ink, #1a2233);
}

.io-pl td.neg {
  color: var(--down, #d2483f);
}

/* 核心交易时段 */
.io-time {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
  min-width: 0;
}

.io-time li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  font-size: 0.82rem;
  font-weight: 720;
  color: var(--muted, #8a94a6);
}

.io-time b {
  color: var(--brand-deep, #5a3fd6);
  font-weight: 820;
  font-variant-numeric: tabular-nums;
}
</style>
