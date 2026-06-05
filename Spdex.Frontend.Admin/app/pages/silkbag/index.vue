<template>
  <div>
    <h2 class="mb-4 text-xl font-semibold">锦囊账本</h2>

    <NSpace class="mb-4" align="center">
      <NInputNumber v-model:value="userId" placeholder="UserId" :show-button="false" style="width:160px" />
      <NButton type="primary" @click="queryAll">查询</NButton>
    </NSpace>

    <NCard v-if="balance" title="余额" size="small" class="mb-4">
      <NSpace size="large">
        <NStatistic label="总计" :value="balance.total" />
        <NStatistic label="充值" :value="balance.payCount" />
        <NStatistic label="奖励" :value="balance.rewardCount" />
        <NStatistic label="分成" :value="balance.shareCount" />
      </NSpace>
      <div v-if="can(P.silkAdjustSmall)" class="mt-4">
        <NDivider />
        <NSpace align="center">
          <NInputNumber v-model:value="adjust.delta" placeholder="调账数(±)" style="width:160px" />
          <NSelect v-model:value="adjust.bagType" :options="bagTypeOptions" style="width:120px" />
          <NInput v-model:value="adjust.reason" placeholder="原因（必填）" style="width:240px" />
          <NButton type="warning" :loading="saving" @click="submitAdjust">调账</NButton>
        </NSpace>
        <div class="mt-1 text-xs text-gray-400">小额上限由系统配置；超额需大额调账权限。</div>
      </div>
    </NCard>

    <NCard v-if="balance && can(P.silkView)" size="small">
      <NTabs type="line" default-value="update" @update:value="loadTab">
        <NTabPane name="update" tab="调账日志">
          <NDataTable :columns="updateCols" :data="logs.update" :loading="loading" size="small" :pagination="{ pageSize: 10 }" />
        </NTabPane>
        <NTabPane name="consume" tab="消费流水">
          <NDataTable :columns="consumeCols" :data="logs.consume" :loading="loading" size="small" :pagination="{ pageSize: 10 }" />
        </NTabPane>
        <NTabPane name="reward" tab="奖励流水">
          <NDataTable :columns="rewardCols" :data="logs.reward" :loading="loading" size="small" :pagination="{ pageSize: 10 }" />
        </NTabPane>
        <NTabPane name="prorata" tab="分成流水">
          <NDataTable :columns="prorataCols" :data="logs.prorata" :loading="loading" size="small" :pagination="{ pageSize: 10 }" />
        </NTabPane>
      </NTabs>
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { P } from '~/utils/permissions'

interface Balance { total: number, payCount: number, rewardCount: number, shareCount: number }

const api = useAdminApi()
const message = useMessage()
const { can } = usePermission()

const userId = ref<number | null>(null)
const balance = ref<Balance | null>(null)
const saving = ref(false)
const loading = ref(false)
const logs = reactive<Record<string, unknown[]>>({ update: [], consume: [], reward: [], prorata: [] })

const adjust = reactive<{ delta: number | null, bagType: number, reason: string }>({ delta: null, bagType: 1, reason: '' })
const bagTypeOptions = [{ label: '充值账户', value: 1 }, { label: '奖励账户', value: 2 }, { label: '分成账户', value: 3 }]

async function queryAll() {
  if (!userId.value || userId.value <= 0) { message.warning('请输入 UserId'); return }
  const res = await api.get<Balance>(`silkbag/balance/${userId.value}`)
  if (res.code === 0) balance.value = res.data
  else { message.error(res.message); balance.value = null }
  await loadTab('update')
}

async function loadTab(name: string) {
  if (!userId.value) return
  loading.value = true
  const res = name === 'update'
    ? await api.get<unknown[]>('silkbag/update-logs', { userId: userId.value })
    : await api.get<unknown[]>(`silkbag/${name}-logs/${userId.value}`)
  loading.value = false
  if (res.code === 0 && res.data) logs[name] = res.data
}

async function submitAdjust() {
  if (!userId.value) { message.warning('请先查询用户'); return }
  if (!adjust.delta) { message.warning('请输入调账数'); return }
  if (!adjust.reason.trim()) { message.warning('请填写原因'); return }
  saving.value = true
  const res = await api.post<Balance>('silkbag/adjust', { userId: userId.value, delta: adjust.delta, bagType: adjust.bagType, reason: adjust.reason.trim() })
  saving.value = false
  if (res.code === 0) { message.success('调账成功'); balance.value = res.data; adjust.delta = null; adjust.reason = ''; loadTab('update') }
  else message.error(res.message)
}

function fmt(d?: string) { return d ? d.replace('T', ' ').substring(0, 19) : '—' }

const consumeType: Record<number, string> = { 2: '模型', 4: '会员', 5: '单场', 12: '大注', 15: '现场数据', 16: '现场球点', 18: '课程', 20: '短信', 21: '按场次球点' }
const rewardType: Record<number, string> = { 1: '购买奖励', 2: '锦囊买会员奖励', 3: '超级大注邀请', 4: '课程奖励' }

/* eslint-disable @typescript-eslint/no-explicit-any */
const updateCols = [
  { title: '时间', key: 'updateTime', render: (r: any) => fmt(r.updateTime) },
  { title: '账户', key: 'bagType' },
  { title: '变动', key: 'updateBagCount' },
  { title: '余额', key: 'bagCount' },
  { title: '原因', key: 'reason', render: (r: any) => r.reason || '—' },
  { title: '操作人', key: 'operUserId', render: (r: any) => r.operUserId || '—' },
]
const consumeCols = [
  { title: '时间', key: 'createTime', render: (r: any) => fmt(r.createTime) },
  { title: '扣减', key: 'consumeCount' },
  { title: '类型', key: 'consumeType', render: (r: any) => consumeType[r.consumeType] || r.consumeType || '—' },
  { title: '账户', key: 'consumeBagType' },
  { title: '产品', key: 'consumeProductId', render: (r: any) => r.consumeProductId || '—' },
  { title: '退款', key: 'isRefund', render: (r: any) => (r.isRefund ? '是' : '') },
]
const rewardCols = [
  { title: '时间', key: 'createTime', render: (r: any) => fmt(r.createTime) },
  { title: '奖励', key: 'rewardCount' },
  { title: '类型', key: 'rewardType', render: (r: any) => rewardType[r.rewardType] || r.rewardType || '—' },
  { title: '订单', key: 'orderId', render: (r: any) => r.orderId || '—' },
  { title: '备注', key: 'remark', render: (r: any) => r.remark || '—' },
]
const prorataCols = [
  { title: '时间', key: 'createTime', render: (r: any) => fmt(r.createTime) },
  { title: '消费者', key: 'userName', render: (r: any) => r.userName || '—' },
  { title: '产品', key: 'productName', render: (r: any) => r.productName || '—' },
  { title: '消费额', key: 'bagCount' },
  { title: '分成比', key: 'sharePercent', render: (r: any) => r.sharePercent ?? '—' },
  { title: '分得', key: 'shareBagCount', render: (r: any) => r.shareBagCount ?? '—' },
]
</script>
