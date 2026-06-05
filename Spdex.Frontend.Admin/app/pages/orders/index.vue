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
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton } from 'naive-ui'

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

const columns = [
  { title: '订单号', key: 'orderId', width: 180, ellipsis: { tooltip: true } },
  { title: 'UserId', key: 'userId', width: 90 },
  { title: '类型', key: 'productTypeText', width: 90 },
  { title: '渠道', key: 'channel', width: 80 },
  { title: '金额', key: 'totalFee', width: 90, render: (r: OrderItem) => `¥${r.totalFee}` },
  { title: '状态', key: 'statusText', width: 100 },
  { title: '创建', key: 'createTime', width: 160, render: (r: OrderItem) => fmt(r.createTime) },
  { title: '操作', key: 'a', width: 80, render: (r: OrderItem) => h(NButton, { size: 'small', onClick: () => openDetail(r.orderId) }, { default: () => '详情' }) },
]

onMounted(load)
</script>
