<template>
  <div>
    <h2 class="mb-4 text-xl font-semibold">会籍纠偏</h2>

    <NTabs v-model:value="activeTab" type="line" animated>
      <NTabPane name="candidates" tab="候选订单">
        <NSpace class="mb-4" align="center">
          <NInputNumber v-model:value="candidateFilter.userId" placeholder="UserId" :show-button="false" style="width:130px" />
          <NInput v-model:value="candidateFilter.orderId" placeholder="订单号" clearable style="width:230px" />
          <NSelect v-model:value="candidateFilter.roleId" :options="roleOptions" clearable placeholder="会籍" style="width:130px" />
          <NSelect v-model:value="candidateFilter.candidateType" :options="candidateTypeOptions" clearable placeholder="类型" style="width:150px" />
          <NSelect v-model:value="candidateFilter.reviewStatus" :options="reviewStatusOptions" clearable placeholder="审核状态" style="width:140px" />
          <NDatePicker v-model:value="candidateFilter.range" type="daterange" clearable />
          <NButton type="primary" @click="reloadCandidates">查询</NButton>
        </NSpace>

        <NDataTable
          remote
          :columns="candidateColumns"
          :data="candidateRows"
          :loading="candidateLoading"
          :pagination="candidatePagination"
          :scroll-x="2600"
          @update:page="onCandidatePage"
        />
      </NTabPane>

      <NTabPane name="records" tab="纠正记录">
        <NSpace class="mb-4" align="center">
          <NInputNumber v-model:value="recordFilter.userId" placeholder="UserId" :show-button="false" style="width:130px" />
          <NInput v-model:value="recordFilter.orderId" placeholder="订单号" clearable style="width:230px" />
          <NDatePicker v-model:value="recordFilter.range" type="daterange" clearable />
          <NButton type="primary" @click="reloadRecords">查询</NButton>
        </NSpace>

        <NDataTable
          remote
          :columns="recordColumns"
          :data="recordRows"
          :loading="recordLoading"
          :pagination="recordPagination"
          :scroll-x="1500"
          @update:page="onRecordPage"
        />
      </NTabPane>
    </NTabs>

    <NModal v-model:show="reviewModal.show" preset="card" title="审核纠偏候选" style="width:860px">
      <NDescriptions v-if="reviewModal.row" :column="2" bordered size="small" label-placement="left" class="mb-4">
        <NDescriptionsItem label="用户">{{ reviewModal.row.userName }} #{{ reviewModal.row.userId }}</NDescriptionsItem>
        <NDescriptionsItem label="类型">{{ reviewModal.row.candidateTypeText }} / {{ reviewModal.row.issueConfidence }}可信</NDescriptionsItem>
        <NDescriptionsItem label="订单号" :span="2">{{ reviewModal.row.orderId }}</NDescriptionsItem>
        <NDescriptionsItem label="购买会籍">{{ reviewModal.row.orderRoleName || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="购买档位">{{ reviewModal.row.stageName || '—' }} / {{ reviewModal.row.stageDays }}天</NDescriptionsItem>
        <NDescriptionsItem label="支付金额">¥{{ reviewModal.row.totalFee }}</NDescriptionsItem>
        <NDescriptionsItem label="支付渠道">{{ reviewModal.row.channel || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="订单创建">{{ fmt(reviewModal.row.createTime) }}</NDescriptionsItem>
        <NDescriptionsItem label="支付时间">{{ fmt(reviewModal.row.paidTime) }}</NDescriptionsItem>
        <NDescriptionsItem label="推断应用">{{ fmt(reviewModal.row.applyAtApprox) }}</NDescriptionsItem>
        <NDescriptionsItem label="支付回调">{{ reviewModal.row.notifyKind || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="原会籍">{{ reviewModal.row.preRoleName || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="原到期">{{ fmt(reviewModal.row.preEndDate) }}</NDescriptionsItem>
        <NDescriptionsItem label="当前会籍">{{ reviewModal.row.currentRoleName || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="当前到期">{{ fmt(reviewModal.row.currentEndDate) }}</NDescriptionsItem>
        <NDescriptionsItem label="建议到期">{{ fmt(reviewModal.row.targetEndDate) }}</NDescriptionsItem>
        <NDescriptionsItem label="超出天数">{{ reviewModal.row.extraDaysVsFixed }}天</NDescriptionsItem>
        <NDescriptionsItem label="支付前状态">{{ reviewModal.row.preStateConfidence }}可信</NDescriptionsItem>
        <NDescriptionsItem label="后台审计">{{ reviewModal.row.hasMembershipAudit ? '有' : '无' }}</NDescriptionsItem>
        <NDescriptionsItem label="问题类型" :span="2">{{ reviewModal.row.issueType }}</NDescriptionsItem>
        <NDescriptionsItem label="原因" :span="2">{{ reviewModal.row.issueReason }}</NDescriptionsItem>
        <NDescriptionsItem v-if="reviewModal.row.reviewNote" label="已有备注" :span="2">{{ reviewModal.row.reviewNote }}</NDescriptionsItem>
        <NDescriptionsItem v-if="reviewModal.row.reviewerName" label="上次审核" :span="2">
          {{ reviewModal.row.reviewerName }} / {{ fmt(reviewModal.row.reviewedAt) }} / {{ reviewModal.row.reviewStatusText }}
        </NDescriptionsItem>
      </NDescriptions>

      <NForm label-placement="left" label-width="90">
        <NFormItem label="审核结论">
          <NSelect v-model:value="reviewForm.status" :options="reviewStatusOptionsForEdit" />
        </NFormItem>
        <NFormItem label="目标到期">
          <NDatePicker v-model:value="reviewForm.targetEndDate" type="datetime" clearable style="width:100%" />
        </NFormItem>
        <NFormItem label="备注">
          <NInput v-model:value="reviewForm.note" type="textarea" :rows="3" placeholder="校对依据、处理意见" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NButton type="primary" :loading="reviewSaving" @click="submitReview">保存审核</NButton>
      </template>
    </NModal>

    <NModal v-model:show="recordDetailModal.show" preset="card" title="纠正记录详情" style="width:840px">
      <NDescriptions v-if="recordDetailModal.row" :column="2" bordered size="small" label-placement="left" class="mb-4">
        <NDescriptionsItem label="时间">{{ fmt(recordDetailModal.row.createdAt) }}</NDescriptionsItem>
        <NDescriptionsItem label="UserId">{{ recordDetailModal.row.userId ?? recordDetailModal.row.targetId ?? '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="订单号" :span="2">{{ recordDetailModal.row.orderId || '—' }}</NDescriptionsItem>
        <NDescriptionsItem label="摘要" :span="2">{{ recordDetailModal.row.summary || '—' }}</NDescriptionsItem>
      </NDescriptions>

      <div class="detail-grid">
        <section>
          <h3>纠正前</h3>
          <pre>{{ prettyJson(recordDetailModal.row?.beforeJson) }}</pre>
        </section>
        <section>
          <h3>纠正后</h3>
          <pre>{{ prettyJson(recordDetailModal.row?.afterJson) }}</pre>
        </section>
      </div>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NSpace, NTag, useMessage } from 'naive-ui'
import { P } from '~/utils/permissions'

interface CandidateItem {
  candidateType: string
  candidateTypeText: string
  executionStatus: string
  userId: number
  userName: string
  orderId: string
  orderRoleId: number
  orderRoleName: string
  stageName: string
  stageDays: number
  totalFee: number
  channel: string
  notifyKind: string
  createTime: string
  paidTime?: string | null
  applyAtApprox: string
  preRoleId?: number | null
  preRoleName?: string | null
  preEndDate?: string | null
  preStateConfidence: string
  targetEndDate: string
  currentRoleId: number
  currentRoleName: string
  currentEndDate?: string | null
  extraDaysVsFixed: number
  hasMembershipAudit: boolean
  issueType: string
  issueConfidence: string
  issueReason: string
  reviewStatus: number
  reviewStatusText: string
  reviewNote?: string | null
  reviewerName?: string | null
  reviewedAt?: string | null
}

interface CorrectionRecord {
  id: number
  adminName: string
  targetId?: string | null
  userId?: number | null
  orderId?: string | null
  summary?: string | null
  beforeJson?: string | null
  afterJson?: string | null
  createdAt: string
}

const api = useAdminApi()
const message = useMessage()
const { can } = usePermission()

const activeTab = ref('candidates')
const roleOptions = [
  { label: '黄金 (10)', value: 10 },
  { label: '翡翠 (11)', value: 11 },
  { label: '专家 (4)', value: 4 },
  { label: '红宝石 (12)', value: 12 },
  { label: '白金 (5)', value: 5 },
]
const candidateTypeOptions = [
  { label: '高可信可执行', value: 'A' },
  { label: '需复核升级多单', value: 'B' },
]
const reviewStatusOptions = [
  { label: '待审核', value: 0 },
  { label: '审核通过', value: 1 },
  { label: '驳回', value: 2 },
  { label: '暂不处理', value: 3 },
]
const reviewStatusOptionsForEdit = reviewStatusOptions.filter(o => o.value !== 0)

const candidateRows = ref<CandidateItem[]>([])
const candidateLoading = ref(false)
const candidatePagination = reactive({ page: 1, pageSize: 30, itemCount: 0 })
const candidateFilter = reactive<{
  userId: number | null
  orderId: string
  roleId: number | null
  candidateType: string | null
  reviewStatus: number | null
  range: [number, number] | null
}>({
  userId: null,
  orderId: '',
  roleId: null,
  candidateType: null,
  reviewStatus: null,
  range: null,
})

const recordRows = ref<CorrectionRecord[]>([])
const recordLoading = ref(false)
const recordPagination = reactive({ page: 1, pageSize: 30, itemCount: 0 })
const recordFilter = reactive<{ userId: number | null, orderId: string, range: [number, number] | null }>({
  userId: null,
  orderId: '',
  range: null,
})

function queryRange(range: [number, number] | null, query: Record<string, unknown>) {
  if (range) {
    query.begin = new Date(range[0]).toISOString()
    query.end = new Date(range[1]).toISOString()
  }
}

async function loadCandidates() {
  candidateLoading.value = true
  const query: Record<string, unknown> = {
    page: candidatePagination.page,
    pageSize: candidatePagination.pageSize,
  }
  if (candidateFilter.userId) query.userId = candidateFilter.userId
  if (candidateFilter.orderId.trim()) query.orderId = candidateFilter.orderId.trim()
  if (candidateFilter.roleId) query.roleId = candidateFilter.roleId
  if (candidateFilter.candidateType) query.candidateType = candidateFilter.candidateType
  if (candidateFilter.reviewStatus !== null) query.reviewStatus = candidateFilter.reviewStatus
  queryRange(candidateFilter.range, query)
  const res = await api.get<{ items: CandidateItem[], total: number }>('membership-corrections/candidates', query)
  candidateLoading.value = false
  if (res.code === 0 && res.data) {
    candidateRows.value = res.data.items
    candidatePagination.itemCount = res.data.total
  }
  else {
    candidateRows.value = []
    message.error(res.message || '加载失败')
  }
}
function reloadCandidates() { candidatePagination.page = 1; loadCandidates() }
function onCandidatePage(p: number) { candidatePagination.page = p; loadCandidates() }

async function loadRecords() {
  recordLoading.value = true
  const query: Record<string, unknown> = { page: recordPagination.page, pageSize: recordPagination.pageSize }
  if (recordFilter.userId) query.userId = recordFilter.userId
  if (recordFilter.orderId.trim()) query.orderId = recordFilter.orderId.trim()
  queryRange(recordFilter.range, query)
  const res = await api.get<{ items: CorrectionRecord[], total: number }>('membership-corrections/records', query)
  recordLoading.value = false
  if (res.code === 0 && res.data) {
    recordRows.value = res.data.items
    recordPagination.itemCount = res.data.total
  }
  else {
    recordRows.value = []
    message.error(res.message || '加载失败')
  }
}
function reloadRecords() { recordPagination.page = 1; loadRecords() }
function onRecordPage(p: number) { recordPagination.page = p; loadRecords() }

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
  if (!date) return d.substring(0, 19).replace('T', ' ')
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
}
function dateValue(d?: string | null) {
  if (!d) return null
  const parsed = parseApiDateTime(d)
  return parsed ? parsed.getTime() : null
}
function reviewTagType(status: number) {
  if (status === 1) return 'success'
  if (status === 2) return 'error'
  if (status === 3) return 'warning'
  return 'default'
}
function candidateTagType(type: string) {
  return type === 'A' ? 'error' : 'warning'
}

const reviewModal = reactive<{ show: boolean, row: CandidateItem | null }>({ show: false, row: null })
const reviewForm = reactive<{ status: number, targetEndDate: number | null, note: string }>({ status: 1, targetEndDate: null, note: '' })
const reviewSaving = ref(false)
const recordDetailModal = reactive<{ show: boolean, row: CorrectionRecord | null }>({ show: false, row: null })

function openReview(row: CandidateItem) {
  reviewModal.row = row
  reviewForm.status = row.reviewStatus && row.reviewStatus !== 0 ? row.reviewStatus : 1
  reviewForm.targetEndDate = dateValue(row.targetEndDate)
  reviewForm.note = row.reviewNote || ''
  reviewModal.show = true
}
async function submitReview() {
  if (!reviewModal.row) return
  reviewSaving.value = true
  const res = await api.put(`membership-corrections/candidates/${reviewModal.row.orderId}/review`, {
    status: reviewForm.status,
    targetEndDate: reviewForm.targetEndDate ? new Date(reviewForm.targetEndDate).toISOString() : null,
    note: reviewForm.note.trim() || null,
  })
  reviewSaving.value = false
  if (res.code === 0) {
    message.success('审核已保存')
    reviewModal.show = false
    loadCandidates()
  }
  else {
    message.error(res.message || '保存失败')
  }
}

function openRecordDetails(row: CorrectionRecord) {
  recordDetailModal.row = row
  recordDetailModal.show = true
}

function prettyJson(value?: string | null) {
  if (!value) return '—'
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  }
  catch {
    return value
  }
}

const candidateColumns = [
  {
    title: '类型', key: 'candidateType', width: 130, fixed: 'left',
    render: (r: CandidateItem) => h(NTag, { type: candidateTagType(r.candidateType), size: 'small' }, { default: () => r.candidateTypeText }),
  },
  {
    title: '审核', key: 'reviewStatus', width: 100, fixed: 'left',
    render: (r: CandidateItem) => h(NTag, { type: reviewTagType(r.reviewStatus), size: 'small' }, { default: () => r.reviewStatusText }),
  },
  { title: 'UserId', key: 'userId', width: 90, fixed: 'left' },
  { title: '用户', key: 'userName', width: 130 },
  { title: '订单号', key: 'orderId', width: 210, ellipsis: { tooltip: true } },
  { title: '会籍', key: 'orderRoleName', width: 110 },
  { title: '档位', key: 'stageName', width: 80 },
  { title: '金额', key: 'totalFee', width: 90, render: (r: CandidateItem) => `¥${r.totalFee}` },
  { title: '支付时间', key: 'paidTime', width: 165, render: (r: CandidateItem) => fmt(r.paidTime) },
  { title: '支付前', key: 'preRoleName', width: 120, render: (r: CandidateItem) => r.preRoleName || '—' },
  { title: '原当前到期', key: 'currentEndDate', width: 165, render: (r: CandidateItem) => fmt(r.currentEndDate) },
  { title: '建议到期', key: 'targetEndDate', width: 165, render: (r: CandidateItem) => fmt(r.targetEndDate) },
  { title: '超出天数', key: 'extraDaysVsFixed', width: 90 },
  { title: '审计命中', key: 'hasMembershipAudit', width: 90, render: (r: CandidateItem) => (r.hasMembershipAudit ? '是' : '否') },
  { title: '原因', key: 'issueReason', width: 360, ellipsis: { tooltip: true } },
  {
    title: '操作', key: 'actions', width: 100, fixed: 'right',
    render: (r: CandidateItem) => can(P.membershipCorrectionReview)
      ? h(NButton, { size: 'small', onClick: () => openReview(r) }, { default: () => '审核' })
      : null,
  },
]

const recordColumns = [
  { title: '时间', key: 'createdAt', width: 170, render: (r: CorrectionRecord) => fmt(r.createdAt) },
  { title: 'UserId', key: 'userId', width: 90, render: (r: CorrectionRecord) => r.userId ?? r.targetId ?? '—' },
  { title: '订单号', key: 'orderId', width: 220, ellipsis: { tooltip: true }, render: (r: CorrectionRecord) => r.orderId || '—' },
  {
    title: '摘要',
    key: 'summary',
    width: 760,
    ellipsis: { tooltip: true },
    render: (r: CorrectionRecord) => h(
      NButton,
      {
        text: true,
        type: 'primary',
        class: 'summary-link',
        onClick: () => openRecordDetails(r),
      },
      { default: () => r.summary || '查看详情' },
    ),
  },
]

watch(activeTab, (tab) => {
  if (tab === 'records' && recordRows.value.length === 0) loadRecords()
})

onMounted(loadCandidates)
</script>

<style scoped>
.detail-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.detail-grid h3 {
  margin: 0 0 8px;
  font-size: 14px;
  font-weight: 600;
}

.detail-grid pre {
  max-height: 360px;
  margin: 0;
  padding: 12px;
  overflow: auto;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #f8fafc;
  color: #1f2937;
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

:deep(.summary-link) {
  max-width: 100%;
  justify-content: flex-start;
  white-space: normal;
  text-align: left;
}
</style>
