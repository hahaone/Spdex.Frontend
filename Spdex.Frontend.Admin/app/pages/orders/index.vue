<template>
  <div>
    <h2 class="mb-4 text-xl font-semibold">订单管理</h2>

    <NSpace class="mb-4" align="center">
      <NInputNumber v-model:value="filter.userId" placeholder="UserId" :show-button="false" style="width:130px" />
      <NSelect v-model:value="filter.channel" :options="channelOpts" clearable placeholder="渠道" style="width:120px" />
      <NSelect v-model:value="filter.status" :options="statusOpts" clearable placeholder="状态" style="width:130px" />
      <NSelect v-model:value="filter.productType" :options="typeOpts" clearable placeholder="类型" style="width:130px" />
      <NDatePicker v-model:value="filter.range" type="daterange" clearable />
      <NButton type="primary" @click="reload">查询</NButton>
    </NSpace>

    <NDataTable remote :columns="columns" :data="rows" :loading="loading" :pagination="pagination" @update:page="onPage" />

    <NModal v-model:show="showDetail" preset="card" title="订单详情" style="width:580px">
      <NDescriptions v-if="detail" :column="2" bordered size="small" label-placement="left">
        <NDescriptionsItem label="订单号" :span="2">{{ detail.orderId }}</NDescriptionsItem>
        <NDescriptionsItem label="UserId">{{ detail.userId }}</NDescriptionsItem>
        <NDescriptionsItem label="类型">{{ detail.productTypeText }}</NDescriptionsItem>
        <NDescriptionsItem label="渠道">{{ detail.channel }}</NDescriptionsItem>
        <NDescriptionsItem label="金额">¥{{ detail.totalFee }}</NDescriptionsItem>
        <NDescriptionsItem label="状态">{{ detail.statusText }}</NDescriptionsItem>
        <NDescriptionsItem label="会籍 RoleId">{{ detail.roleId ?? '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="锦囊数">{{ detail.silkAmount ?? '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="交易号">{{ detail.tradeNo ?? '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="创建">{{ fmt(detail.createTime) }}</NDescriptionsItem>
        <NDescriptionsItem label="支付时间">{{ fmt(detail.paidTime) }}</NDescriptionsItem>
        <NDescriptionsItem label="回调原文" :span="2">
          <NCode :code="detail.notifyRaw || '—'" word-wrap style="max-height:160px;overflow:auto;font-size:12px" />
        </NDescriptionsItem>
      </NDescriptions>
    </NModal>

    <NModal v-model:show="showRefund" preset="card" title="发起退款" style="width:460px">
      <NForm label-placement="left" label-width="84">
        <NFormItem label="订单号"><NInput :value="refundForm.orderId" disabled /></NFormItem>
        <NFormItem label="渠道">
          <span>{{ refundChannelText }}</span>
          <NTag v-if="refundable?.canAutoRefund" size="small" type="success" :bordered="false" class="ml-2">支付宝·审批后可自动退款</NTag>
          <NTag v-else-if="refundable" size="small" :bordered="false" class="ml-2">需人工后台退款</NTag>
        </NFormItem>
        <NFormItem label="可退余额">
          <b>¥{{ refundable?.refundable ?? '—' }}</b>
          <span class="ml-2 text-xs text-gray-400">订单 ¥{{ refundable?.orderTotalFee ?? '—' }}，已退 ¥{{ refundable?.alreadyRefunded ?? 0 }}</span>
        </NFormItem>
        <NFormItem label="退款金额"><NInputNumber v-model:value="refundForm.amount" :min="0.01" :max="refundable?.refundable" :precision="2" style="width:100%" /></NFormItem>
        <NFormItem label="退款原因"><NInput v-model:value="refundForm.reason" type="textarea" :rows="2" placeholder="必填" /></NFormItem>
      </NForm>
      <template #footer><NButton type="primary" :loading="refundSaving" @click="submitRefund">提交退款工单</NButton></template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NSpace, useMessage } from 'naive-ui'
import { P } from '~/utils/permissions'

interface OrderItem {
  orderId: string
  userId: number
  productTypeText: string
  channel: string
  roleId?: number | null
  totalFee: number
  status: number
  statusText: string
  createTime: string
  paidTime?: string | null
}
interface OrderDetailT extends OrderItem {
  productType: number
  stageId?: number | null
  number: number
  dueMonths?: number | null
  silkAmount?: number | null
  subject?: string | null
  tradeNo?: string | null
  notifyRaw?: string | null
  updateTime: string
}

const api = useAdminApi()
const message = useMessage()
const { can } = usePermission()
const rows = ref<OrderItem[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 30, itemCount: 0 })
const filter = reactive<{ userId: number | null, channel: string | null, status: number | null, productType: number | null, range: [number, number] | null }>({
  userId: null, channel: null, status: null, productType: null, range: null,
})

const channelOpts = [{ label: '支付宝', value: 'alipay' }, { label: '微信', value: 'wxcode' }]
const statusOpts = [{ label: '待支付', value: 0 }, { label: '已支付', value: 1 }, { label: '失败/关闭', value: 2 }]
const typeOpts = [{ label: '会员', value: 0 }, { label: '锦囊充值', value: 1 }]

async function load() {
  loading.value = true
  const query: Record<string, unknown> = { page: pagination.page, pageSize: pagination.pageSize }
  if (filter.userId) query.userId = filter.userId
  if (filter.channel) query.channel = filter.channel
  if (filter.status !== null) query.status = filter.status
  if (filter.productType !== null) query.productType = filter.productType
  if (filter.range) {
    query.begin = new Date(filter.range[0]).toISOString()
    query.end = new Date(filter.range[1]).toISOString()
  }
  const res = await api.get<{ items: OrderItem[], total: number }>('orders', query)
  loading.value = false
  if (res.code === 0 && res.data) {
    rows.value = res.data.items
    pagination.itemCount = res.data.total
  }
}
function reload() { pagination.page = 1; load() }
function onPage(p: number) { pagination.page = p; load() }
function parseApiDateTime(d: string) {
  const text = d.trim()
  const isoLike = text.includes('T') ? text : text.replace(' ', 'T')
  const normalized = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(isoLike) ? isoLike : `${isoLike}Z`
  const date = new Date(normalized)
  return Number.isNaN(date.getTime()) ? null : date
}
function pad2(n: number) { return String(n).padStart(2, '0') }
function fmt(d?: string | null) {
  if (!d) return '—'
  const date = parseApiDateTime(d)
  if (!date) return '—'
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}

const showDetail = ref(false)
const detail = ref<OrderDetailT | null>(null)
async function openDetail(orderId: string) {
  const res = await api.get<OrderDetailT>(`orders/${orderId}`)
  if (res.code === 0) { detail.value = res.data; showDetail.value = true }
}

const showRefund = ref(false)
const refundSaving = ref(false)
const refundable = ref<any>(null)
const refundForm = reactive<{ orderId: string, amount: number | null, reason: string }>({ orderId: '', amount: null, reason: '' })
const refundChannelText = computed(() => {
  const c = refundable.value?.channel
  return c === 'alipay' ? '支付宝' : c === 'wxcode' ? '微信' : c === 'yft' ? '易付通' : (c || '—')
})
async function openRefund(r: OrderItem) {
  refundForm.orderId = r.orderId
  refundForm.reason = ''
  refundForm.amount = null
  refundable.value = null
  showRefund.value = true
  const res = await api.get<any>(`refunds/refundable/${r.orderId}`)
  if (res.code === 0 && res.data) { refundable.value = res.data; refundForm.amount = res.data.refundable }
}
async function submitRefund() {
  if (!refundForm.reason.trim()) { message.warning('请填写退款原因'); return }
  if (!refundForm.amount || refundForm.amount <= 0) { message.warning('退款金额无效'); return }
  refundSaving.value = true
  const res = await api.post('refunds', { orderId: refundForm.orderId, reason: refundForm.reason.trim(), amount: refundForm.amount })
  refundSaving.value = false
  if (res.code === 0) { message.success('已发起退款工单'); showRefund.value = false }
  else message.error(res.message)
}

const columns = [
  { title: '订单号', key: 'orderId', width: 180, ellipsis: { tooltip: true } },
  { title: 'UserId', key: 'userId', width: 90 },
  { title: '类型', key: 'productTypeText', width: 90 },
  { title: '渠道', key: 'channel', width: 80 },
  { title: '金额', key: 'totalFee', width: 90, render: (r: OrderItem) => `¥${r.totalFee}` },
  { title: '状态', key: 'statusText', width: 100 },
  { title: '创建', key: 'createTime', width: 160, render: (r: OrderItem) => fmt(r.createTime) },
  {
    title: '操作', key: 'a', width: 140,
    render: (r: OrderItem) => h(NSpace, { size: 'small' }, {
      default: () => {
        const btns = [h(NButton, { size: 'small', onClick: () => openDetail(r.orderId) }, { default: () => '详情' })]
        if (r.status === 1 && can(P.orderRefundRequest))
          btns.push(h(NButton, { size: 'small', type: 'warning', onClick: () => openRefund(r) }, { default: () => '退款' }))
        return btns
      },
    }),
  },
]

onMounted(load)
</script>
