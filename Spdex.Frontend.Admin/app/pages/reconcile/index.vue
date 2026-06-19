<template>
  <div>
    <div class="mb-4 flex items-center justify-between">
      <h2 class="text-xl font-semibold">订单对账</h2>
      <NSpace align="center">
        <NButton size="small" @click="quickRange(7)">近 7 天</NButton>
        <NButton size="small" @click="quickRange(30)">近 30 天</NButton>
        <NDatePicker v-model:value="range" type="daterange" :is-date-disabled="(ts: number) => ts > Date.now()" />
        <NSelect v-model:value="channel" :options="channelOpts" clearable placeholder="渠道" style="width:120px" />
        <NSelect v-model:value="productType" :options="typeOpts" clearable placeholder="类型" style="width:120px" />
        <NButton type="primary" :loading="loading" @click="load">对账</NButton>
      </NSpace>
    </div>

    <NSpin :show="loading">
      <!-- 指标卡 -->
      <NGrid :cols="6" :x-gap="12" responsive="screen" class="mb-4">
        <NGi><NCard size="small"><NStatistic label="已支付收入" :value="metrics ? `¥${money(metrics.paidAmount)}` : '—'" /></NCard></NGi>
        <NGi><NCard size="small"><NStatistic label="已支付订单" :value="metrics?.paidCount ?? '—'" /></NCard></NGi>
        <NGi><NCard size="small"><NStatistic label="退款额" :value="metrics ? `¥${money(metrics.refundAmount)}` : '—'"><template #prefix><span style="color:#d03050">-</span></template></NStatistic></NCard></NGi>
        <NGi><NCard size="small"><NStatistic label="净收入" :value="metrics ? `¥${money(metrics.netAmount)}` : '—'" /></NCard></NGi>
        <NGi><NCard size="small"><NStatistic label="待支付" :value="metrics?.pendingCount ?? '—'" /></NCard></NGi>
        <NGi><NCard size="small"><NStatistic label="异常订单" :value="metrics?.anomalyCount ?? '—'" /></NCard></NGi>
      </NGrid>

      <NGrid :cols="3" :x-gap="12" class="mb-4" responsive="screen" :item-responsive="true">
        <!-- 收入趋势 -->
        <NGi :span="2">
          <NCard size="small" title="已支付收入趋势（按天）">
            <div v-if="chart" class="rev-wrap">
              <div class="rev-head">
                <span class="rev-peak">峰值 ¥{{ money(chart.max) }}</span>
                <span class="rev-total">区间合计 ¥{{ money(chart.total) }}</span>
              </div>
              <svg class="rev-svg" :viewBox="`0 0 ${chart.W} ${chart.H}`" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="#7c5cfa" stop-opacity="0.32" />
                    <stop offset="100%" stop-color="#7c5cfa" stop-opacity="0" />
                  </linearGradient>
                </defs>
                <path :d="chart.area" fill="url(#revGrad)" />
                <path :d="chart.line" fill="none" stroke="#7c5cfa" stroke-width="2" vector-effect="non-scaling-stroke" />
              </svg>
              <div class="rev-axis">
                <span>{{ chart.first }}</span>
                <span>{{ chart.last }}</span>
              </div>
            </div>
            <NEmpty v-else description="所选区间暂无已支付订单" />
          </NCard>
        </NGi>
        <!-- 渠道分布 -->
        <NGi :span="1">
          <NCard size="small" title="渠道收入分布">
            <div v-if="channelRev.length" class="bars">
              <div v-for="c in channelRev" :key="c.channel" class="bar-row">
                <span class="bar-label">{{ channelText(c.channel) }}</span>
                <div class="bar-track"><i class="bar-fill" :style="{ width: `${Math.max(3, (c.amount / channelMax) * 100)}%` }" /></div>
                <span class="bar-val">¥{{ money(c.amount) }}</span>
              </div>
            </div>
            <NEmpty v-else description="暂无数据" />
          </NCard>
        </NGi>
      </NGrid>

      <NCard title="汇总（按渠道 + 状态）" size="small" class="mb-4">
        <NDataTable :columns="sumCols" :data="summary" size="small" />
      </NCard>

      <NCard :title="`异常订单（${anomalies.length}）`" size="small">
        <NDataTable :columns="anoCols" :data="anomalies" size="small" :pagination="{ pageSize: 10 }" />
      </NCard>
    </NSpin>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NTag } from 'naive-ui'
/* eslint-disable @typescript-eslint/no-explicit-any */

const api = useAdminApi()

function dayMs(offsetDays: number): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + offsetDays)
  return d.getTime()
}
const range = ref<[number, number]>([dayMs(-6), dayMs(0)])
const channel = ref<string | null>(null)
const productType = ref<number | null>(null)
const channelOpts = [{ label: '支付宝', value: 'alipay' }, { label: '微信', value: 'wxcode' }, { label: '易付通', value: 'yft' }]
const typeOpts = [{ label: '会员', value: 0 }, { label: '锦囊充值', value: 1 }]

const metrics = ref<any>(null)
const summary = ref<any[]>([])
const daily = ref<any[]>([])
const channelRev = ref<any[]>([])
const anomalies = ref<any[]>([])
const loading = ref(false)

function quickRange(days: number) { range.value = [dayMs(-(days - 1)), dayMs(0)]; load() }

async function load() {
  loading.value = true
  const q: Record<string, unknown> = {}
  if (range.value) {
    // 含当天整日：结束日补到 23:59:59
    q.begin = new Date(range.value[0]).toISOString()
    q.end = new Date(range.value[1] + 86399000).toISOString()
  }
  if (channel.value) q.channel = channel.value
  if (productType.value !== null) q.productType = productType.value
  const res = await api.get<any>('reconcile', q)
  loading.value = false
  if (res.code === 0 && res.data) {
    metrics.value = res.data.metrics
    summary.value = res.data.summary
    daily.value = res.data.dailyRevenue ?? []
    channelRev.value = res.data.channelRevenue ?? []
    anomalies.value = res.data.anomalies ?? []
  }
}

function money(v: number) { return (Math.round((v ?? 0) * 100) / 100).toLocaleString() }
function channelText(c?: string) {
  const l = (c || '').toLowerCase()
  return l === 'alipay' ? '支付宝' : l === 'wxcode' ? '微信' : l === 'yft' ? '易付通' : (c || '未知')
}

// SVG 收入趋势（折线 + 面积，无图表库）
const chart = computed(() => {
  const pts = daily.value
  if (!pts.length) return null
  const W = 720, H = 170, pad = 8
  const max = Math.max(1, ...pts.map(p => p.amount))
  const total = pts.reduce((s, p) => s + p.amount, 0)
  const n = pts.length
  const x = (i: number) => (n === 1 ? W / 2 : pad + (W - pad * 2) * (i / (n - 1)))
  const y = (v: number) => pad + (H - pad * 2) * (1 - v / max)
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.amount).toFixed(1)}`).join(' ')
  const area = `${line} L${x(n - 1).toFixed(1)},${(H - pad).toFixed(1)} L${x(0).toFixed(1)},${(H - pad).toFixed(1)} Z`
  return { W, H, max, total, line, area, first: pts[0].date, last: pts[n - 1].date }
})

const channelMax = computed(() => Math.max(1, ...channelRev.value.map(c => c.amount)))

function fmt(d?: string) { return d ? d.replace('T', ' ').substring(0, 19) : '—' }

const sumCols = [
  { title: '渠道', key: 'channel', render: (r: any) => channelText(r.channel) },
  { title: '状态', key: 'statusText' },
  { title: '笔数', key: 'count' },
  { title: '金额', key: 'amount', render: (r: any) => `¥${money(r.amount)}` },
]
const anoCols = [
  { title: '订单号', key: 'orderId', ellipsis: { tooltip: true } },
  { title: 'UserId', key: 'userId', width: 80 },
  { title: '渠道', key: 'channel', width: 80, render: (r: any) => channelText(r.channel) },
  { title: '金额', key: 'totalFee', width: 90, render: (r: any) => `¥${money(r.totalFee)}` },
  { title: '问题', key: 'issue', render: (r: any) => h(NTag, { size: 'small', type: 'warning' }, { default: () => r.issue }) },
  { title: '创建', key: 'createTime', width: 160, render: (r: any) => fmt(r.createTime) },
]

onMounted(load)
</script>

<style scoped>
.rev-wrap { display: flex; flex-direction: column; gap: 6px; }
.rev-head { display: flex; justify-content: space-between; font-size: 12px; font-weight: 700; color: #666; }
.rev-peak { color: #7c5cfa; }
.rev-svg { width: 100%; height: 170px; display: block; }
.rev-axis { display: flex; justify-content: space-between; font-size: 11px; color: #999; }

.bars { display: flex; flex-direction: column; gap: 12px; padding: 4px 0; }
.bar-row { display: grid; grid-template-columns: 48px 1fr auto; align-items: center; gap: 8px; }
.bar-label { font-size: 13px; font-weight: 700; color: #555; }
.bar-track { height: 14px; background: #f0eefe; border-radius: 4px; overflow: hidden; }
.bar-fill { display: block; height: 100%; background: linear-gradient(90deg, #7c5cfa, #9d83fb); border-radius: 4px; }
.bar-val { font-size: 12px; font-weight: 700; color: #333; white-space: nowrap; }
</style>
