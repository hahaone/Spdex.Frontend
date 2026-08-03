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

      <NTabPane v-if="can(P.aiAuditView)" name="quality" tab="质量监控">
        <NAlert class="mb-4" type="info" title="最近调用样本">
          质量指标从当前加载的最近 {{ audit?.items.length ?? 0 }} 条 append-only 审计记录计算，不作为正式 SLA 账单依据。
        </NAlert>
        <NGrid :cols="4" :x-gap="12" item-responsive class="mb-4">
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="样本调用" :value="qualityTotals.calls" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="失败调用" :value="qualityTotals.failed" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="总体成功率" :value="`${qualityTotals.successRate}%`" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="最慢工具 P95" :value="slowestQuality ? `${slowestQuality.p95Ms} ms` : '—'" /></NCard></NGi>
        </NGrid>
        <NSpace class="mb-3">
          <NButton type="primary" :loading="auditLoading" @click="loadQuality">刷新质量样本</NButton>
        </NSpace>
        <NDataTable
          class="mb-5"
          :columns="qualityColumns"
          :data="qualityRows"
          :loading="auditLoading"
          :row-key="(row: ToolQualityRow) => row.toolName"
          :scroll-x="900"
        />
        <h3 class="mb-3 text-sm font-semibold">错误 Top</h3>
        <NDataTable
          :columns="errorColumns"
          :data="errorRows"
          :loading="auditLoading"
          :pagination="{ pageSize: 10 }"
          :row-key="(row: ErrorSummaryRow) => `${row.toolName}:${row.errorCode}`"
          :scroll-x="700"
        />
      </NTabPane>

      <NTabPane v-if="can(P.aiAuditView)" name="feedback" tab="回答验收">
        <NAlert class="mb-4" type="info" title="回答反馈闭环">
          面向测试与灰度阶段的回答级反馈队列，可按 trace 回查原始调用，并把问题标注到口径校准、展示文案或代码修复。
        </NAlert>
        <NSpace class="mb-3" align="center">
          <NSelect v-model:value="feedbackFilters.status" :options="feedbackStatusOptions" style="width:170px" />
          <NSelect v-model:value="feedbackFilters.feedbackType" :options="feedbackTypeOptions" style="width:150px" />
          <NSelect v-model:value="feedbackFilters.tool" :options="toolFilterOptions" style="width:210px" />
          <NInput v-model:value="feedbackFilters.traceId" clearable placeholder="trace ID" style="width:260px" />
          <NInputNumber v-model:value="feedbackFilters.limit" :min="1" :max="200" style="width:120px" />
          <NButton type="primary" :loading="feedbackLoading" @click="loadFeedback">查询</NButton>
        </NSpace>
        <NCard v-if="can(P.aiOpsManage)" size="small" class="mb-3">
          <NSpace align="center">
            <span class="text-sm text-gray-500">已选 {{ selectedFeedbackRows.length }} 条</span>
            <NButton size="small" :disabled="!selectedFeedbackRows.length" :loading="feedbackReviewSubmitting" @click="batchReviewFeedback('needs_calibration')">批量标记校准</NButton>
            <NButton size="small" :disabled="!selectedFeedbackRows.length" :loading="feedbackReviewSubmitting" @click="batchReviewFeedback('needs_copy_fix')">批量标记文案</NButton>
            <NButton size="small" :disabled="!selectedFeedbackRows.length" :loading="feedbackReviewSubmitting" @click="batchReviewFeedback('needs_code_fix')">批量标记代码</NButton>
            <NButton size="small" type="primary" ghost :disabled="!selectedFeedbackRows.length" :loading="feedbackReviewSubmitting" @click="batchReviewFeedback('verified')">批量验证</NButton>
            <NButton size="small" tertiary :disabled="!selectedFeedbackRows.length" :loading="feedbackReviewSubmitting" @click="batchReviewFeedback('closed')">批量关闭</NButton>
            <NButton size="small" secondary :loading="goldenCandidatesLoading" @click="loadGoldenCandidates">刷新黄金样本候选</NButton>
          </NSpace>
        </NCard>
        <NGrid :cols="4" :x-gap="12" item-responsive class="mb-4">
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="反馈数" :value="feedback?.count ?? 0" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="待处理" :value="feedbackTotals.open" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="需校准" :value="feedbackTotals.calibration" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="正向反馈" :value="feedbackTotals.helpful" /></NCard></NGi>
        </NGrid>
        <NDataTable
          v-model:checked-row-keys="feedbackCheckedKeys"
          :columns="feedbackColumns"
          :data="feedback?.items ?? []"
          :loading="feedbackLoading"
          :pagination="{ pageSize: 20 }"
          :row-key="(row: AiAnswerFeedbackRow) => row.feedbackId"
          :scroll-x="1680"
        />
        <NCard size="small" class="mt-4" title="黄金样本候选">
          <template #header-extra>
            <NButton size="small" :loading="goldenCandidatesLoading" @click="loadGoldenCandidates">刷新</NButton>
          </template>
          <NDataTable
            :columns="goldenCandidateColumns"
            :data="goldenCandidates?.items ?? []"
            :loading="goldenCandidatesLoading"
            :pagination="{ pageSize: 10 }"
            :row-key="(row: AiGoldenSampleCandidateRow) => row.feedbackId"
            :scroll-x="1320"
          />
        </NCard>
      </NTabPane>

      <NTabPane v-if="can(P.aiAuditView)" name="workflow" tab="Workflow 观察">
        <NAlert class="mb-4" type="info" title="H7 workflow trace">
          当前样本中包含 {{ workflowAuditRows.length }} 条 workflow 调用，可从最近 trace 进入完整调用记录。
        </NAlert>
        <NGrid :cols="4" :x-gap="12" item-responsive class="mb-4">
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="Workflow 调用" :value="workflowTotals.calls" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="失败" :value="workflowTotals.failed" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="成功率" :value="`${workflowTotals.successRate}%`" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="最慢 P95" :value="slowestWorkflow ? `${slowestWorkflow.p95Ms} ms` : '—'" /></NCard></NGi>
        </NGrid>
        <NSpace class="mb-3">
          <NButton type="primary" :loading="auditLoading" @click="loadWorkflowSample">刷新 workflow 样本</NButton>
        </NSpace>
        <NDataTable
          :columns="workflowColumns"
          :data="workflowRows"
          :loading="auditLoading"
          :row-key="(row: WorkflowQualityRow) => row.toolName"
          :scroll-x="1250"
        />
      </NTabPane>

      <NTabPane v-if="can(P.aiAuditView)" name="notifications" tab="站内通知">
        <NAlert class="mb-4" type="info" title="In-app provider delivery">
          当前读取 AI in-app adapter 已写入的站内投递记录，payload 仅展示 compact ref。
        </NAlert>
        <NSpace class="mb-3" align="center">
          <NSelect v-model:value="notificationFilters.ownerSubjectType" :options="subjectTypeOptions" style="width:150px" />
          <NInput v-model:value="notificationFilters.ownerSubjectId" clearable placeholder="主体 ID" style="width:180px" />
          <NInput v-model:value="notificationFilters.source" clearable placeholder="source" style="width:230px" />
          <NSelect v-model:value="notificationFilters.unreadOnly" :options="unreadOptions" style="width:130px" />
          <NInputNumber v-model:value="notificationFilters.limit" :min="1" :max="200" style="width:120px" />
          <NButton type="primary" :loading="notificationsLoading" @click="loadInAppNotifications">查询</NButton>
        </NSpace>
        <NGrid :cols="4" :x-gap="12" item-responsive class="mb-4">
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="通知数" :value="notifications?.count ?? 0" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="未读" :value="notificationUnreadCount" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="主体数" :value="notificationSubjectCount" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="最近写入" :value="latestNotification ? fmt(latestNotification.createdAt) : '—'" /></NCard></NGi>
        </NGrid>
        <NDataTable
          :columns="notificationColumns"
          :data="notifications?.items ?? []"
          :loading="notificationsLoading"
          :pagination="{ pageSize: 20 }"
          :row-key="(row: AiInAppNotificationRow) => row.inAppNotificationId"
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

    <NDrawer v-model:show="traceDrawerVisible" :width="900" placement="right">
      <NDrawerContent closable :title="traceDrawerTitle">
        <NSpace class="mb-3" align="center">
          <NInput
            v-model:value="traceId"
            clearable
            placeholder="完整 trace ID"
            style="width:min(520px, 70vw)"
            @keyup.enter="loadTrace"
          />
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
      </NDrawerContent>
    </NDrawer>

    <NModal
      v-model:show="feedbackReviewVisible"
      preset="card"
      :title="feedbackReviewTitle"
      style="width:min(560px, calc(100vw - 32px))"
    >
      <NSpace v-if="feedbackReviewTarget" vertical size="large">
        <NDescriptions :column="1" size="small" bordered>
          <NDescriptionsItem label="回答">{{ feedbackReviewTarget.answerId }}</NDescriptionsItem>
          <NDescriptionsItem label="工具">{{ feedbackReviewTarget.toolName || '—' }}</NDescriptionsItem>
          <NDescriptionsItem label="Trace">{{ feedbackReviewTarget.traceId || '—' }}</NDescriptionsItem>
        </NDescriptions>
        <NForm label-placement="top">
          <NFormItem label="处理状态">
            <NSelect v-model:value="feedbackReviewForm.status" :options="feedbackReviewStatusOptions" />
          </NFormItem>
          <NFormItem label="严重度">
            <NSelect v-model:value="feedbackReviewForm.severity" :options="severityOptions" />
          </NFormItem>
          <NFormItem label="处理备注">
            <NInput
              v-model:value="feedbackReviewForm.reviewReason"
              type="textarea"
              :autosize="{ minRows: 3, maxRows: 6 }"
              placeholder="记录判断依据、下一步处理口径或复核结果"
            />
          </NFormItem>
        </NForm>
      </NSpace>
      <template #footer>
        <NSpace justify="end">
          <NButton :disabled="feedbackReviewSubmitting" @click="feedbackReviewVisible = false">取消</NButton>
          <NButton type="primary" :loading="feedbackReviewSubmitting" @click="submitFeedbackReview">提交</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NTag, NTooltip, useMessage } from 'naive-ui'
import type {
  AiAnswerFeedbackBatchReviewResult,
  AiAnswerFeedbackResult,
  AiAnswerFeedbackRow,
  AiAnswerFeedbackUpdateResult,
  AiAuditResult,
  AiAuditRow,
  AiGoldenSampleCandidateResult,
  AiGoldenSampleCandidateRow,
  AiInAppNotificationResult,
  AiInAppNotificationRow,
  AiUsageResult,
  AiUsageRow,
} from '~/types/admin-ai'
import { aiToolOptions } from '~/types/admin-ai'
import { P } from '~/utils/permissions'

const api = useAdminApi()
const { can } = usePermission()
const message = useMessage()
interface ToolQualityRow {
  toolName: string
  calls: number
  successful: number
  failed: number
  successRate: number
  averageMs: number
  p95Ms: number
  maxMs: number
}
interface ErrorSummaryRow {
  toolName: string
  errorCode: string
  calls: number
  lastSeenUtc: string
}
interface WorkflowQualityRow {
  toolName: string
  label: string
  calls: number
  successful: number
  failed: number
  successRate: number
  averageMs: number
  p95Ms: number
  maxMs: number
  usageUnits: number
  lastSeenUtc: string
  lastTraceId: string
  latestSuccess: boolean
  latestErrorCode: string
}
const route = useRoute()
const routeTraceId = queryString(route.query.traceId)
const activeTab = ref(initialTab())
const range = ref<[number, number]>(defaultRange())
const usage = ref<AiUsageResult | null>(null)
const audit = ref<AiAuditResult | null>(null)
const trace = ref<AiAuditResult | null>(null)
const notifications = ref<AiInAppNotificationResult | null>(null)
const feedback = ref<AiAnswerFeedbackResult | null>(null)
const goldenCandidates = ref<AiGoldenSampleCandidateResult | null>(null)
const usageLoading = ref(false)
const auditLoading = ref(false)
const traceLoading = ref(false)
const notificationsLoading = ref(false)
const feedbackLoading = ref(false)
const goldenCandidatesLoading = ref(false)
const traceDrawerVisible = ref(false)
const feedbackReviewVisible = ref(false)
const feedbackReviewSubmitting = ref(false)
const feedbackReviewTarget = ref<AiAnswerFeedbackRow | null>(null)
const feedbackCheckedKeys = ref<string[]>([])
const traceId = ref(routeTraceId)
const feedbackReviewForm = reactive({
  status: 'reviewing',
  severity: 'medium',
  reviewReason: '',
})

const usageFilters = reactive({
  tool: '',
  subjectType: '',
  subjectId: '',
})
const auditFilters = reactive<{ tool: string, success: '' | 'true' | 'false', limit: number }>({
  tool: '',
  success: '',
  limit: 500,
})
const notificationFilters = reactive<{
  ownerSubjectType: string
  ownerSubjectId: string
  source: string
  unreadOnly: '' | 'true'
  limit: number
}>({
  ownerSubjectType: '',
  ownerSubjectId: '',
  source: '',
  unreadOnly: '',
  limit: 50,
})
const feedbackFilters = reactive<{
  status: string
  feedbackType: string
  tool: string
  traceId: string
  limit: number
}>({
  status: routeTraceId ? '' : 'new',
  feedbackType: '',
  tool: '',
  traceId: routeTraceId,
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
const unreadOptions = [
  { label: '全部状态', value: '' },
  { label: '未读', value: 'true' },
]
const feedbackStatusOptions = [
  { label: '待处理', value: 'new' },
  { label: '全部状态', value: '' },
  { label: '已分诊', value: 'triaged' },
  { label: '处理中', value: 'reviewing' },
  { label: '需口径校准', value: 'needs_calibration' },
  { label: '需代码修复', value: 'needs_code_fix' },
  { label: '需文案调整', value: 'needs_copy_fix' },
  { label: '已验证', value: 'verified' },
  { label: '已关闭', value: 'closed' },
]
const feedbackReviewStatusOptions = feedbackStatusOptions.filter(option => option.value)
const feedbackTypeOptions = [
  { label: '全部类型', value: '' },
  { label: '有帮助', value: 'helpful' },
  { label: '有问题', value: 'issue' },
  { label: '看不懂', value: 'unclear' },
]
const severityOptions = [
  { label: '无', value: 'none' },
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
  { label: '严重', value: 'critical' },
]
const workflowToolOrder = [
  'plan_agent_analysis',
  'run_match_analysis_workflow',
  'run_watchlist_workflow',
  'prepare_monitoring_workflow',
]
const workflowTools = new Set<string>(workflowToolOrder)
const workflowLabels: Record<string, string> = {
  plan_agent_analysis: 'H7A 分析路径规划',
  run_match_analysis_workflow: 'H7B 单场分析 workflow',
  run_watchlist_workflow: 'H7C 观察列表 workflow',
  prepare_monitoring_workflow: 'H7D 观察条件准备',
}

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

const qualityRows = computed<ToolQualityRow[]>(() => {
  const grouped = new Map<string, AiAuditRow[]>()
  for (const row of audit.value?.items ?? []) {
    const rows = grouped.get(row.toolName) ?? []
    rows.push(row)
    grouped.set(row.toolName, rows)
  }
  return [...grouped.entries()]
    .map(([toolName, rows]) => {
      const successful = rows.filter(row => row.success).length
      const elapsed = rows.map(row => row.elapsedMs).sort((a, b) => a - b)
      return {
        toolName,
        calls: rows.length,
        successful,
        failed: rows.length - successful,
        successRate: rows.length ? Math.round((successful / rows.length) * 1000) / 10 : 0,
        averageMs: rows.length ? Math.round(elapsed.reduce((sum, value) => sum + value, 0) / rows.length) : 0,
        p95Ms: percentile(elapsed, 0.95),
        maxMs: elapsed.at(-1) ?? 0,
      }
    })
    .sort((a, b) => b.p95Ms - a.p95Ms)
})
const errorRows = computed<ErrorSummaryRow[]>(() => {
  const grouped = new Map<string, ErrorSummaryRow>()
  for (const row of (audit.value?.items ?? []).filter(item => !item.success)) {
    const errorCode = row.errorCode || 'unknown_error'
    const key = `${row.toolName}:${errorCode}`
    const current = grouped.get(key)
    grouped.set(key, {
      toolName: row.toolName,
      errorCode,
      calls: (current?.calls ?? 0) + 1,
      lastSeenUtc: !current || row.createdAtUtc > current.lastSeenUtc
        ? row.createdAtUtc
        : current.lastSeenUtc,
    })
  }
  return [...grouped.values()].sort((a, b) => b.calls - a.calls)
})
const qualityTotals = computed(() => {
  const calls = qualityRows.value.reduce((sum, row) => sum + row.calls, 0)
  const failed = qualityRows.value.reduce((sum, row) => sum + row.failed, 0)
  return {
    calls,
    failed,
    successRate: calls ? Math.round(((calls - failed) / calls) * 1000) / 10 : 0,
  }
})
const slowestQuality = computed(() => qualityRows.value.at(0) ?? null)
const workflowAuditRows = computed(() => (audit.value?.items ?? []).filter(row => workflowTools.has(row.toolName)))
const workflowRows = computed<WorkflowQualityRow[]>(() => {
  const grouped = new Map<string, AiAuditRow[]>()
  for (const row of workflowAuditRows.value) {
    const rows = grouped.get(row.toolName) ?? []
    rows.push(row)
    grouped.set(row.toolName, rows)
  }
  return [...grouped.entries()]
    .flatMap(([toolName, rows]) => {
      const first = rows[0]
      if (!first) {
        return []
      }
      const successful = rows.filter(row => row.success).length
      const elapsed = rows.map(row => row.elapsedMs).sort((a, b) => a - b)
      const latest = rows.reduce((current, row) =>
        row.createdAtUtc > current.createdAtUtc ? row : current, first)
      return [{
        toolName,
        label: workflowLabels[toolName] ?? toolName,
        calls: rows.length,
        successful,
        failed: rows.length - successful,
        successRate: rows.length ? Math.round((successful / rows.length) * 1000) / 10 : 0,
        averageMs: rows.length ? Math.round(elapsed.reduce((sum, value) => sum + value, 0) / rows.length) : 0,
        p95Ms: percentile(elapsed, 0.95),
        maxMs: elapsed.at(-1) ?? 0,
        usageUnits: rows.reduce((sum, row) => sum + row.usageUnits, 0),
        lastSeenUtc: latest.createdAtUtc,
        lastTraceId: latest.traceId,
        latestSuccess: latest.success,
        latestErrorCode: latest.errorCode || '—',
      }]
    })
    .sort((a, b) => workflowToolOrder.indexOf(a.toolName) - workflowToolOrder.indexOf(b.toolName))
})
const workflowTotals = computed(() => {
  const calls = workflowRows.value.reduce((sum, row) => sum + row.calls, 0)
  const failed = workflowRows.value.reduce((sum, row) => sum + row.failed, 0)
  return {
    calls,
    failed,
    successRate: calls ? Math.round(((calls - failed) / calls) * 1000) / 10 : 0,
  }
})
const slowestWorkflow = computed(() =>
  [...workflowRows.value].sort((a, b) => b.p95Ms - a.p95Ms).at(0) ?? null)
const notificationUnreadCount = computed(() =>
  (notifications.value?.items ?? []).filter(row => !row.readAt).length)
const notificationSubjectCount = computed(() => new Set(
  (notifications.value?.items ?? []).map(row => `${row.owner.subjectType}:${row.owner.subjectId}`),
).size)
const latestNotification = computed(() => notifications.value?.items.at(0) ?? null)
const feedbackTotals = computed(() => {
  const rows = feedback.value?.items ?? []
  const openStatuses = new Set(['new', 'triaged', 'reviewing', 'needs_calibration', 'needs_code_fix', 'needs_copy_fix'])
  return {
    open: rows.filter(row => openStatuses.has(row.status)).length,
    calibration: rows.filter(row => row.status === 'needs_calibration').length,
    helpful: rows.filter(row => row.feedbackType === 'helpful').length,
  }
})
const selectedFeedbackRows = computed(() => {
  const selected = new Set(feedbackCheckedKeys.value)
  return (feedback.value?.items ?? []).filter(row => selected.has(row.feedbackId))
})
const traceDrawerTitle = computed(() => traceId.value ? `Trace ${shortTraceId(traceId.value)}` : 'Trace 回查')
const feedbackReviewTitle = computed(() => {
  const status = feedbackStatusLabel(feedbackReviewForm.status)
  return feedbackReviewTarget.value ? `回答验收：${status}` : '回答验收'
})

function queryString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

function initialTab() {
  const tab = queryString(route.query.tab)
  const allowed = new Set<string>()
  if (can(P.aiUsageView)) allowed.add('usage')
  if (can(P.aiAuditView)) {
    allowed.add('audit')
    allowed.add('quality')
    allowed.add('feedback')
    allowed.add('workflow')
    allowed.add('notifications')
    allowed.add('trace')
  }
  if (can(P.aiBillingReconcile)) allowed.add('billing')
  if (tab && allowed.has(tab)) return tab
  return can(P.aiUsageView) ? 'usage' : 'audit'
}

function shortTraceId(value: string) {
  return value.length > 28 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value
}

function renderTraceButton(value?: string | null) {
  const trace = value?.trim()
  if (!trace) return '—'
  return h(
    NTooltip,
    { trigger: 'hover', placement: 'top' },
    {
      trigger: () => h(
        NButton,
        {
          text: true,
          type: 'primary',
          class: 'trace-id-link',
          title: trace,
          onClick: () => openTraceDrawer(trace),
        },
        { default: () => shortTraceId(trace) },
      ),
      default: () => trace,
    },
  )
}

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
    width: 190,
    render: (row: AiAuditRow) => renderTraceButton(row.traceId),
  },
]
const qualityColumns = [
  { title: '工具', key: 'toolName', width: 220 },
  { title: '调用', key: 'calls', width: 80 },
  { title: '成功', key: 'successful', width: 80 },
  { title: '失败', key: 'failed', width: 80 },
  {
    title: '成功率',
    key: 'successRate',
    width: 100,
    render: (row: ToolQualityRow) => h(
      NTag,
      { type: row.successRate >= 99 ? 'success' : row.successRate >= 95 ? 'warning' : 'error', size: 'small' },
      { default: () => `${row.successRate}%` },
    ),
  },
  { title: '平均耗时', key: 'averageMs', width: 120, render: (row: ToolQualityRow) => `${row.averageMs} ms` },
  { title: 'P95', key: 'p95Ms', width: 110, render: (row: ToolQualityRow) => `${row.p95Ms} ms` },
  { title: '最大耗时', key: 'maxMs', width: 120, render: (row: ToolQualityRow) => `${row.maxMs} ms` },
]
const errorColumns = [
  { title: '错误码', key: 'errorCode', width: 220 },
  { title: '工具', key: 'toolName', width: 220 },
  { title: '次数', key: 'calls', width: 90 },
  { title: '最后发生', key: 'lastSeenUtc', width: 180, render: (row: ErrorSummaryRow) => fmt(row.lastSeenUtc) },
]
const workflowColumns = [
  {
    title: 'Workflow',
    key: 'label',
    width: 260,
    render: (row: WorkflowQualityRow) => h('div', [
      h('div', row.label),
      h('div', { class: 'text-xs text-gray-400' }, row.toolName),
    ]),
  },
  { title: '调用', key: 'calls', width: 80 },
  { title: '成功', key: 'successful', width: 80 },
  { title: '失败', key: 'failed', width: 80 },
  {
    title: '成功率',
    key: 'successRate',
    width: 100,
    render: (row: WorkflowQualityRow) => h(
      NTag,
      { type: row.successRate >= 99 ? 'success' : row.successRate >= 95 ? 'warning' : 'error', size: 'small' },
      { default: () => `${row.successRate}%` },
    ),
  },
  { title: '用量', key: 'usageUnits', width: 80 },
  { title: '平均耗时', key: 'averageMs', width: 120, render: (row: WorkflowQualityRow) => `${row.averageMs} ms` },
  { title: 'P95', key: 'p95Ms', width: 110, render: (row: WorkflowQualityRow) => `${row.p95Ms} ms` },
  { title: '最大耗时', key: 'maxMs', width: 120, render: (row: WorkflowQualityRow) => `${row.maxMs} ms` },
  {
    title: '最近结果',
    key: 'latestSuccess',
    width: 100,
    render: (row: WorkflowQualityRow) => h(
      NTag,
      { type: row.latestSuccess ? 'success' : 'error', size: 'small' },
      { default: () => row.latestSuccess ? '成功' : row.latestErrorCode },
    ),
  },
  { title: '最近调用', key: 'lastSeenUtc', width: 170, render: (row: WorkflowQualityRow) => fmt(row.lastSeenUtc) },
  {
    title: '最近 Trace',
    key: 'lastTraceId',
    width: 190,
    render: (row: WorkflowQualityRow) => renderTraceButton(row.lastTraceId),
  },
]
const notificationColumns = [
  {
    title: '状态',
    key: 'readAt',
    width: 90,
    render: (row: AiInAppNotificationRow) => h(
      NTag,
      { type: row.readAt ? 'default' : 'success', size: 'small' },
      { default: () => row.readAt ? '已读' : '未读' },
    ),
  },
  {
    title: '消息',
    key: 'title',
    width: 320,
    render: (row: AiInAppNotificationRow) => h('div', [
      h('div', row.title || '—'),
      h('div', { class: 'text-xs text-gray-400' }, row.body || '—'),
    ]),
  },
  {
    title: '主体',
    key: 'owner',
    width: 190,
    render: (row: AiInAppNotificationRow) => `${row.owner.subjectType}:${row.owner.subjectId}`,
  },
  {
    title: '来源',
    key: 'source',
    width: 160,
    render: (row: AiInAppNotificationRow) => formatNotificationSource(row.payloadRef?.source || row.source),
  },
  { title: '关联对象', key: 'conditionId', width: 230 },
  { title: '事件/运行', key: 'triggerId', width: 250 },
  {
    title: '状态/类型',
    key: 'payloadRef',
    width: 150,
    render: (row: AiInAppNotificationRow) => formatNotificationKind(row),
  },
  {
    title: '对象',
    key: 'subject',
    width: 160,
    render: (row: AiInAppNotificationRow) => formatNotificationSubject(row),
  },
  {
    title: '事件时间',
    key: 'matchedAt',
    width: 170,
    render: (row: AiInAppNotificationRow) => fmt(row.payloadRef?.matchedAt || row.payloadRef?.completedAt),
  },
  { title: '写入时间', key: 'createdAt', width: 170, render: (row: AiInAppNotificationRow) => fmt(row.createdAt) },
]
const feedbackColumns = [
  ...(can(P.aiOpsManage) ? [{ type: 'selection' as const, width: 48 }] : []),
  {
    title: '类型',
    key: 'feedbackType',
    width: 100,
    render: (row: AiAnswerFeedbackRow) => h(
      NTag,
      { type: feedbackTypeTag(row.feedbackType), size: 'small' },
      { default: () => feedbackTypeLabel(row.feedbackType) },
    ),
  },
  {
    title: '状态',
    key: 'status',
    width: 135,
    render: (row: AiAnswerFeedbackRow) => h(
      NTag,
      { type: feedbackStatusTag(row.status), size: 'small' },
      { default: () => feedbackStatusLabel(row.status) },
    ),
  },
  {
    title: '回答',
    key: 'answerId',
    width: 270,
    render: (row: AiAnswerFeedbackRow) => h('div', [
      h('div', row.answerId),
      h('div', { class: 'text-xs text-gray-400' }, row.questionText || '—'),
    ]),
  },
  {
    title: '工具',
    key: 'toolName',
    width: 220,
    render: (row: AiAnswerFeedbackRow) => h('div', [
      h('div', row.toolName || '—'),
      h('div', { class: 'text-xs text-gray-400' }, [row.preset, row.renderMode].filter(Boolean).join(' / ') || '—'),
    ]),
  },
  {
    title: '问题标签',
    key: 'issueTags',
    width: 260,
    render: (row: AiAnswerFeedbackRow) => row.issueTags.length
      ? row.issueTags.map(feedbackIssueLabel).join('、')
      : '—',
  },
  {
    title: '说明',
    key: 'commentText',
    width: 300,
    render: (row: AiAnswerFeedbackRow) => row.commentText || '—',
  },
  {
    title: '主体',
    key: 'subjectId',
    width: 190,
    render: (row: AiAnswerFeedbackRow) => `${row.subjectType}:${row.subjectId}`,
  },
  { title: '比赛', key: 'matchId', width: 110, render: (row: AiAnswerFeedbackRow) => row.matchId ? `match:${row.matchId}` : '—' },
  { title: '严重度', key: 'severity', width: 100, render: (row: AiAnswerFeedbackRow) => severityLabel(row.severity) },
  { title: '提交时间', key: 'createdAtUtc', width: 170, render: (row: AiAnswerFeedbackRow) => fmt(row.createdAtUtc) },
  {
    title: '处理',
    key: 'actions',
    width: 360,
    fixed: 'right' as const,
    render: (row: AiAnswerFeedbackRow) => can(P.aiOpsManage)
      ? h('div', { class: 'flex flex-wrap gap-1' }, [
          feedbackTraceButton(row),
          feedbackActionButton(row, 'needs_calibration', '校准'),
          feedbackActionButton(row, 'needs_copy_fix', '文案'),
          feedbackActionButton(row, 'needs_code_fix', '代码'),
          feedbackActionButton(row, 'verified', '验证'),
          feedbackActionButton(row, 'closed', '关闭'),
        ])
      : '—',
  },
]
const goldenCandidateColumns = [
  { title: '优先级', key: 'priority', width: 90 },
  {
    title: '候选类型',
    key: 'candidateType',
    width: 150,
    render: (row: AiGoldenSampleCandidateRow) => h(
      NTag,
      { type: goldenCandidateTag(row.candidateType), size: 'small' },
      { default: () => goldenCandidateLabel(row.candidateType) },
    ),
  },
  {
    title: '问题',
    key: 'questionText',
    width: 340,
    render: (row: AiGoldenSampleCandidateRow) => h('div', [
      h('div', row.questionText || '—'),
      h('div', { class: 'text-xs text-gray-400' }, row.candidateReason),
    ]),
  },
  {
    title: '工具',
    key: 'toolName',
    width: 210,
    render: (row: AiGoldenSampleCandidateRow) => h('div', [
      h('div', row.toolName || '—'),
      h('div', { class: 'text-xs text-gray-400' }, row.preset || '—'),
    ]),
  },
  { title: '状态', key: 'status', width: 130, render: (row: AiGoldenSampleCandidateRow) => feedbackStatusLabel(row.status) },
  { title: '严重度', key: 'severity', width: 90, render: (row: AiGoldenSampleCandidateRow) => severityLabel(row.severity) },
  { title: '标签', key: 'issueTags', width: 220, render: (row: AiGoldenSampleCandidateRow) => row.issueTags.length ? row.issueTags.map(feedbackIssueLabel).join('、') : '—' },
  { title: '备注', key: 'reviewReason', width: 260, render: (row: AiGoldenSampleCandidateRow) => row.reviewReason || '—' },
  {
    title: 'Trace',
    key: 'traceId',
    width: 180,
    render: (row: AiGoldenSampleCandidateRow) => renderTraceButton(row.traceId),
  },
  { title: '更新时间', key: 'updatedAtUtc', width: 170, render: (row: AiGoldenSampleCandidateRow) => fmt(row.updatedAtUtc) },
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

async function loadQuality() {
  auditFilters.tool = ''
  auditFilters.success = ''
  auditFilters.limit = 500
  await loadAudit()
}

async function loadWorkflowSample() {
  auditFilters.tool = ''
  auditFilters.success = ''
  auditFilters.limit = 500
  await loadAudit()
}

async function loadInAppNotifications() {
  notificationsLoading.value = true
  const result = await api.get<AiInAppNotificationResult>('ai/notifications/in-app', {
    ownerSubjectType: notificationFilters.ownerSubjectType || undefined,
    ownerSubjectId: notificationFilters.ownerSubjectId.trim() || undefined,
    source: notificationFilters.source.trim() || undefined,
    unreadOnly: notificationFilters.unreadOnly || undefined,
    limit: notificationFilters.limit,
  })
  notificationsLoading.value = false
  if (result.code === 0) notifications.value = result.data
  else message.error(result.message || '站内通知查询失败')
}

async function loadFeedback() {
  feedbackLoading.value = true
  const result = await api.get<AiAnswerFeedbackResult>('ai/feedback/recent', {
    status: feedbackFilters.status || undefined,
    feedbackType: feedbackFilters.feedbackType || undefined,
    tool: feedbackFilters.tool || undefined,
    traceId: feedbackFilters.traceId.trim() || undefined,
    limit: feedbackFilters.limit,
  })
  feedbackLoading.value = false
  if (result.code === 0) feedback.value = result.data
  else message.error(result.message || '回答反馈查询失败')
}

async function loadGoldenCandidates() {
  goldenCandidatesLoading.value = true
  const result = await api.get<AiGoldenSampleCandidateResult>('ai/feedback/golden-candidates', {
    status: feedbackFilters.status || undefined,
    feedbackType: feedbackFilters.feedbackType || undefined,
    tool: feedbackFilters.tool || undefined,
    limit: 50,
  })
  goldenCandidatesLoading.value = false
  if (result.code === 0) goldenCandidates.value = result.data
  else message.error(result.message || '黄金样本候选查询失败')
}

async function submitFeedbackReview() {
  const target = feedbackReviewTarget.value
  if (!target) return
  if (!feedbackReviewForm.status) {
    message.warning('请选择处理状态')
    return
  }

  feedbackReviewSubmitting.value = true
  const result = await api.put<AiAnswerFeedbackUpdateResult>(`ai/feedback/${encodeURIComponent(target.feedbackId)}`, {
    status: feedbackReviewForm.status,
    severity: feedbackReviewForm.severity,
    reviewReason: feedbackReviewForm.reviewReason.trim() || undefined,
  })
  feedbackReviewSubmitting.value = false
  if (result.code !== 0 || !result.data?.feedback) {
    message.error(result.message || '反馈状态更新失败')
    return
  }

  feedbackReviewVisible.value = false
  message.success('反馈状态已更新')
  await loadFeedback()
}

async function batchReviewFeedback(status: string) {
  const feedbackIds = selectedFeedbackRows.value.map(row => row.feedbackId)
  if (!feedbackIds.length) {
    message.warning('请先勾选要处理的反馈')
    return
  }

  feedbackReviewSubmitting.value = true
  const result = await api.post<AiAnswerFeedbackBatchReviewResult>('ai/feedback/batch-review', {
    feedbackIds,
    status,
    severity: inferReviewSeverity(status),
    reviewReason: `后台批量标记为${feedbackStatusLabel(status)}`,
  })
  feedbackReviewSubmitting.value = false
  if (result.code !== 0 || !result.data?.result) {
    message.error(result.message || '批量更新失败')
    return
  }

  const payload = result.data.result
  feedbackCheckedKeys.value = []
  message.success(`已更新 ${payload.updated} 条${payload.failed ? `，失败 ${payload.failed} 条` : ''}`)
  await Promise.allSettled([loadFeedback(), loadGoldenCandidates()])
}

function openFeedbackReview(row: AiAnswerFeedbackRow, status: string) {
  feedbackReviewTarget.value = row
  feedbackReviewForm.status = status
  feedbackReviewForm.severity = row.severity && row.severity !== 'none' ? row.severity : inferReviewSeverity(status)
  feedbackReviewForm.reviewReason = `后台标记为${feedbackStatusLabel(status)}`
  feedbackReviewVisible.value = true
}

function openTraceDrawer(value: string) {
  traceId.value = value
  traceDrawerVisible.value = true
  loadTrace()
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
function percentile(sorted: number[], value: number) {
  if (!sorted.length) return 0
  return sorted[Math.max(0, Math.ceil(sorted.length * value) - 1)] ?? 0
}
function formatNotificationSubject(row: AiInAppNotificationRow) {
  const match = row.payloadRef?.match
  const matchTitle = match?.title
  if (typeof matchTitle === 'string' && matchTitle) return matchTitle
  const directMatchId = match?.match_id ?? match?.matchId
  if (typeof directMatchId === 'number' || typeof directMatchId === 'string') return `赛事 ${directMatchId}`
  const workflow = row.payloadRef?.workflow
  const workflowName = workflow?.name
  if (typeof workflowName === 'string' && workflowName) return workflowName
  const task = row.payloadRef?.task
  const taskName = task?.name
  if (typeof taskName === 'string' && taskName) return taskName
  const subject = row.payloadRef?.subject
  if (!subject) return '—'
  const matchId = subject.match_id ?? subject.matchId
  if (typeof matchId === 'number' || typeof matchId === 'string') return `赛事 ${matchId}`
  const date = subject.date
  if (typeof date === 'string' && date) return date
  return '—'
}
function formatNotificationSource(value?: string | null) {
  const labels: Record<string, string> = {
    spdex_ai_automation: '自动化流程',
    spdex_watch_condition: '观察条件',
  }
  return value ? labels[value] ?? value : '—'
}
function formatNotificationKind(row: AiInAppNotificationRow) {
  const status = row.payloadRef?.status
  if (status) {
    const statusLabels: Record<string, string> = {
      success: '成功',
      partial: '部分完成',
      failed: '失败',
      skipped: '已跳过',
    }
    return statusLabels[status] ?? status
  }
  const value = row.payloadRef?.conditionKind || row.payloadRef?.type
  const labels: Record<string, string> = {
    ai_agent_automation_run_completed: '自动化执行',
    odds_movement: '赔率变化',
    liquidity_shift: '资金变化',
    market_divergence: '市场背离',
    lineup_change: '阵容变化',
  }
  return value ? labels[value] ?? value : '—'
}
function feedbackTypeLabel(value: string) {
  const labels: Record<string, string> = {
    helpful: '有帮助',
    issue: '有问题',
    unclear: '看不懂',
  }
  return labels[value] ?? value
}
function feedbackTypeTag(value: string) {
  if (value === 'helpful') return 'success'
  if (value === 'issue') return 'error'
  return 'warning'
}
function feedbackStatusLabel(value: string) {
  const labels: Record<string, string> = {
    new: '待处理',
    triaged: '已分诊',
    reviewing: '处理中',
    needs_calibration: '需口径校准',
    needs_code_fix: '需代码修复',
    needs_copy_fix: '需文案调整',
    verified: '已验证',
    closed: '已关闭',
  }
  return labels[value] ?? value
}
function feedbackStatusTag(value: string) {
  if (value === 'verified' || value === 'closed') return 'success'
  if (value.startsWith('needs_')) return 'warning'
  if (value === 'new') return 'error'
  return 'info'
}
function feedbackIssueLabel(value: string) {
  const labels: Record<string, string> = {
    wrong_data: '数据不准确',
    missing_critical_context: '缺少关键背景',
    ranking_issue: '排序不合理',
    threshold_issue: '阈值需校准',
    field_name_issue: '字段不清楚',
    prediction_market_gap: '背离解释不足',
    unclear_wording: '表达看不懂',
  }
  return labels[value] ?? value
}
function severityLabel(value: string) {
  const labels: Record<string, string> = {
    none: '无',
    low: '低',
    medium: '中',
    high: '高',
    critical: '严重',
  }
  return labels[value] ?? value
}
function goldenCandidateLabel(value: string) {
  const labels: Record<string, string> = {
    positive_verified: '正向优秀样本',
    needs_calibration: '口径校准样本',
    needs_code_fix: '代码回归样本',
    needs_copy_fix: '文案改写样本',
    calibration_candidate: '待复核样本',
  }
  return labels[value] ?? value
}
function goldenCandidateTag(value: string) {
  if (value === 'positive_verified') return 'success'
  if (value === 'needs_calibration') return 'warning'
  if (value === 'needs_code_fix') return 'error'
  if (value === 'needs_copy_fix') return 'info'
  return 'default'
}
function inferReviewSeverity(status: string) {
  if (status === 'needs_code_fix' || status === 'needs_calibration') return 'medium'
  if (status === 'needs_copy_fix') return 'low'
  return 'none'
}
function feedbackTraceButton(row: AiAnswerFeedbackRow) {
  return h(
    NButton,
    {
      size: 'tiny',
      tertiary: true,
      type: 'primary',
      disabled: !row.traceId,
      onClick: () => openTraceDrawer(row.traceId),
    },
    { default: () => '回查' },
  )
}
function feedbackActionButton(row: AiAnswerFeedbackRow, status: string, label: string) {
  return h(
    NButton,
    {
      size: 'tiny',
      tertiary: true,
      disabled: row.status === status,
      onClick: () => openFeedbackReview(row, status),
    },
    { default: () => label },
  )
}

onMounted(() => {
  if (can(P.aiUsageView)) loadUsage()
  if (can(P.aiAuditView)) {
    loadAudit()
    loadInAppNotifications()
    loadFeedback()
    loadGoldenCandidates()
    if (activeTab.value === 'trace' && traceId.value) {
      loadTrace()
    }
  }
})
</script>

<style scoped>
.trace-id-link {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  vertical-align: middle;
}
</style>
