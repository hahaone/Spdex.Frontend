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
      <NButton @click="load">查询</NButton>
    </NSpace>

    <NDataTable :columns="columns" :data="rows" :loading="loading" :pagination="{ pageSize: 20 }" />

    <NModal v-model:show="showCreate" preset="card" title="发起退款工单" style="width:420px">
      <NForm label-placement="left" label-width="72">
        <NFormItem label="订单号">
          <NInput v-model:value="form.orderId" placeholder="已支付订单的订单号" />
        </NFormItem>
        <NFormItem label="退款原因">
          <NInput v-model:value="form.reason" type="textarea" :rows="3" placeholder="必填" />
        </NFormItem>
        <div class="text-xs text-gray-400">金额自动取自订单；提交后进入「待审批」，由财务审批。</div>
      </NForm>
      <template #footer>
        <NButton type="primary" :loading="saving" @click="submitCreate">提交</NButton>
      </template>
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
const statusOpts = [{ label: '待审批', value: 0 }, { label: '已批准', value: 1 }, { label: '驳回', value: 2 }, { label: '已退款', value: 3 }]

async function load() {
  loading.value = true
  const q: Record<string, unknown> = {}
  if (statusFilter.value !== null) q.status = statusFilter.value
  const res = await api.get<any>('refunds', q)
  loading.value = false
  if (res.code === 0 && res.data) { rows.value = res.data.items; pending.value = res.data.pendingCount }
}

const showCreate = ref(false)
const form = reactive({ orderId: '', reason: '' })
function openCreate() { form.orderId = ''; form.reason = ''; showCreate.value = true }
async function submitCreate() {
  if (!form.orderId.trim() || !form.reason.trim()) { message.warning('订单号和原因必填'); return }
  saving.value = true
  const res = await api.post('refunds', { orderId: form.orderId.trim(), reason: form.reason.trim() })
  saving.value = false
  if (res.code === 0) { message.success('已发起'); showCreate.value = false; load() }
  else message.error(res.message)
}

function approve(r: any, ok: boolean) {
  if (ok) {
    dialog.success({
      title: '批准退款', content: `批准工单 #${r.id}（¥${r.amount}）？`, positiveText: '批准', negativeText: '取消',
      onPositiveClick: async () => {
        const res = await api.put(`refunds/${r.id}/approve`, { approve: true })
        if (res.code === 0) { message.success('已批准'); load() } else message.error(res.message)
      },
    })
  }
  else {
    const note = window.prompt('驳回原因')
    if (note === null) return
    api.put(`refunds/${r.id}/approve`, { approve: false, note }).then((res) => {
      if (res.code === 0) { message.success('已驳回'); load() } else message.error(res.message)
    })
  }
}

function markRefunded(r: any) {
  dialog.warning({
    title: '标记已退款', content: `确认工单 #${r.id} 已在渠道完成退款？`, positiveText: '确认', negativeText: '取消',
    onPositiveClick: async () => {
      const res = await api.put(`refunds/${r.id}/refunded`)
      if (res.code === 0) { message.success('已标记'); load() } else message.error(res.message)
    },
  })
}

function fmt(d?: string) { return d ? d.replace('T', ' ').substring(0, 19) : '—' }
const statusType: Record<number, any> = { 0: 'warning', 1: 'info', 2: 'error', 3: 'success' }

const columns = [
  { title: '#', key: 'id', width: 60 },
  { title: '订单号', key: 'orderId', ellipsis: { tooltip: true } },
  { title: 'UserId', key: 'userId', width: 80 },
  { title: '金额', key: 'amount', width: 90, render: (r: any) => `¥${r.amount}` },
  { title: '原因', key: 'reason', ellipsis: { tooltip: true } },
  { title: '状态', key: 'status', width: 90, render: (r: any) => h(NTag, { size: 'small', type: statusType[r.status] }, { default: () => r.statusText }) },
  { title: '发起', key: 'requestedBy', width: 120 },
  { title: '创建', key: 'createdAt', width: 150, render: (r: any) => fmt(r.createdAt) },
  {
    title: '操作', key: 'a', width: 180,
    render: (r: any) => h(NSpace, { size: 'small' }, {
      default: () => {
        if (!can(P.orderRefundApprove)) return []
        if (r.status === 0) return [
          h(NButton, { size: 'small', type: 'primary', onClick: () => approve(r, true) }, { default: () => '批准' }),
          h(NButton, { size: 'small', type: 'error', onClick: () => approve(r, false) }, { default: () => '驳回' }),
        ]
        if (r.status === 1) return [h(NButton, { size: 'small', type: 'success', onClick: () => markRefunded(r) }, { default: () => '标记已退款' })]
        return []
      },
    }),
  },
]

onMounted(load)
</script>
