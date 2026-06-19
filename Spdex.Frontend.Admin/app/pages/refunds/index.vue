<template>
  <div>
    <NSpace class="mb-4" justify="space-between" align="center">
      <h2 class="text-xl font-semibold">
        退款工单 <NBadge v-if="pending > 0" :value="pending" :max="99" />
      </h2>
      <NButton v-if="can(P.orderRefundRequest)" type="primary" @click="openCreate">发起退款</NButton>
    </NSpace>

    <NSpace class="mb-4">
      <NSelect v-model:value="statusFilter" :options="statusOpts" clearable placeholder="状态" style="width:140px" />
      <NInput v-model:value="orderIdFilter" clearable placeholder="订单号" style="width:200px" @keyup.enter="load" />
      <NButton @click="load">查询</NButton>
    </NSpace>

    <NDataTable :columns="columns" :data="rows" :loading="loading" :pagination="{ pageSize: 20 }" />

    <!-- 发起退款 -->
    <NModal v-model:show="showCreate" preset="card" title="发起退款工单" style="width:460px">
      <NForm label-placement="left" label-width="84">
        <NFormItem label="订单号">
          <NInput v-model:value="form.orderId" placeholder="已支付订单的订单号" @blur="loadRefundable" />
        </NFormItem>
        <NFormItem v-if="refundable" label="可退余额">
          <b>¥{{ refundable.refundable }}</b>
          <span class="ml-2 text-xs text-gray-400">{{ channelText(refundable.channel) }}·{{ refundable.canAutoRefund ? '审批后可自动退款' : '需人工后台退款' }}（订单 ¥{{ refundable.orderTotalFee }}，已退 ¥{{ refundable.alreadyRefunded }}）</span>
        </NFormItem>
        <NFormItem label="退款金额">
          <NInputNumber v-model:value="form.amount" :min="0.01" :max="refundable?.refundable" :precision="2" placeholder="留空=退全部可退余额" style="width:100%" />
        </NFormItem>
        <NFormItem label="退款原因">
          <NInput v-model:value="form.reason" type="textarea" :rows="3" placeholder="必填" />
        </NFormItem>
        <div class="text-xs text-gray-400">支持部分退款；提交后进入「待审批」，财务审批通过再执行退款。</div>
      </NForm>
      <template #footer>
        <NButton type="primary" :loading="saving" @click="submitCreate">提交</NButton>
      </template>
    </NModal>

    <!-- 工单详情 -->
    <NModal v-model:show="showDetail" preset="card" title="退款工单详情" style="width:480px">
      <NDescriptions v-if="detailRow" :column="1" bordered size="small" label-placement="left">
        <NDescriptionsItem label="工单号">#{{ detailRow.id }}</NDescriptionsItem>
        <NDescriptionsItem label="订单号">{{ detailRow.orderId }}</NDescriptionsItem>
        <NDescriptionsItem label="UserId">{{ detailRow.userId }}</NDescriptionsItem>
        <NDescriptionsItem label="渠道">{{ channelText(detailRow.channel) }}</NDescriptionsItem>
        <NDescriptionsItem label="退款金额">¥{{ detailRow.amount }}</NDescriptionsItem>
        <NDescriptionsItem label="状态">
          <NTag size="small" :type="statusType[detailRow.status]">{{ detailRow.statusText }}</NTag>
        </NDescriptionsItem>
        <NDescriptionsItem label="退款方式">{{ methodText(detailRow.refundMethod) }}</NDescriptionsItem>
        <NDescriptionsItem label="退款单号">{{ detailRow.refundNo || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="渠道流水号">{{ detailRow.channelRefundId || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="退款原因">{{ detailRow.reason }}</NDescriptionsItem>
        <NDescriptionsItem v-if="detailRow.failReason" label="失败原因">
          <span style="color:#d03050">{{ detailRow.failReason }}</span>
        </NDescriptionsItem>
        <NDescriptionsItem label="发起人">{{ detailRow.requestedBy }}</NDescriptionsItem>
        <NDescriptionsItem label="处理人">{{ detailRow.approvedBy || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="审批备注">{{ detailRow.approveNote || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="创建">{{ fmt(detailRow.createdAt) }}</NDescriptionsItem>
        <NDescriptionsItem label="更新">{{ fmt(detailRow.updatedAt) }}</NDescriptionsItem>
      </NDescriptions>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NSpace, NTag, useMessage, useDialog } from 'naive-ui'
import { P } from '~/utils/permissions'
/* eslint-disable @typescript-eslint/no-explicit-any */

const api = useAdminApi()
const message = useMessage()
const dialog = useDialog()
const { can } = usePermission()

const rows = ref<any[]>([])
const pending = ref(0)
const loading = ref(false)
const saving = ref(false)
const statusFilter = ref<number | null>(null)
const orderIdFilter = ref('')
const statusOpts = [
  { label: '待审批', value: 0 }, { label: '已批准', value: 1 }, { label: '驳回', value: 2 },
  { label: '已退款', value: 3 }, { label: '退款失败', value: 4 },
]

function channelText(c?: string) {
  const l = (c || '').toLowerCase()
  return l === 'alipay' ? '支付宝' : l === 'wxcode' ? '微信' : l === 'yft' ? '易付通' : (c || '—')
}
function methodText(m?: string) {
  return m === 'auto' ? '接口自动退款' : m === 'manual' ? '人工后台退款' : '—'
}

async function load() {
  loading.value = true
  const q: Record<string, unknown> = {}
  if (statusFilter.value !== null) q.status = statusFilter.value
  if (orderIdFilter.value.trim()) q.orderId = orderIdFilter.value.trim()
  const res = await api.get<any>('refunds', q)
  loading.value = false
  if (res.code === 0 && res.data) { rows.value = res.data.items; pending.value = res.data.pendingCount }
}

// 发起退款
const showCreate = ref(false)
const refundable = ref<any>(null)
const form = reactive<{ orderId: string, amount: number | null, reason: string }>({ orderId: '', amount: null, reason: '' })
function openCreate() { form.orderId = ''; form.amount = null; form.reason = ''; refundable.value = null; showCreate.value = true }
async function loadRefundable() {
  refundable.value = null
  const oid = form.orderId.trim()
  if (!oid) return
  const res = await api.get<any>(`refunds/refundable/${oid}`)
  if (res.code === 0 && res.data) { refundable.value = res.data; if (!form.amount) form.amount = res.data.refundable }
}
async function submitCreate() {
  if (!form.orderId.trim() || !form.reason.trim()) { message.warning('订单号和原因必填'); return }
  saving.value = true
  const body: any = { orderId: form.orderId.trim(), reason: form.reason.trim() }
  if (form.amount && form.amount > 0) body.amount = form.amount
  const res = await api.post('refunds', body)
  saving.value = false
  if (res.code === 0) { message.success('已发起'); showCreate.value = false; load() }
  else message.error(res.message)
}

// 工单详情
const showDetail = ref(false)
const detailRow = ref<any>(null)
function openDetailRefund(r: any) { detailRow.value = r; showDetail.value = true }

function approve(r: any, ok: boolean) {
  if (ok) {
    dialog.success({
      title: '批准退款', content: `批准工单 #${r.id}（¥${r.amount}）？批准后可执行退款。`, positiveText: '批准', negativeText: '取消',
      onPositiveClick: async () => {
        const res = await api.put(`refunds/${r.id}/approve`, { approve: true })
        if (res.code === 0) { message.success('已批准'); load() } else message.error(res.message)
      },
    })
  }
  else {
    const note = window.prompt('驳回原因')
    if (note === null) return
    if (!note.trim()) { message.warning('请填写驳回原因'); return }
    api.put(`refunds/${r.id}/approve`, { approve: false, note }).then((res) => {
      if (res.code === 0) { message.success('已驳回'); load() } else message.error(res.message)
    })
  }
}

// 执行退款：支付宝自动调 API；微信/YFT 确认人工已退
function execute(r: any) {
  const auto = !!r.canAutoRefund
  dialog.warning({
    title: auto ? '自动退款' : '确认已退款',
    content: auto
      ? `将调用${channelText(r.channel)}接口自动退款 ¥${r.amount} 到原支付方式，这是真实退款操作，确认执行？`
      : `确认工单 #${r.id}（¥${r.amount}）已在${channelText(r.channel)}商户后台完成退款？`,
    positiveText: auto ? '执行退款' : '确认已退',
    negativeText: '取消',
    onPositiveClick: async () => {
      const res = await api.post(`refunds/${r.id}/execute`)
      if (res.code === 0) { message.success(auto ? '退款已执行' : '已标记已退款'); load() }
      else message.error(res.message)
    },
  })
}

function fmt(d?: string) { return d ? d.replace('T', ' ').substring(0, 19) : '—' }
const statusType: Record<number, any> = { 0: 'warning', 1: 'info', 2: 'error', 3: 'success', 4: 'error' }

const columns = [
  { title: '#', key: 'id', width: 56 },
  { title: '订单号', key: 'orderId', ellipsis: { tooltip: true } },
  { title: 'UserId', key: 'userId', width: 76 },
  { title: '渠道', key: 'channel', width: 70, render: (r: any) => channelText(r.channel) },
  { title: '金额', key: 'amount', width: 80, render: (r: any) => `¥${r.amount}` },
  { title: '原因', key: 'reason', ellipsis: { tooltip: true } },
  { title: '状态', key: 'status', width: 88, render: (r: any) => h(NTag, { size: 'small', type: statusType[r.status] }, { default: () => r.statusText }) },
  { title: '创建', key: 'createdAt', width: 150, render: (r: any) => fmt(r.createdAt) },
  {
    title: '操作', key: 'a', width: 210,
    render: (r: any) => h(NSpace, { size: 4 }, {
      default: () => {
        const btns = [h(NButton, { size: 'tiny', onClick: () => openDetailRefund(r) }, { default: () => '详情' })]
        if (!can(P.orderRefundApprove)) return btns
        if (r.status === 0) {
          btns.push(h(NButton, { size: 'tiny', type: 'primary', onClick: () => approve(r, true) }, { default: () => '批准' }))
          btns.push(h(NButton, { size: 'tiny', type: 'error', onClick: () => approve(r, false) }, { default: () => '驳回' }))
        }
        else if (r.status === 1) {
          btns.push(h(NButton, { size: 'tiny', type: 'success', onClick: () => execute(r) }, { default: () => (r.canAutoRefund ? '自动退款' : '确认已退款') }))
        }
        else if (r.status === 4) {
          btns.push(h(NButton, { size: 'tiny', type: 'warning', onClick: () => execute(r) }, { default: () => '重试退款' }))
        }
        return btns
      },
    }),
  },
]

onMounted(load)
</script>
