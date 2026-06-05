<template>
  <div>
    <h2 class="mb-4 text-xl font-semibold">订单对账</h2>

    <NSpace class="mb-4" align="center">
      <NDatePicker v-model:value="range" type="daterange" clearable />
      <NButton type="primary" @click="load">对账</NButton>
      <span class="text-xs text-gray-400">默认近 7 天；金额拿去与支付宝/微信商户后台核对</span>
    </NSpace>

    <NCard title="汇总（按渠道 + 状态）" size="small" class="mb-4">
      <NDataTable :columns="sumCols" :data="summary" :loading="loading" size="small" />
    </NCard>

    <NCard :title="`异常订单（${anomalies.length}）`" size="small">
      <NDataTable :columns="anoCols" :data="anomalies" :loading="loading" size="small" :pagination="{ pageSize: 10 }" />
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NTag } from 'naive-ui'
/* eslint-disable @typescript-eslint/no-explicit-any */

const api = useAdminApi()
const range = ref<[number, number] | null>(null)
const summary = ref<any[]>([])
const anomalies = ref<any[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  const q: Record<string, unknown> = {}
  if (range.value) {
    q.begin = new Date(range.value[0]).toISOString()
    q.end = new Date(range.value[1]).toISOString()
  }
  const res = await api.get<any>('reconcile', q)
  loading.value = false
  if (res.code === 0 && res.data) {
    summary.value = res.data.summary
    anomalies.value = res.data.anomalies
  }
}

function fmt(d?: string) { return d ? d.replace('T', ' ').substring(0, 19) : '—' }

const sumCols = [
  { title: '渠道', key: 'channel' },
  { title: '状态', key: 'statusText' },
  { title: '笔数', key: 'count' },
  { title: '金额', key: 'amount', render: (r: any) => `¥${r.amount}` },
]
const anoCols = [
  { title: '订单号', key: 'orderId', ellipsis: { tooltip: true } },
  { title: 'UserId', key: 'userId', width: 80 },
  { title: '渠道', key: 'channel', width: 80 },
  { title: '金额', key: 'totalFee', width: 90, render: (r: any) => `¥${r.totalFee}` },
  { title: '问题', key: 'issue', render: (r: any) => h(NTag, { size: 'small', type: 'warning' }, { default: () => r.issue }) },
  { title: '创建', key: 'createTime', width: 160, render: (r: any) => fmt(r.createTime) },
]

onMounted(load)
</script>
