<template>
  <div>
    <NButton text class="mb-3" @click="navigateTo('/users')">← 返回用户列表</NButton>

    <NCard v-if="user" :title="`${user.userName}（#${user.userId}）`" size="small" class="mb-4">
      <NDescriptions :column="3" size="small" label-placement="left">
        <NDescriptionsItem label="会籍">{{ user.tier }}（{{ user.roleId }}）</NDescriptionsItem>
        <NDescriptionsItem label="到期">{{ fmtDateTime(user.endDate) }}</NDescriptionsItem>
        <NDescriptionsItem label="状态">{{ user.enabled ? '启用' : '禁用' }}</NDescriptionsItem>
        <NDescriptionsItem label="手机">{{ user.mobile || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="邮箱">{{ user.email || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="注册">{{ fmtDateTime(user.registerDate) }}</NDescriptionsItem>
        <NDescriptionsItem label="最后活跃">{{ fmtDateTime(user.lastActivityDate) }}</NDescriptionsItem>
        <NDescriptionsItem label="支付测试">
          <NTag v-if="user.isTestAccount" type="warning" size="small" :bordered="false">是 · 支付 0.01</NTag>
          <span v-else>否</span>
        </NDescriptionsItem>
        <NDescriptionsItem label="AI 测试">
          <NTag
            v-if="user.hasAiTestAccess"
            :type="user.aiTestAccessSource === 'environment' ? 'info' : 'success'"
            size="small"
            :bordered="false"
          >
            {{ user.aiTestAccessSource === 'environment' ? '已开放 · 环境应急' : '已开放 · 后台配置' }}
          </NTag>
          <span v-else>{{ user.aiTestAccessSource === 'admin' ? '已由后台关闭' : '未开放' }}</span>
        </NDescriptionsItem>
      </NDescriptions>
      <div class="mt-4 divide-y divide-gray-100 border-t border-gray-100">
        <div v-if="can(P.userMembershipEdit)" class="flex items-center gap-3 py-3">
          <NSwitch :value="!!user.isTestAccount" :loading="testSaving" @update:value="toggleTest" />
          <div>
            <div class="text-sm font-medium">支付测试账号</div>
            <div class="text-xs text-gray-400">购买会员或锦囊时支付金额固定为 0.01 元，不改变会籍权限。</div>
          </div>
        </div>
        <div v-if="can(P.aiOpsManage)" class="flex items-center gap-3 py-3">
          <NSwitch
            :value="!!user.hasAiTestAccess"
            :loading="aiTestSaving"
            @update:value="confirmAiTestAccess"
          />
          <div>
            <div class="text-sm font-medium">AI 观察助手测试资格</div>
            <div class="text-xs text-gray-400">开放站内 AI 观察助手与个人 MCP 连接；保持免费测试计量，不影响支付和会籍。</div>
            <div v-if="user.aiTestAccessSource === 'environment'" class="mt-1 text-xs text-blue-500">
              当前由服务器应急白名单开放。操作此开关后，将改由后台配置并覆盖应急白名单。
            </div>
          </div>
        </div>
      </div>
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
import { useDialog, useMessage } from 'naive-ui'
import { P } from '~/utils/permissions'
/* eslint-disable @typescript-eslint/no-explicit-any */

const route = useRoute()
const api = useAdminApi()
const message = useMessage()
const dialog = useDialog()
const { can } = usePermission()
const id = Number(route.params.id)

const user = ref<any>(null)
const testSaving = ref(false)
async function toggleTest(val: boolean) {
  testSaving.value = true
  const res = await api.put(`users/${id}/test-account`, { isTest: val, remark: null })
  testSaving.value = false
  if (res.code === 0) { message.success(val ? '已设为测试账号' : '已取消测试账号'); loadUser() }
  else message.error(res.message || '操作失败')
}
const aiTestSaving = ref(false)
function confirmAiTestAccess(enabled: boolean) {
  dialog.warning({
    title: enabled ? '开放 AI 测试资格' : '关闭 AI 测试资格',
    content: enabled
      ? `确认向 ${user.value.userName} 开放 AI 观察助手和个人 MCP 连接？该用户仍按免费测试计量。`
      : `确认关闭 ${user.value.userName} 的 AI 测试资格？用户入口和相关接口将立即不可用。`,
    positiveText: enabled ? '确认开放' : '确认关闭',
    negativeText: '取消',
    onPositiveClick: () => setAiTestAccess(enabled),
  })
}
async function setAiTestAccess(enabled: boolean) {
  aiTestSaving.value = true
  const res = await api.put(`users/${id}/ai-test-access`, { enabled, remark: 'Admin2026 会员管理' })
  aiTestSaving.value = false
  if (res.code === 0) {
    message.success(enabled ? '已开放 AI 测试资格' : '已关闭 AI 测试资格')
    await loadUser()
  }
  else message.error(res.message || '操作失败')
}
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

function fmtDateTime(d?: string) { return d ? d.replace('T', ' ').substring(0, 16) : '—' }
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
