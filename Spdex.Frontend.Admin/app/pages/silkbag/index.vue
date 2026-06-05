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
        <div class="mt-1 text-xs text-gray-400">小额调账上限由系统配置；超额需大额调账权限。</div>
      </div>
    </NCard>

    <NCard v-if="can(P.silkView)" title="调账日志（近 30 天）" size="small">
      <NDataTable :columns="logColumns" :data="logs" :loading="loadingLogs" size="small" :pagination="{ pageSize: 10 }" />
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { P } from '~/utils/permissions'

interface Balance { total: number, payCount: number, rewardCount: number, shareCount: number }
interface UpdateLog { id: number, userId: number, bagType: number, updateBagCount: number, bagCount: number, reason?: string, operUserId?: string, updateTime: string }

const api = useAdminApi()
const message = useMessage()
const { can } = usePermission()

const userId = ref<number | null>(null)
const balance = ref<Balance | null>(null)
const saving = ref(false)
const logs = ref<UpdateLog[]>([])
const loadingLogs = ref(false)

const adjust = reactive<{ delta: number | null, bagType: number, reason: string }>({ delta: null, bagType: 1, reason: '' })
const bagTypeOptions = [
  { label: '充值账户', value: 1 },
  { label: '奖励账户', value: 2 },
  { label: '分成账户', value: 3 },
]

async function queryAll() {
  if (!userId.value || userId.value <= 0) { message.warning('请输入 UserId'); return }
  const res = await api.get<Balance>(`silkbag/balance/${userId.value}`)
  if (res.code === 0) balance.value = res.data
  else { message.error(res.message); balance.value = null }
  await loadLogs()
}

async function loadLogs() {
  if (!userId.value) return
  loadingLogs.value = true
  const res = await api.get<UpdateLog[]>('silkbag/update-logs', { userId: userId.value })
  loadingLogs.value = false
  logs.value = res.code === 0 && res.data ? res.data : []
}

async function submitAdjust() {
  if (!userId.value) { message.warning('请先查询用户'); return }
  if (!adjust.delta) { message.warning('请输入调账数'); return }
  if (!adjust.reason.trim()) { message.warning('请填写调账原因'); return }
  saving.value = true
  const res = await api.post<Balance>('silkbag/adjust', {
    userId: userId.value,
    delta: adjust.delta,
    bagType: adjust.bagType,
    reason: adjust.reason.trim(),
  })
  saving.value = false
  if (res.code === 0) {
    message.success('调账成功')
    balance.value = res.data
    adjust.delta = null
    adjust.reason = ''
    loadLogs()
  }
  else { message.error(res.message) }
}

function fmt(d?: string) { return d ? d.replace('T', ' ').substring(0, 19) : '—' }

const logColumns = [
  { title: '时间', key: 'updateTime', render: (r: UpdateLog) => fmt(r.updateTime) },
  { title: '账户', key: 'bagType' },
  { title: '变动', key: 'updateBagCount' },
  { title: '余额', key: 'bagCount' },
  { title: '原因', key: 'reason', render: (r: UpdateLog) => r.reason || '—' },
  { title: '操作人', key: 'operUserId', render: (r: UpdateLog) => r.operUserId || '—' },
]
</script>
