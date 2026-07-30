<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold">AI 用量、审计与对账</h2>
        <div class="mt-1 text-xs text-gray-400">UTC 日计量、调用结果与 trace 查询</div>
      </div>
    </div>

    <NTabs v-model:value="activeTab" type="line" animated>
      <NTabPane v-if="can(P.aiUsageView)" name="usage" tab="调用用量">
        <NSpace class="mb-3" align="center">
          <NDatePicker v-model:value="range" type="daterange" clearable />
          <NSelect
            v-model:value="usageFilters.tool"
            :options="toolFilterOptions"
            placeholder="全部工具"
            style="width:210px"
          />
          <NSelect
            v-model:value="usageFilters.subjectType"
            :options="subjectTypeOptions"
            style="width:150px"
          />
          <NInput v-model:value="usageFilters.subjectId" clearable placeholder="主体 ID" style="width:180px" />
          <NButton type="primary" :loading="usageLoading" @click="loadUsage">查询</NButton>
        </NSpace>

        <NAlert
          v-if="usage"
          class="mb-3"
          :type="usage.billable ? 'warning' : 'info'"
          :title="usage.billable ? '可计费数据' : '测试计量，不产生账单'"
        >
          billing mode: {{ usage.billingMode }}
        </NAlert>

        <NGrid :cols="4" :x-gap="12" item-responsive class="mb-4">
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="调用次数" :value="usageTotals.calls" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="成功" :value="usageTotals.success" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="失败" :value="usageTotals.failed" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="用量单位" :value="usageTotals.units" /></NCard></NGi>
        </NGrid>

        <NDataTable
          :columns="usageColumns"
          :data="usage?.items ?? []"
          :loading="usageLoading"
          :pagination="{ pageSize: 25 }"
          :row-key="(row: AiUsageRow) => `${row.dateUtc}:${row.subjectType}:${row.subjectId}:${row.toolName}`"
          :scroll-x="1450"
        />
      </NTabPane>

      <NTabPane v-if="can(P.aiAuditView)" name="audit" tab="调用审计">
        <NSpace class="mb-3" align="center">
          <NSelect v-model:value="auditFilters.tool" :options="toolFilterOptions" style="width:210px" />
          <NSelect v-model:value="auditFilters.success" :options="successOptions" style="width:140px" />
          <NInputNumber v-model:value="auditFilters.limit" :min="1" :max="500" style="width:120px" />
          <NButton type="primary" :loading="auditLoading" @click="loadAudit">查询</NButton>
        </NSpace>

        <NDataTable
          :columns="auditColumns"
          :data="audit?.items ?? []"
          :loading="auditLoading"
          :pagination="{ pageSize: 25 }"
          :row-key="(row: AiAuditRow) => `${row.traceId}:${row.createdAtUtc}`"
          :scroll-x="1450"
        />
      </NTabPane>

      <NTabPane v-if="can(P.aiAuditView)" name="trace" tab="Trace 查询">
        <NSpace class="mb-3" align="center">
          <NInput v-model:value="traceId" clearable placeholder="完整 trace ID" style="width:min(520px, 70vw)" @keyup.enter="loadTrace" />
          <NButton type="primary" :loading="traceLoading" @click="loadTrace">查询</NButton>
        </NSpace>
        <NEmpty v-if="!trace && !traceLoading" description="输入 trace ID 查询完整调用记录" />
        <NDataTable
          v-else
          :columns="auditColumns"
          :data="trace?.items ?? []"
          :loading="traceLoading"
          :row-key="(row: AiAuditRow) => `${row.traceId}:${row.createdAtUtc}`"
          :scroll-x="1450"
        />
      </NTabPane>

      <NTabPane v-if="can(P.aiBillingReconcile)" name="billing" tab="计费对账">
        <NAlert
          class="mb-4"
          :type="usage?.billable ? 'warning' : 'info'"
          :title="usage?.billable ? '账单数据待财务确认' : '当前仅提供非计费预演'"
        >
          导出沿用“调用用量”页的筛选条件与 UTC 聚合结果。
        </NAlert>
        <NGrid :cols="3" :x-gap="12" item-responsive class="mb-4">
          <NGi span="3 700:1"><NCard size="small"><NStatistic label="主体数" :value="billingSubjects" /></NCard></NGi>
          <NGi span="3 700:1"><NCard size="small"><NStatistic label="调用次数" :value="usageTotals.calls" /></NCard></NGi>
          <NGi span="3 700:1"><NCard size="small"><NStatistic label="计量单位" :value="usageTotals.units" /></NCard></NGi>
        </NGrid>
        <NSpace>
          <NButton :loading="usageLoading" @click="loadUsage">刷新预演</NButton>
          <NButton type="primary" :disabled="!usage?.items.length" @click="exportCsv">导出 CSV</NButton>
        </NSpace>
      </NTabPane>
    </NTabs>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NTag, useMessage } from 'naive-ui'
import type { AiAuditResult, AiAuditRow, AiUsageResult, AiUsageRow } from '~/types/admin-ai'
import { aiToolOptions } from '~/types/admin-ai'
import { P } from '~/utils/permissions'

const api = useAdminApi()
const { can } = usePermission()
const message = useMessage()
const activeTab = ref(can(P.aiUsageView) ? 'usage' : 'audit')
const range = ref<[number, number]>(defaultRange())
const usage = ref<AiUsageResult | null>(null)
const audit = ref<AiAuditResult | null>(null)
const trace = ref<AiAuditResult | null>(null)
const usageLoading = ref(false)
const auditLoading = ref(false)
const traceLoading = ref(false)
const traceId = ref('')

const usageFilters = reactive({
  tool: '',
  subjectType: '',
  subjectId: '',
})
const auditFilters = reactive<{ tool: string, success: '' | 'true' | 'false', limit: number }>({
  tool: '',
  success: '',
  limit: 100,
})

const toolFilterOptions = [{ label: '全部工具', value: '' }, ...aiToolOptions]
const subjectTypeOptions = [
  { label: '全部主体', value: '' },
  { label: '企业', value: 'organization' },
  { label: '用户', value: 'user' },
  { label: '内部服务', value: 'internal' },
  { label: '客户端', value: 'client' },
]
const successOptions = [
  { label: '全部结果', value: '' },
  { label: '成功', value: 'true' },
  { label: '失败', value: 'false' },
]

const usageTotals = computed(() => (usage.value?.items ?? []).reduce(
  (total, row) => ({
    calls: total.calls + row.calls,
    success: total.success + row.successfulCalls,
    failed: total.failed + row.failedCalls,
    units: total.units + row.usageUnits,
  }),
  { calls: 0, success: 0, failed: 0, units: 0 },
))

const billingSubjects = computed(() => new Set(
  (usage.value?.items ?? []).map(row => `${row.subjectType}:${row.subjectId}`),
).size)

const usageColumns = [
  { title: 'UTC 日期', key: 'dateUtc', width: 120 },
  {
    title: '主体',
    key: 'subjectId',
    width: 210,
    render: (row: AiUsageRow) => h('div', [
      h('div', row.subjectId),
      h('div', { class: 'text-xs text-gray-400' }, row.subjectType),
    ]),
  },
  { title: '工具', key: 'toolName', width: 210 },
  { title: '调用', key: 'calls', width: 80 },
  { title: '成功', key: 'successfulCalls', width: 80 },
  { title: '失败', key: 'failedCalls', width: 80 },
  { title: '用量', key: 'usageUnits', width: 90 },
  { title: '来源', key: 'principalSource', width: 170, render: (row: AiUsageRow) => row.principalSource || '—' },
  { title: '权益', key: 'entitlementProfile', width: 120, render: (row: AiUsageRow) => row.entitlementProfile || '—' },
  { title: 'AI Client', key: 'aiClientId', width: 150, render: (row: AiUsageRow) => row.aiClientId || '—' },
  { title: '最后调用', key: 'lastSeenUtc', width: 170, render: (row: AiUsageRow) => fmt(row.lastSeenUtc) },
]

const auditColumns = [
  {
    title: '结果',
    key: 'success',
    width: 80,
    render: (row: AiAuditRow) => h(
      NTag,
      { type: row.success ? 'success' : 'error', size: 'small' },
      { default: () => row.success ? '成功' : '失败' },
    ),
  },
  { title: '时间', key: 'createdAtUtc', width: 170, render: (row: AiAuditRow) => fmt(row.createdAtUtc) },
  { title: '工具', key: 'toolName', width: 210 },
  {
    title: '主体',
    key: 'subjectId',
    width: 200,
    render: (row: AiAuditRow) => `${row.subjectType || '—'}:${row.subjectId || '—'}`,
  },
  { title: '耗时', key: 'elapsedMs', width: 90, render: (row: AiAuditRow) => `${row.elapsedMs} ms` },
  { title: '用量', key: 'usageUnits', width: 80 },
  { title: '错误', key: 'errorCode', width: 160, render: (row: AiAuditRow) => row.errorCode || '—' },
  { title: '来源', key: 'principalSource', width: 160, render: (row: AiAuditRow) => row.principalSource || '—' },
  { title: 'AI Client', key: 'aiClientId', width: 150, render: (row: AiAuditRow) => row.aiClientId || '—' },
  {
    title: 'Trace ID',
    key: 'traceId',
    width: 280,
    render: (row: AiAuditRow) => h(
      NButton,
      {
        text: true,
        type: 'primary',
        onClick: () => {
          traceId.value = row.traceId
          activeTab.value = 'trace'
          loadTrace()
        },
      },
      { default: () => row.traceId },
    ),
  },
]

async function loadUsage() {
  usageLoading.value = true
  const result = await api.get<AiUsageResult>('ai/usage/daily', {
    from: range.value ? toYmd(range.value[0]) : undefined,
    to: range.value ? toYmd(range.value[1]) : undefined,
    tool: usageFilters.tool || undefined,
    subjectType: usageFilters.subjectType || undefined,
    subjectId: usageFilters.subjectId.trim() || undefined,
    limit: 500,
  })
  usageLoading.value = false
  if (result.code === 0) usage.value = result.data
  else message.error(result.message || '用量查询失败')
}

async function loadAudit() {
  auditLoading.value = true
  const result = await api.get<AiAuditResult>('ai/audit/recent', {
    tool: auditFilters.tool || undefined,
    success: auditFilters.success || undefined,
    limit: auditFilters.limit,
  })
  auditLoading.value = false
  if (result.code === 0) audit.value = result.data
  else message.error(result.message || '审计查询失败')
}

async function loadTrace() {
  const value = traceId.value.trim()
  if (!value) {
    message.warning('请输入 trace ID')
    return
  }
  traceLoading.value = true
  trace.value = null
  const result = await api.get<AiAuditResult>(`ai/audit/traces/${encodeURIComponent(value)}`, { limit: 200 })
  traceLoading.value = false
  if (result.code === 0) trace.value = result.data
  else message.error(result.message || '未找到该 trace')
}

function exportCsv() {
  if (!usage.value?.items.length) return
  const columns = [
    'dateUtc', 'subjectType', 'subjectId', 'toolName', 'calls',
    'successfulCalls', 'failedCalls', 'usageUnits', 'principalSource',
    'entitlementProfile', 'aiClientId', 'firstSeenUtc', 'lastSeenUtc',
  ] as const
  const rows = [
    columns.join(','),
    ...usage.value.items.map(row => columns.map(key => csv(row[key])).join(',')),
  ]
  const blob = new Blob([`\uFEFF${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `spdex-ai-usage-${toYmd(range.value[0])}-${toYmd(range.value[1])}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function csv(value: unknown) {
  const text = value == null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}
function defaultRange(): [number, number] {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - 6)
  return [start.getTime(), end.getTime()]
}
function toYmd(value: number) {
  const date = new Date(value)
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
function fmt(value?: string | null) {
  return value ? value.substring(0, 19).replace('T', ' ') : '—'
}

onMounted(() => {
  if (can(P.aiUsageView)) loadUsage()
  if (can(P.aiAuditView)) loadAudit()
})
</script>
