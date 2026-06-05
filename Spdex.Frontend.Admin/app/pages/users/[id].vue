<template>
  <div>
    <NButton text class="mb-3" @click="navigateTo('/users')">← 返回用户列表</NButton>

    <NCard v-if="user" :title="`${user.userName}（#${user.userId}）`" size="small" class="mb-4">
      <NDescriptions :column="3" size="small" label-placement="left">
        <NDescriptionsItem label="会籍">{{ user.tier }}（{{ user.roleId }}）</NDescriptionsItem>
        <NDescriptionsItem label="到期">{{ fmtDate(user.endDate) }}</NDescriptionsItem>
        <NDescriptionsItem label="状态">{{ user.enabled ? '启用' : '禁用' }}</NDescriptionsItem>
        <NDescriptionsItem label="手机">{{ user.mobile || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="邮箱">{{ user.email || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="注册">{{ fmtDate(user.registerDate) }}</NDescriptionsItem>
        <NDescriptionsItem label="最后活跃">{{ fmtDate(user.lastActivityDate) }}</NDescriptionsItem>
      </NDescriptions>
    </NCard>

    <NCard size="small">
      <NTabs type="line" default-value="orders" @update:value="onTab">
        <NTabPane v-if="can(P.orderView)" name="orders" tab="订单">
          <NDataTable :columns="orderCols" :data="orders" :loading="loading" size="small" :pagination="{ pageSize: 10 }" />
        </NTabPane>
        <NTabPane v-if="can(P.silkView)" name="silk" tab="锦囊">
          <NSpace v-if="balance" class="mb-3" size="large">
            <NStatistic label="总计" :value="balance.total" />
            <NStatistic label="充值" :value="balance.payCount" />
            <NStatistic label="奖励" :value="balance.rewardCount" />
            <NStatistic label="分成" :value="balance.shareCount" />
          </NSpace>
          <NDataTable :columns="silkCols" :data="silkLogs" :loading="loading" size="small" :pagination="{ pageSize: 10 }" />
        </NTabPane>
      </NTabs>
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { P } from '~/utils/permissions'
/* eslint-disable @typescript-eslint/no-explicit-any */

const route = useRoute()
const api = useAdminApi()
const { can } = usePermission()
const id = Number(route.params.id)

const user = ref<any>(null)
const orders = ref<any[]>([])
const balance = ref<any>(null)
const silkLogs = ref<any[]>([])
const loading = ref(false)

async function loadUser() {
  const res = await api.get<any>(`users/${id}`)
  if (res.code === 0) user.value = res.data
}
async function loadOrders() {
  loading.value = true
  const res = await api.get<any>('orders', { userId: id, pageSize: 50 })
  loading.value = false
  orders.value = res.code === 0 && res.data ? res.data.items : []
}
async function loadSilk() {
  loading.value = true
  const [b, l] = await Promise.all([
    api.get<any>(`silkbag/balance/${id}`),
    api.get<any[]>(`silkbag/consume-logs/${id}`),
  ])
  loading.value = false
  if (b.code === 0) balance.value = b.data
  silkLogs.value = l.code === 0 && l.data ? l.data : []
}
function onTab(name: string) { if (name === 'silk' && !balance.value) loadSilk() }

function fmtDate(d?: string) { return d ? d.substring(0, 10) : '—' }
function fmt(d?: string) { return d ? d.replace('T', ' ').substring(0, 19) : '—' }

const orderCols = [
  { title: '订单号', key: 'orderId', ellipsis: { tooltip: true } },
  { title: '类型', key: 'productTypeText' },
  { title: '渠道', key: 'channel' },
  { title: '金额', key: 'totalFee', render: (r: any) => `¥${r.totalFee}` },
  { title: '状态', key: 'statusText' },
  { title: '创建', key: 'createTime', render: (r: any) => fmt(r.createTime) },
]
const silkCols = [
  { title: '时间', key: 'createTime', render: (r: any) => fmt(r.createTime) },
  { title: '扣减', key: 'consumeCount' },
  { title: '账户', key: 'consumeBagType' },
  { title: '产品', key: 'consumeProductId', render: (r: any) => r.consumeProductId || '—' },
]

onMounted(() => { loadUser(); if (can(P.orderView)) loadOrders() })
</script>
