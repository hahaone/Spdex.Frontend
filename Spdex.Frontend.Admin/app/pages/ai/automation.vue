<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold">AI Agent 自动化</h2>
        <div class="mt-1 text-xs text-gray-400">用户保存流程、自动运行记录与后台启停管控</div>
      </div>
      <NSpace>
        <NButton :loading="loadingAny" @click="loadAll">刷新</NButton>
      </NSpace>
    </div>

    <NAlert class="mb-4" type="info" title="测试期观察面板">
      当前用于测试环境和灰度用户的自动化任务观测；后台启停只影响自动运行，不删除用户保存的流程。
    </NAlert>

    <NGrid :cols="5" :x-gap="12" :y-gap="12" item-responsive class="mb-4">
      <NGi span="5 760:1">
        <NCard size="small">
          <NStatistic label="任务总数" :value="summary?.summary.taskCount ?? '—'" />
        </NCard>
      </NGi>
      <NGi span="5 760:1">
        <NCard size="small">
          <NStatistic label="启用任务" :value="summary?.summary.enabledTaskCount ?? '—'" />
        </NCard>
      </NGi>
      <NGi span="5 760:1">
        <NCard size="small">
          <NStatistic label="最近运行" :value="summary?.summary.runCount ?? '—'" />
        </NCard>
      </NGi>
      <NGi span="5 760:1">
        <NCard size="small">
          <NStatistic label="失败 / 跳过" :value="failureLabel" />
        </NCard>
      </NGi>
      <NGi span="5 760:1">
        <NCard size="small">
          <NStatistic label="用量单位" :value="summary?.summary.toolUsageUnits ?? '—'" />
        </NCard>
      </NGi>
    </NGrid>

    <NCard title="成本与质量看板" size="small" class="mb-4">
      <template #header-extra>
        <NSpace size="small" align="center">
          <span class="text-xs text-gray-400">
            {{ insights ? `最近 ${insights.windowDays} 天 · 样本 ${insights.sampleLimit}` : '最近 30 天' }}
          </span>
          <NButton size="tiny" secondary @click="showOpsThresholds = !showOpsThresholds">
            阈值设置
          </NButton>
          <NButton size="tiny" :loading="insightsLoading" @click="loadInsights">刷新看板</NButton>
        </NSpace>
      </template>

      <NSpin :show="insightsLoading">
        <NEmpty v-if="!insights && !insightsLoading" description="暂无自动化成本与质量数据" />
        <div v-else-if="insights" class="ops-dashboard">
          <NAlert
            v-if="insightAlert"
            class="mb-3"
            :type="insightAlert.type"
            :title="insightAlert.title"
          >
            {{ insightAlert.description }}
          </NAlert>

          <section class="ops-summary-panel">
            <div>
              <h3>运营摘要</h3>
              <p>{{ opsSummaryText }}</p>
            </div>
            <NTag size="small" :type="opsThresholdAlerts.length ? 'warning' : 'success'">
              {{ opsThresholdAlerts.length ? `${opsThresholdAlerts.length} 个阈值提醒` : '阈值正常' }}
            </NTag>
          </section>

          <div v-if="opsThresholdAlerts.length" class="ops-alert-list">
            <NAlert
              v-for="item in opsThresholdAlerts"
              :key="item.title"
              :type="item.level"
              :title="item.title"
            >
              {{ item.description }}
            </NAlert>
          </div>

          <section v-if="showOpsThresholds" class="ops-threshold-panel">
            <div class="ops-panel-head">
              <h3>告警阈值</h3>
              <span>本页即时生效，用于测试期运营判读</span>
            </div>
            <NGrid :cols="5" :x-gap="10" :y-gap="10" item-responsive>
              <NGi span="5 760:1">
                <NInputNumber v-model:value="opsThresholds.failureRate" :min="0" :max="100" size="small">
                  <template #prefix>失败率</template>
                  <template #suffix>%</template>
                </NInputNumber>
              </NGi>
              <NGi span="5 760:1">
                <NInputNumber v-model:value="opsThresholds.partialRate" :min="0" :max="100" size="small">
                  <template #prefix>部分完成</template>
                  <template #suffix>%</template>
                </NInputNumber>
              </NGi>
              <NGi span="5 760:1">
                <NInputNumber v-model:value="opsThresholds.notificationFailed" :min="0" :max="500" size="small">
                  <template #prefix>失败通知</template>
                  <template #suffix>条</template>
                </NInputNumber>
              </NGi>
              <NGi span="5 760:1">
                <NInputNumber v-model:value="opsThresholds.budgetUsageRate" :min="0" :max="100" size="small">
                  <template #prefix>预算使用</template>
                  <template #suffix>%</template>
                </NInputNumber>
              </NGi>
              <NGi span="5 760:1">
                <NInputNumber v-model:value="opsThresholds.openFeedback" :min="0" :max="1000" size="small">
                  <template #prefix>待验收</template>
                  <template #suffix>条</template>
                </NInputNumber>
              </NGi>
            </NGrid>
          </section>

          <div class="ops-metric-grid">
            <section class="ops-metric">
              <span>AI 用量</span>
              <strong>{{ insights.cost.toolUsageUnits }}</strong>
              <small>
                平均 {{ decimalLabel(insights.cost.averageUnitsPerRun) }} 单位 / 次 · 预计月用量 {{ insights.cost.estimatedMonthlyUnits }}
              </small>
            </section>
            <section class="ops-metric">
              <span>预算覆盖</span>
              <strong>{{ percentLabel(insights.cost.monthlyBudgetUsageRate) }}</strong>
              <small>
                {{ insights.cost.budgetedTaskCount }} 个任务有预算 · 剩余 {{ insights.cost.monthlyUnitBudgetRemaining }} / {{ insights.cost.monthlyUnitBudgetTotal || '不限' }}
              </small>
            </section>
            <section class="ops-metric">
              <span>运行质量</span>
              <strong>{{ percentLabel(insights.quality.failureRate) }}</strong>
              <small>
                失败率 · 部分完成 {{ percentLabel(insights.quality.partialRate) }} · 重试 {{ percentLabel(insights.quality.retryRate) }}
              </small>
            </section>
            <section class="ops-metric">
              <span>回答验收</span>
              <strong>{{ insights.quality.openFeedbackCount }}</strong>
              <small>
                待处理 · 问题反馈率 {{ percentLabel(insights.quality.feedbackIssueRate) }} · 已验证 {{ insights.quality.verifiedFeedbackCount }}
              </small>
            </section>
            <section class="ops-metric">
              <span>通知健康</span>
              <strong>{{ insights.notifications.failedCount }}</strong>
              <small>
                失败 · 待投递 {{ notificationPendingTotal }} · 未读站内 {{ insights.notifications.unreadInAppNotificationCount }}
              </small>
            </section>
          </div>

          <div class="ops-dashboard-grid">
            <section class="ops-panel">
              <div class="ops-panel-head">
                <h3>运行结果分布</h3>
                <span>{{ insights.summary.runCount }} 次</span>
              </div>
              <div class="status-bars">
                <div v-for="bucket in insights.statusBuckets" :key="bucket.status" class="status-bar-row">
                  <span>{{ statusLabel(bucket.status) }}</span>
                  <div class="status-bar-track">
                    <i :class="`status-bar-fill status-${bucket.status}`" :style="{ width: percentStyle(bucket.rate) }" />
                  </div>
                  <b>{{ bucket.count }}</b>
                </div>
              </div>
            </section>

            <section class="ops-panel">
              <div class="ops-panel-head">
                <h3>每日用量</h3>
                <span>{{ insights.dailyUsage.length }} 天</span>
              </div>
              <div class="usage-bars">
                <div v-for="point in compactDailyUsage" :key="point.dateUtc" class="usage-bar-row">
                  <span>{{ point.dateUtc.slice(5) }}</span>
                  <div class="usage-bar-track">
                    <i :style="{ width: usageBarWidth(point.toolUsageUnits) }" />
                  </div>
                  <b>{{ point.toolUsageUnits }}</b>
                </div>
              </div>
            </section>
          </div>

          <section class="ops-panel">
            <div class="ops-panel-head">
              <h3>风险任务</h3>
              <span>{{ insights.riskTasks.length }} 个</span>
            </div>
            <NEmpty v-if="!insights.riskTasks.length" description="当前没有需要优先处置的自动化任务" />
            <div v-else class="risk-list">
              <article v-for="row in insights.riskTasks" :key="row.taskId" class="risk-row">
                <div>
                  <NTag size="small" :type="riskTagType(row.riskLevel)">
                    {{ riskLevelLabel(row.riskLevel) }}
                  </NTag>
                  <b>{{ row.name }}</b>
                  <p>{{ row.riskReason }}</p>
                </div>
                <div class="risk-meta">
                  <span>{{ subjectTypeLabel(row.subjectType) }} {{ row.subjectId }}</span>
                  <span>{{ row.runCount }} 次 · 失败 {{ row.failedRunCount }} · 部分 {{ row.partialRunCount }} · 跳过 {{ row.skippedRunCount }}</span>
                  <span>用量 {{ row.toolUsageUnits }}{{ row.monthlyUnitBudget ? ` / ${row.monthlyUnitBudget}` : '' }}</span>
                </div>
                <NSpace size="small">
                  <NButton size="tiny" secondary @click="inspectRiskTask(row)">查看运行</NButton>
                  <NButton
                    size="tiny"
                    secondary
                    @click="openFeedbackDashboard"
                  >
                    验收中心
                  </NButton>
                </NSpace>
              </article>
            </div>
          </section>
        </div>
      </NSpin>
    </NCard>

    <NCard title="通知 Provider 演练与失败队列" size="small" class="mb-4">
      <template #header-extra>
        <NSpace size="small" align="center">
          <span class="text-xs text-gray-400">
            {{ outbox?.count ?? 0 }} 条通知 · 不展示原始 payload
          </span>
          <NButton size="tiny" :loading="outboxLoading" @click="loadOutbox">刷新队列</NButton>
        </NSpace>
      </template>

      <NAlert class="mb-3" type="info" title="测试期 provider 演练">
        当前 P5 仅演练站内消息；邮件和 Webhook 外部投递暂缓。失败通知可从队列中手动加入重试。
      </NAlert>

      <NSpace class="mb-3" align="center" :wrap="true">
        <NSelect
          v-model:value="outboxFilters.ownerSubjectType"
          :options="subjectTypeOptions"
          placeholder="主体类型"
          style="width:150px"
        />
        <NInput v-model:value="outboxFilters.ownerSubjectId" clearable placeholder="主体 ID" style="width:180px" />
        <NInput v-model:value="outboxFilters.source" clearable placeholder="来源" style="width:220px" />
        <NSelect
          v-model:value="outboxFilters.status"
          :options="notificationStatusOptions"
          placeholder="通知状态"
          style="width:150px"
        />
        <NSelect
          v-model:value="outboxFilters.channel"
          :options="notificationChannelOptions"
          placeholder="通道"
          style="width:150px"
        />
        <NInputNumber v-model:value="outboxFilters.limit" :min="1" :max="500" style="width:120px" />
        <NButton type="primary" :loading="outboxLoading" @click="loadOutbox">查询队列</NButton>
      </NSpace>

      <section class="provider-drill-panel">
        <NSelect
          v-model:value="providerDrillForm.channel"
          :options="providerDrillChannelOptions"
          placeholder="演练通道"
          style="width:150px"
        />
        <NSelect
          v-model:value="providerDrillForm.status"
          :options="providerDrillStatusOptions"
          placeholder="样本状态"
          style="width:160px"
        />
        <NSelect
          v-model:value="providerDrillForm.ownerSubjectType"
          :options="subjectTypeOptions.filter(item => item.value)"
          placeholder="主体类型"
          style="width:150px"
        />
        <NInput v-model:value="providerDrillForm.ownerSubjectId" clearable placeholder="主体 ID" style="width:190px" />
        <NCheckbox v-model:checked="providerDrillForm.deliverNow">立即投递</NCheckbox>
        <NButton
          type="warning"
          secondary
          :loading="providerDrillLoading"
          :disabled="!can(P.aiOpsManage)"
          @click="runProviderDrill"
        >
          运行演练
        </NButton>
      </section>

      <NDataTable
        :columns="outboxColumns"
        :data="outboxRows"
        :loading="outboxLoading"
        :pagination="{ pageSize: 10 }"
        :row-key="(row: AiNotificationOutboxRow) => row.notificationId"
        :scroll-x="1320"
      />
    </NCard>

    <NCard title="异常任务队列" size="small" class="mb-4">
      <template #header-extra>
        <NSpace size="small" align="center">
          <span class="text-xs text-gray-400">
            failed / skipped / partial · {{ abnormalRuns.length }} 条
          </span>
          <NButton size="tiny" :loading="abnormalLoading" @click="loadAbnormalRuns">刷新异常</NButton>
        </NSpace>
      </template>

      <NAlert
        class="mb-3"
        :type="abnormalRuns.length ? 'warning' : 'success'"
        :title="abnormalRuns.length ? '存在需要复核的自动化运行' : '当前异常队列为空'"
      >
        失败通常需要排查服务或工具链；跳过多与每日运行上限、预算门禁、任务暂停或调度演练模式有关。
      </NAlert>

      <NDataTable
        :columns="abnormalColumns"
        :data="abnormalRuns"
        :loading="abnormalLoading"
        :pagination="{ pageSize: 10 }"
        :row-key="(row: AiAgentAutomationRunRow) => row.runId"
        :scroll-x="1350"
      />
    </NCard>

    <NCard title="自动化任务" size="small" class="mb-4">
      <template #header-extra>
        <span class="text-xs text-gray-400">
          {{ tasks?.count ?? 0 }} 个结果 · {{ summaryWindowLabel }}
        </span>
      </template>

      <NSpace class="mb-3" align="center">
        <NSelect
          v-model:value="taskFilters.subjectType"
          :options="subjectTypeOptions"
          placeholder="主体类型"
          style="width:150px"
        />
        <NInput v-model:value="taskFilters.subjectId" clearable placeholder="主体 ID" style="width:180px" />
        <NSelect
          v-model:value="taskFilters.status"
          :options="taskStatusOptions"
          placeholder="运行状态"
          style="width:160px"
        />
        <NSelect
          v-model:value="taskFilters.enabled"
          :options="enabledOptions"
          placeholder="启用状态"
          style="width:140px"
        />
        <NInputNumber v-model:value="taskFilters.limit" :min="1" :max="500" style="width:120px" />
        <NButton type="primary" :loading="tasksLoading" @click="loadTasks">查询</NButton>
      </NSpace>

      <NDataTable
        :columns="taskColumns"
        :data="tasks?.items ?? []"
        :loading="tasksLoading"
        :pagination="{ pageSize: 20 }"
        :row-key="(row: AiAgentAutomationTaskRow) => row.taskId"
        :scroll-x="1320"
      />
    </NCard>

    <NCard title="最近运行记录" size="small">
      <template #header-extra>
        <span class="text-xs text-gray-400">{{ runs?.count ?? 0 }} 条结果</span>
      </template>

      <NSpace class="mb-3" align="center">
        <NInput v-model:value="runFilters.taskId" clearable placeholder="任务 ID" style="width:260px" />
        <NSelect
          v-model:value="runFilters.subjectType"
          :options="subjectTypeOptions"
          placeholder="主体类型"
          style="width:150px"
        />
        <NInput v-model:value="runFilters.subjectId" clearable placeholder="主体 ID" style="width:180px" />
        <NSelect
          v-model:value="runFilters.status"
          :options="runStatusOptions"
          placeholder="运行状态"
          style="width:160px"
        />
        <NSelect
          v-model:value="runFilters.triggerSource"
          :options="triggerSourceOptions"
          placeholder="触发来源"
          style="width:160px"
        />
        <NInputNumber v-model:value="runFilters.limit" :min="1" :max="500" style="width:120px" />
        <NButton type="primary" :loading="runsLoading" @click="loadRuns">查询</NButton>
      </NSpace>

      <NDataTable
        :columns="runColumns"
        :data="runs?.items ?? []"
        :loading="runsLoading"
        :pagination="{ pageSize: 25 }"
        :row-key="(row: AiAgentAutomationRunRow) => row.runId"
        :scroll-x="1450"
      />
    </NCard>

    <NDrawer v-model:show="traceDrawerVisible" :width="920" placement="right">
      <NDrawerContent closable :title="traceDrawerTitle">
        <NSpace class="mb-3" align="center">
          <NInput
            v-model:value="traceId"
            clearable
            placeholder="完整 trace ID"
            style="width:min(520px, 70vw)"
            @keyup.enter="loadTrace"
          />
          <NButton type="primary" :loading="traceLoading" @click="loadTrace">回查 Trace</NButton>
          <NButton :disabled="!traceId.trim()" @click="openFeedbackCenter(traceId)">打开回答验收</NButton>
        </NSpace>
        <NEmpty v-if="!trace && !traceLoading" description="输入或点击运行记录中的 trace ID 进行回查" />
        <NDataTable
          v-else
          :columns="traceColumns"
          :data="trace?.items ?? []"
          :loading="traceLoading"
          :row-key="(row: AiAuditRow) => `${row.traceId}:${row.createdAtUtc}`"
          :scroll-x="1350"
        />
      </NDrawerContent>
    </NDrawer>

    <NDrawer v-model:show="detailDrawerVisible" :width="960" placement="right">
      <NDrawerContent closable :title="detailDrawerTitle">
        <NSpin :show="detailLoading">
          <NEmpty v-if="!runDetail && !detailLoading" description="请选择一条运行记录查看详情" />
          <div v-else-if="runDetail" class="run-detail">
            <section class="run-detail-hero">
              <div>
                <NTag size="small" :type="statusTagType(runDetail.run.status)">
                  {{ statusLabel(runDetail.run.status) }}
                </NTag>
                <h3>{{ runDetail.task?.name || runDetail.run.workflowId }}</h3>
                <p>{{ runDetail.task?.description || runDetail.run.taskId }}</p>
              </div>
              <NSpace align="center">
                <NButton
                  size="small"
                  secondary
                  type="primary"
                  :disabled="!runDetail.run.traceId"
                  @click="openTraceDrawer(runDetail.run.traceId)"
                >
                  Trace 回查
                </NButton>
                <NButton
                  size="small"
                  secondary
                  :disabled="!runDetail.run.traceId"
                  @click="openFeedbackCenter(runDetail.run.traceId)"
                >
                  回答验收
                </NButton>
                <NPopconfirm
                  :disabled="!can(P.aiOpsManage) || !runDetail.retry.eligible"
                  @positive-click="retryAutomationRun(runDetail.run)"
                >
                  <template #trigger>
                    <NButton
                      size="small"
                      type="warning"
                      secondary
                      :loading="retryingRunId === runDetail.run.runId"
                      :disabled="!can(P.aiOpsManage) || !runDetail.retry.eligible"
                    >
                      重试任务
                    </NButton>
                  </template>
                  重试会重新调用 AI Agent，并再次执行预算和次数门禁。
                </NPopconfirm>
              </NSpace>
            </section>

            <NAlert
              class="mt-3"
              :type="runDetail.retry.eligible ? 'warning' : 'info'"
              :title="runDetail.retry.eligible ? '可手动重试' : '当前不建议重试'"
            >
              {{ runDetail.retry.reason }}
            </NAlert>

            <NGrid :cols="4" :x-gap="12" :y-gap="12" item-responsive class="mt-3">
              <NGi span="4 720:1">
                <NCard size="small">
                  <NStatistic label="步骤完成" :value="`${runDetail.run.completedStepCount} / ${runDetail.run.stepCount}`" />
                </NCard>
              </NGi>
              <NGi span="4 720:1">
                <NCard size="small">
                  <NStatistic label="用量单位" :value="runDetail.run.toolUsageUnits" />
                </NCard>
              </NGi>
              <NGi span="4 720:1">
                <NCard size="small">
                  <NStatistic label="耗时" :value="durationLabel(runDetail.run.durationMs)" />
                </NCard>
              </NGi>
              <NGi span="4 720:1">
                <NCard size="small">
                  <NStatistic label="触发来源" :value="triggerSourceLabel(runDetail.run.triggerSource)" />
                </NCard>
              </NGi>
            </NGrid>

            <NDescriptions class="mt-4" label-placement="left" :column="2" bordered size="small">
              <NDescriptionsItem label="运行 ID">{{ runDetail.run.runId }}</NDescriptionsItem>
              <NDescriptionsItem label="任务 ID">{{ runDetail.run.taskId }}</NDescriptionsItem>
              <NDescriptionsItem label="主体">{{ subjectTypeLabel(runDetail.run.subjectType) }} {{ runDetail.run.subjectId }}</NDescriptionsItem>
              <NDescriptionsItem label="流程">{{ runDetail.workflowRun?.workflowName || runDetail.run.workflowId }}</NDescriptionsItem>
              <NDescriptionsItem label="比赛">{{ runDetail.workflowRun?.matchTitle || runDetail.task?.matchTitle || '—' }}</NDescriptionsItem>
              <NDescriptionsItem label="开始时间">{{ fmt(runDetail.run.startedAtUtc) }}</NDescriptionsItem>
              <NDescriptionsItem label="完成时间">{{ fmt(runDetail.run.completedAtUtc) }}</NDescriptionsItem>
              <NDescriptionsItem label="创建时间">{{ fmt(runDetail.run.createdAtUtc) }}</NDescriptionsItem>
            </NDescriptions>

            <NAlert v-if="runDetail.run.errorMessage" class="mt-4" type="warning" title="失败或跳过原因">
              {{ runDetail.run.errorMessage }}
            </NAlert>
            <NAlert v-if="runDetail.taskError" class="mt-4" type="error" title="关联任务不可用">
              {{ runDetail.taskError.message || runDetail.taskError.code }}
            </NAlert>

            <section class="mt-5">
              <div class="mb-2 flex items-center justify-between">
                <h3 class="text-base font-semibold">流程步骤</h3>
                <span class="text-xs text-gray-400">{{ runDetail.steps.length }} 个步骤</span>
              </div>
              <NEmpty v-if="!runDetail.steps.length" description="这条运行没有保存步骤明细。dry-run、预算门禁跳过或旧记录通常不会生成步骤。" />
              <div v-else class="step-timeline">
                <article v-for="step in runDetail.steps" :key="`${runDetail.run.runId}:${step.stepId}`" class="step-card">
                  <div class="step-card-head">
                    <div>
                      <NTag size="small" :type="statusTagType(step.status)">
                        {{ statusLabel(step.status) }}
                      </NTag>
                      <b>{{ step.title }}</b>
                    </div>
                    <NSpace size="small">
                      <span>{{ step.toolUsageUnits }} 单位</span>
                      <span>{{ durationLabel(step.durationMs) }}</span>
                    </NSpace>
                  </div>
                  <p>{{ step.question || '—' }}</p>
                  <div class="step-card-meta">
                    <span>{{ presetLabel(step.preset) }}</span>
                    <button
                      v-if="step.traceId"
                      type="button"
                      class="step-link"
                      @click="openTraceDrawer(step.traceId)"
                    >
                      {{ shortTraceId(step.traceId) }}
                    </button>
                    <span v-if="step.errorMessage">{{ step.errorMessage }}</span>
                  </div>
                </article>
              </div>
            </section>
          </div>
        </NSpin>
      </NDrawerContent>
    </NDrawer>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NPopconfirm, NSpace, NTag, NText, NTooltip, useMessage } from 'naive-ui'
import type {
  AiAuditResult,
  AiAuditRow,
  AiAgentAutomationRetryResult,
  AiAgentAutomationInsightsResult,
  AiAgentAutomationRunDetailResult,
  AiAgentAutomationRunResult,
  AiAgentAutomationRunRow,
  AiAgentAutomationSummaryResult,
  AiAgentAutomationTaskResult,
  AiAgentAutomationTaskRiskRow,
  AiAgentAutomationTaskRow,
  AiAgentAutomationTaskUpdateResult,
  AiNotificationOutboxResult,
  AiNotificationOutboxRetryResult,
  AiNotificationOutboxRow,
  AiNotificationProviderDrillResult,
} from '~/types/admin-ai'
import { P } from '~/utils/permissions'

useHead({ title: 'AI Agent 自动化 - SPdex 后台' })

const api = useAdminApi()
const { can } = usePermission()
const message = useMessage()

const summary = ref<AiAgentAutomationSummaryResult | null>(null)
const insights = ref<AiAgentAutomationInsightsResult | null>(null)
const outbox = ref<AiNotificationOutboxResult | null>(null)
const tasks = ref<AiAgentAutomationTaskResult | null>(null)
const runs = ref<AiAgentAutomationRunResult | null>(null)
const abnormalRuns = ref<AiAgentAutomationRunRow[]>([])
const trace = ref<AiAuditResult | null>(null)
const runDetail = ref<AiAgentAutomationRunDetailResult | null>(null)
const summaryLoading = ref(false)
const insightsLoading = ref(false)
const outboxLoading = ref(false)
const tasksLoading = ref(false)
const runsLoading = ref(false)
const abnormalLoading = ref(false)
const traceLoading = ref(false)
const detailLoading = ref(false)
const savingTaskId = ref('')
const retryingRunId = ref('')
const retryingNotificationId = ref('')
const providerDrillLoading = ref(false)
const showOpsThresholds = ref(false)
const traceDrawerVisible = ref(false)
const detailDrawerVisible = ref(false)
const traceId = ref('')
const detailRunId = ref('')

const taskFilters = reactive({
  subjectType: '',
  subjectId: '',
  status: '',
  enabled: '',
  limit: 100,
})

const runFilters = reactive({
  taskId: '',
  subjectType: '',
  subjectId: '',
  status: '',
  triggerSource: '',
  limit: 100,
})

const outboxFilters = reactive({
  ownerSubjectType: '',
  ownerSubjectId: '',
  source: 'spdex_ai_automation',
  status: '',
  channel: '',
  limit: 80,
})

const providerDrillForm = reactive({
  ownerSubjectType: 'user',
  ownerSubjectId: 'ai-provider-drill',
  channel: 'in_app',
  status: 'success',
  deliverNow: true,
})

const opsThresholds = reactive({
  failureRate: 10,
  partialRate: 15,
  notificationFailed: 1,
  budgetUsageRate: 85,
  openFeedback: 10,
})

const loadingAny = computed(() =>
  summaryLoading.value || insightsLoading.value || outboxLoading.value || providerDrillLoading.value || tasksLoading.value || runsLoading.value || abnormalLoading.value || traceLoading.value || detailLoading.value)
const failureLabel = computed(() => {
  const value = summary.value?.summary
  return value ? `${value.failedRunCount} / ${value.skippedRunCount}` : '—'
})
const summaryWindowLabel = computed(() => {
  const value = summary.value
  return value ? `最近 ${value.windowDays} 天` : '最近 30 天'
})
const taskNameMap = computed(() => new Map((tasks.value?.items ?? []).map(row => [row.taskId, row.name])))
const traceDrawerTitle = computed(() => traceId.value ? `Trace ${shortTraceId(traceId.value)}` : 'Trace 回查')
const detailDrawerTitle = computed(() => detailRunId.value ? `运行详情 ${shortTraceId(detailRunId.value)}` : '运行详情')
const notificationPendingTotal = computed(() => {
  const value = insights.value?.notifications
  return value ? value.pendingCount + value.retryWaitingCount + value.dispatchingCount : 0
})
const outboxRows = computed(() => outbox.value?.items ?? [])
const compactDailyUsage = computed(() => {
  const items = insights.value?.dailyUsage ?? []
  return items.slice(Math.max(0, items.length - 14))
})
const maxDailyUsage = computed(() => Math.max(1, ...compactDailyUsage.value.map(point => point.toolUsageUnits)))
const insightAlert = computed(() => {
  const value = insights.value
  if (!value) return null
  if (value.notifications.failedCount > 0) {
    return {
      type: 'error' as const,
      title: '存在通知投递失败',
      description: '自动化任务已产生结果，但部分通知没有成功送达，请优先排查 provider、重试队列和用户通知偏好。',
    }
  }
  if (value.quality.failureRate >= 0.1 || value.quality.partialRate >= 0.15) {
    return {
      type: 'warning' as const,
      title: '自动化运行质量需要关注',
      description: '失败或部分完成比例偏高，建议从风险任务进入运行详情，结合 trace 回查和回答验收定位原因。',
    }
  }
  if (value.cost.monthlyBudgetUsageRate >= 0.85) {
    return {
      type: 'warning' as const,
      title: '自动化预算接近上限',
      description: '当前窗口内用量已经接近任务月预算，建议检查高频流程、重复触发和灰度用户范围。',
    }
  }
  return {
    type: 'success' as const,
    title: '自动化运行状态稳定',
    description: '当前窗口内成本、质量、反馈和通知健康没有明显异常。',
  }
})
const opsThresholdAlerts = computed(() => {
  const value = insights.value
  if (!value) return []
  const alerts: Array<{ level: 'error' | 'warning' | 'info', title: string, description: string }> = []
  const failureLimit = opsThresholds.failureRate / 100
  const partialLimit = opsThresholds.partialRate / 100
  const budgetLimit = opsThresholds.budgetUsageRate / 100
  if (value.quality.failureRate >= failureLimit) {
    alerts.push({
      level: 'error',
      title: '失败率超过阈值',
      description: `当前失败率 ${percentLabel(value.quality.failureRate)}，阈值 ${opsThresholds.failureRate}%。`,
    })
  }
  if (value.quality.partialRate >= partialLimit) {
    alerts.push({
      level: 'warning',
      title: '部分完成比例偏高',
      description: `当前部分完成 ${percentLabel(value.quality.partialRate)}，阈值 ${opsThresholds.partialRate}%。`,
    })
  }
  if (value.notifications.failedCount >= opsThresholds.notificationFailed) {
    alerts.push({
      level: 'error',
      title: '通知失败需要处理',
      description: `当前失败通知 ${value.notifications.failedCount} 条，阈值 ${opsThresholds.notificationFailed} 条。`,
    })
  }
  if (value.cost.monthlyBudgetUsageRate >= budgetLimit) {
    alerts.push({
      level: 'warning',
      title: '预算使用接近上限',
      description: `当前预算使用 ${percentLabel(value.cost.monthlyBudgetUsageRate)}，阈值 ${opsThresholds.budgetUsageRate}%。`,
    })
  }
  if (value.quality.openFeedbackCount >= opsThresholds.openFeedback) {
    alerts.push({
      level: 'warning',
      title: '待验收反馈积压',
      description: `当前待处理反馈 ${value.quality.openFeedbackCount} 条，阈值 ${opsThresholds.openFeedback} 条。`,
    })
  }
  return alerts
})
const opsSummaryText = computed(() => {
  const value = insights.value
  if (!value) return '暂无可汇总的运营数据。'
  return [
    `最近 ${value.windowDays} 天共 ${value.summary.runCount} 次自动化运行，成功 ${value.summary.successRunCount} 次，失败 ${value.summary.failedRunCount} 次，部分完成 ${value.summary.partialRunCount} 次。`,
    `AI 用量 ${value.cost.toolUsageUnits} 单位，预计月用量 ${value.cost.estimatedMonthlyUnits} 单位，预算使用 ${percentLabel(value.cost.monthlyBudgetUsageRate)}。`,
    `通知失败 ${value.notifications.failedCount} 条，待投递 ${notificationPendingTotal.value} 条；回答验收待处理 ${value.quality.openFeedbackCount} 条。`,
  ].join(' ')
})

const subjectTypeOptions = [
  { label: '全部主体', value: '' },
  { label: '用户', value: 'user' },
  { label: '企业', value: 'organization' },
  { label: '内部服务', value: 'internal' },
  { label: '客户端', value: 'client' },
]
const enabledOptions = [
  { label: '全部状态', value: '' },
  { label: '已启用', value: 'true' },
  { label: '已暂停', value: 'false' },
]
const taskStatusOptions = [
  { label: '全部结果', value: '' },
  { label: '未运行', value: 'never' },
  { label: '成功', value: 'success' },
  { label: '部分完成', value: 'partial' },
  { label: '失败', value: 'failed' },
  { label: '已跳过', value: 'skipped' },
  { label: '运行中', value: 'running' },
  { label: '排队中', value: 'queued' },
]
const runStatusOptions = [
  { label: '全部结果', value: '' },
  { label: '成功', value: 'success' },
  { label: '部分完成', value: 'partial' },
  { label: '失败', value: 'failed' },
  { label: '已跳过', value: 'skipped' },
  { label: '运行中', value: 'running' },
  { label: '排队中', value: 'queued' },
  { label: '手工记录', value: 'manual' },
]
const triggerSourceOptions = [
  { label: '全部来源', value: '' },
  { label: '用户手动', value: 'manual' },
  { label: '后台调度', value: 'scheduler' },
  { label: '观察条件', value: 'watch_condition' },
  { label: '系统', value: 'system' },
]
const notificationStatusOptions = [
  { label: '全部状态', value: '' },
  { label: '待投递', value: 'pending' },
  { label: '等待重试', value: 'retry_waiting' },
  { label: '投递中', value: 'dispatching' },
  { label: '已送达', value: 'delivered' },
  { label: '已跳过', value: 'skipped' },
  { label: '失败', value: 'failed' },
]
const notificationChannelOptions = [
  { label: '全部通道', value: '' },
  { label: '站内消息', value: 'in_app' },
  { label: '邮件', value: 'email' },
  { label: 'Webhook', value: 'webhook' },
]
const providerDrillChannelOptions = [
  { label: '站内消息', value: 'in_app' },
]
const providerDrillStatusOptions = [
  { label: '成功样本', value: 'success' },
  { label: '部分完成样本', value: 'partial' },
  { label: '失败样本', value: 'failed' },
  { label: '跳过样本', value: 'skipped' },
]

const abnormalColumns = [
  {
    title: '状态',
    key: 'status',
    width: 130,
    fixed: 'left' as const,
    render: (row: AiAgentAutomationRunRow) => h(NTag, { size: 'small', type: statusTagType(row.status) }, {
      default: () => statusLabel(row.status),
    }),
  },
  {
    title: '任务',
    key: 'task',
    width: 290,
    render: (row: AiAgentAutomationRunRow) => h('div', [
      h('div', { class: 'font-medium text-gray-900' }, taskDisplayName(row)),
      h('div', { class: 'mt-1 truncate text-xs text-gray-400' }, row.taskId),
    ]),
  },
  {
    title: '主体',
    key: 'subject',
    width: 180,
    render: (row: AiAgentAutomationRunRow) => `${subjectTypeLabel(row.subjectType)} ${row.subjectId}`,
  },
  {
    title: '原因',
    key: 'errorMessage',
    width: 360,
    ellipsis: { tooltip: true },
    render: (row: AiAgentAutomationRunRow) => humanizeRunReason(row),
  },
  {
    title: '运行消耗',
    key: 'usage',
    width: 150,
    render: (row: AiAgentAutomationRunRow) => h('div', [
      h('div', `${row.completedStepCount} / ${row.stepCount} 步`),
      h('div', { class: 'mt-1 text-xs text-gray-400' }, `${row.toolUsageUnits} 单位`),
    ]),
  },
  {
    title: '触发与时间',
    key: 'createdAtUtc',
    width: 220,
    render: (row: AiAgentAutomationRunRow) => h('div', [
      h('div', triggerSourceLabel(row.triggerSource)),
      h('div', { class: 'mt-1 text-xs text-gray-400' }, fmt(row.createdAtUtc)),
    ]),
  },
  {
    title: '操作',
    key: 'actions',
    width: 320,
    fixed: 'right' as const,
    render: (row: AiAgentAutomationRunRow) => renderRunActions(row),
  },
]

const outboxColumns = [
  {
    title: '状态',
    key: 'status',
    width: 130,
    fixed: 'left' as const,
    render: (row: AiNotificationOutboxRow) => h(NTag, { size: 'small', type: notificationStatusTagType(row.status) }, {
      default: () => notificationStatusLabel(row.status),
    }),
  },
  {
    title: '通道与主体',
    key: 'channel',
    width: 210,
    render: (row: AiNotificationOutboxRow) => h('div', [
      h('div', { class: 'font-medium text-gray-900' }, notificationChannelLabel(row.channel)),
      h('div', { class: 'mt-1 text-xs text-gray-400' }, `${subjectTypeLabel(row.owner.subjectType)} ${row.owner.subjectId}`),
    ]),
  },
  {
    title: '业务引用',
    key: 'payloadRef',
    width: 330,
    render: (row: AiNotificationOutboxRow) => h('div', [
      h('div', { class: 'font-medium text-gray-900' }, notificationPayloadTitle(row)),
      h('div', { class: 'mt-1 truncate text-xs text-gray-400' }, notificationPayloadSubtitle(row)),
    ]),
  },
  {
    title: 'Provider',
    key: 'provider',
    width: 270,
    ellipsis: { tooltip: true },
    render: (row: AiNotificationOutboxRow) => h('div', [
      h('div', row.deliveryProvider || '—'),
      row.deliveryError
        ? h('div', { class: 'mt-1 text-xs text-red-500' }, row.deliveryError)
        : h('div', { class: 'mt-1 text-xs text-gray-400' }, '无错误'),
    ]),
  },
  {
    title: '尝试',
    key: 'attemptCount',
    width: 100,
    render: (row: AiNotificationOutboxRow) => `${row.attemptCount} 次`,
  },
  {
    title: '时间',
    key: 'updatedAt',
    width: 250,
    render: (row: AiNotificationOutboxRow) => h('div', [
      h('div', `更新 ${fmt(row.updatedAt)}`),
      h('div', { class: 'mt-1 text-xs text-gray-400' }, `下次 ${fmt(row.nextAttemptAt)}`),
      h('div', { class: 'mt-1 text-xs text-gray-400' }, `送达 ${fmt(row.deliveredAt)}`),
    ]),
  },
  {
    title: '操作',
    key: 'actions',
    width: 180,
    fixed: 'right' as const,
    render: (row: AiNotificationOutboxRow) => renderOutboxActions(row),
  },
]

const taskColumns = [
  {
    title: '任务',
    key: 'name',
    width: 300,
    fixed: 'left' as const,
    render: (row: AiAgentAutomationTaskRow) => h('div', { class: 'min-w-0' }, [
      h('div', { class: 'font-semibold text-gray-900' }, row.name),
      h('div', { class: 'mt-1 truncate text-xs text-gray-400' }, row.description || row.taskId),
      row.matchTitle
        ? h('div', { class: 'mt-1 text-xs text-gray-500' }, row.matchTitle)
        : null,
    ]),
  },
  {
    title: '主体',
    key: 'subject',
    width: 190,
    render: (row: AiAgentAutomationTaskRow) => h('div', [
      h('div', { class: 'font-medium' }, subjectTypeLabel(row.subjectType)),
      h('div', { class: 'mt-1 text-xs text-gray-400' }, row.subjectId),
    ]),
  },
  {
    title: '流程与范围',
    key: 'workflow',
    width: 240,
    render: (row: AiAgentAutomationTaskRow) => h('div', [
      h('div', { class: 'font-medium' }, row.workflowId),
      h('div', { class: 'mt-1 text-xs text-gray-400' }, `${scopeLabel(row.scope)} · ${cadenceLabel(row.cadence)}`),
    ]),
  },
  {
    title: '触发',
    key: 'triggerType',
    width: 130,
    render: (row: AiAgentAutomationTaskRow) => triggerLabel(row.triggerType),
  },
  {
    title: '状态',
    key: 'enabled',
    width: 150,
    render: (row: AiAgentAutomationTaskRow) => h('div', [
      h(NTag, { size: 'small', type: row.enabled ? 'success' : 'default' }, {
        default: () => row.enabled ? '已启用' : '已暂停',
      }),
      h('div', { class: 'mt-2' }, h(NTag, { size: 'small', type: statusTagType(row.lastRunStatus) }, {
        default: () => statusLabel(row.lastRunStatus),
      })),
    ]),
  },
  {
    title: '运行与预算',
    key: 'budget',
    width: 180,
    render: (row: AiAgentAutomationTaskRow) => h('div', [
      h('div', { class: 'font-medium' }, `${row.runCount} 次运行`),
      h('div', { class: 'mt-1 text-xs text-gray-400' }, `每日上限 ${row.dailyRunLimit}`),
      h('div', { class: 'mt-1 text-xs text-gray-400' }, `月预算 ${row.monthlyUnitBudget ?? '不限'}`),
    ]),
  },
  {
    title: '最近 / 下次',
    key: 'time',
    width: 230,
    render: (row: AiAgentAutomationTaskRow) => h('div', [
      h('div', ['最近：', h(NText, { depth: 3 }, { default: () => fmt(row.lastRunAtUtc) })]),
      h('div', { class: 'mt-1' }, ['下次：', h(NText, { depth: 3 }, { default: () => fmt(row.nextRunAtUtc) })]),
    ]),
  },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    fixed: 'right' as const,
    render: (row: AiAgentAutomationTaskRow) => h(NSpace, { size: 8 }, {
      default: () => [
        h(NButton, { size: 'small', secondary: true, onClick: () => viewRuns(row) }, { default: () => '查看运行' }),
        can(P.aiOpsManage)
          ? h(
              NButton,
              {
                size: 'small',
                type: row.enabled ? 'warning' : 'primary',
                secondary: true,
                loading: savingTaskId.value === row.taskId,
                onClick: () => setTaskEnabled(row),
              },
              { default: () => row.enabled ? '暂停' : '恢复' },
            )
          : null,
      ],
    }),
  },
]

const runColumns = [
  {
    title: '运行结果',
    key: 'status',
    width: 150,
    fixed: 'left' as const,
    render: (row: AiAgentAutomationRunRow) => h('div', [
      h(NTag, { size: 'small', type: statusTagType(row.status) }, {
        default: () => statusLabel(row.status),
      }),
      h('div', { class: 'mt-2 text-xs text-gray-400' }, triggerSourceLabel(row.triggerSource)),
    ]),
  },
  {
    title: '任务',
    key: 'taskId',
    width: 260,
    render: (row: AiAgentAutomationRunRow) => h('div', [
      h('div', { class: 'font-medium' }, row.workflowId),
      h('div', { class: 'mt-1 truncate text-xs text-gray-400' }, row.taskId),
    ]),
  },
  {
    title: '主体',
    key: 'subject',
    width: 190,
    render: (row: AiAgentAutomationRunRow) => `${subjectTypeLabel(row.subjectType)} ${row.subjectId}`,
  },
  {
    title: '步骤',
    key: 'steps',
    width: 120,
    render: (row: AiAgentAutomationRunRow) => `${row.completedStepCount} / ${row.stepCount}`,
  },
  { title: '用量单位', key: 'toolUsageUnits', width: 110 },
  {
    title: '耗时',
    key: 'durationMs',
    width: 110,
    render: (row: AiAgentAutomationRunRow) => row.durationMs ? `${row.durationMs} ms` : '—',
  },
  {
    title: 'Trace',
    key: 'traceId',
    width: 220,
    render: (row: AiAgentAutomationRunRow) => renderTraceButton(row.traceId),
  },
  {
    title: '错误 / 跳过原因',
    key: 'errorMessage',
    width: 300,
    ellipsis: { tooltip: true },
    render: (row: AiAgentAutomationRunRow) => row.errorMessage || '—',
  },
  {
    title: '创建时间',
    key: 'createdAtUtc',
    width: 180,
    render: (row: AiAgentAutomationRunRow) => fmt(row.createdAtUtc),
  },
  {
    title: '操作',
    key: 'actions',
    width: 300,
    fixed: 'right' as const,
    render: (row: AiAgentAutomationRunRow) => renderRunActions(row),
  },
]

const traceColumns = [
  {
    title: '结果',
    key: 'success',
    width: 90,
    render: (row: AiAuditRow) => h(NTag, { size: 'small', type: row.success ? 'success' : 'error' }, {
      default: () => row.success ? '成功' : '失败',
    }),
  },
  { title: '时间', key: 'createdAtUtc', width: 180, render: (row: AiAuditRow) => fmt(row.createdAtUtc) },
  { title: '工具', key: 'toolName', width: 240 },
  {
    title: '主体',
    key: 'subject',
    width: 190,
    render: (row: AiAuditRow) => `${row.subjectType || '—'}:${row.subjectId || '—'}`,
  },
  { title: '耗时', key: 'elapsedMs', width: 100, render: (row: AiAuditRow) => `${row.elapsedMs} ms` },
  { title: '用量', key: 'usageUnits', width: 90 },
  { title: '错误', key: 'errorCode', width: 190, render: (row: AiAuditRow) => row.errorCode || '—' },
  { title: '来源', key: 'principalSource', width: 170, render: (row: AiAuditRow) => row.principalSource || '—' },
  { title: 'AI Client', key: 'aiClientId', width: 170, render: (row: AiAuditRow) => row.aiClientId || '—' },
]

async function loadAll() {
  await Promise.all([loadSummary(), loadInsights(), loadOutbox(), loadTasks(), loadRuns(), loadAbnormalRuns()])
}

async function loadSummary() {
  summaryLoading.value = true
  const result = await api.get<AiAgentAutomationSummaryResult>('ai/agent/automation-summary', { days: 30 })
  summaryLoading.value = false
  if (result.code === 0) {
    summary.value = result.data
  }
  else {
    message.error(result.message || '自动化汇总加载失败')
  }
}

async function loadInsights() {
  insightsLoading.value = true
  const result = await api.get<AiAgentAutomationInsightsResult>('ai/agent/automation-insights', { days: 30 })
  insightsLoading.value = false
  if (result.code === 0) {
    insights.value = result.data
  }
  else {
    message.error(result.message || '成本与质量看板加载失败')
  }
}

async function loadOutbox() {
  outboxLoading.value = true
  const result = await api.get<AiNotificationOutboxResult>('ai/notifications/outbox', compactQuery({
    ownerSubjectType: outboxFilters.ownerSubjectType,
    ownerSubjectId: outboxFilters.ownerSubjectId,
    source: outboxFilters.source,
    status: outboxFilters.status,
    channel: outboxFilters.channel,
    limit: outboxFilters.limit,
  }))
  outboxLoading.value = false
  if (result.code === 0) {
    outbox.value = result.data
  }
  else {
    message.error(result.message || '通知队列加载失败')
  }
}

async function retryNotification(row: AiNotificationOutboxRow) {
  if (!can(P.aiOpsManage) || retryingNotificationId.value) return
  retryingNotificationId.value = row.notificationId
  const result = await api.post<AiNotificationOutboxRetryResult>(`ai/notifications/outbox/${encodeURIComponent(row.notificationId)}/retry`)
  retryingNotificationId.value = ''
  if (result.code === 0) {
    message.success('已加入通知重试队列')
    await Promise.all([loadOutbox(), loadInsights()])
  }
  else {
    message.error(result.message || '通知重试失败')
  }
}

async function runProviderDrill() {
  if (!can(P.aiOpsManage) || providerDrillLoading.value) return
  providerDrillLoading.value = true
  const result = await api.post<AiNotificationProviderDrillResult>('ai/notifications/provider-drill', {
    ownerSubjectType: providerDrillForm.ownerSubjectType,
    ownerSubjectId: providerDrillForm.ownerSubjectId,
    channel: providerDrillForm.channel,
    status: providerDrillForm.status,
    deliverNow: providerDrillForm.deliverNow,
    taskName: '通知 provider 演练',
    workflowName: 'AI 自动化通知演练',
  })
  providerDrillLoading.value = false
  if (result.code === 0) {
    const status = result.data?.item?.status
    message.success(status ? `演练完成：${notificationStatusLabel(status)}` : '演练完成')
    await Promise.all([loadOutbox(), loadInsights()])
  }
  else {
    message.error(result.message || '通知 provider 演练失败')
  }
}

async function loadTasks() {
  tasksLoading.value = true
  const result = await api.get<AiAgentAutomationTaskResult>('ai/agent/automation-tasks', compactQuery({
    subjectType: taskFilters.subjectType,
    subjectId: taskFilters.subjectId,
    status: taskFilters.status,
    enabled: taskFilters.enabled,
    limit: taskFilters.limit,
  }))
  tasksLoading.value = false
  if (result.code === 0) {
    tasks.value = result.data
  }
  else {
    message.error(result.message || '自动化任务加载失败')
  }
}

async function loadRuns() {
  runsLoading.value = true
  const result = await api.get<AiAgentAutomationRunResult>('ai/agent/automation-runs', compactQuery({
    taskId: runFilters.taskId,
    subjectType: runFilters.subjectType,
    subjectId: runFilters.subjectId,
    status: runFilters.status,
    triggerSource: runFilters.triggerSource,
    limit: runFilters.limit,
  }))
  runsLoading.value = false
  if (result.code === 0) {
    runs.value = result.data
  }
  else {
    message.error(result.message || '运行记录加载失败')
  }
}

async function loadAbnormalRuns() {
  abnormalLoading.value = true
  const statuses = ['failed', 'skipped', 'partial']
  const results = await Promise.all(statuses.map(status =>
    api.get<AiAgentAutomationRunResult>('ai/agent/automation-runs', {
      status,
      limit: 80,
    }),
  ))
  abnormalLoading.value = false
  const failed = results.find(result => result.code !== 0)
  if (failed) {
    message.error(failed.message || '异常任务队列加载失败')
    return
  }

  const seen = new Set<string>()
  abnormalRuns.value = results
    .flatMap(result => result.data?.items ?? [])
    .filter((row) => {
      if (seen.has(row.runId)) return false
      seen.add(row.runId)
      return true
    })
    .sort((a, b) => b.createdAtUtc.localeCompare(a.createdAtUtc))
    .slice(0, 100)
}

async function setTaskEnabled(row: AiAgentAutomationTaskRow) {
  if (!can(P.aiOpsManage)) return
  savingTaskId.value = row.taskId
  const result = await api.post<AiAgentAutomationTaskUpdateResult>(
    `ai/agent/automation-tasks/${encodeURIComponent(row.taskId)}/enabled`,
    { enabled: !row.enabled },
  )
  savingTaskId.value = ''
  if (result.code === 0) {
    message.success(!row.enabled ? '任务已恢复自动运行' : '任务已暂停自动运行')
    await Promise.all([loadSummary(), loadTasks(), loadRuns(), loadAbnormalRuns()])
  }
  else {
    message.error(result.message || '任务状态更新失败')
  }
}

function viewRuns(row: AiAgentAutomationTaskRow) {
  runFilters.taskId = row.taskId
  runFilters.subjectType = row.subjectType
  runFilters.subjectId = row.subjectId
  loadRuns()
}

function viewRunTask(row: AiAgentAutomationRunRow) {
  runFilters.taskId = row.taskId
  runFilters.subjectType = row.subjectType
  runFilters.subjectId = row.subjectId
  runFilters.status = ''
  runFilters.triggerSource = ''
  loadRuns()
}

function inspectRiskTask(row: AiAgentAutomationTaskRiskRow) {
  runFilters.taskId = row.taskId
  runFilters.subjectType = row.subjectType
  runFilters.subjectId = row.subjectId
  runFilters.status = ''
  runFilters.triggerSource = ''
  loadRuns()
}

async function loadRunDetail(runId: string) {
  detailLoading.value = true
  runDetail.value = null
  const result = await api.get<AiAgentAutomationRunDetailResult>(`ai/agent/automation-runs/${encodeURIComponent(runId)}`)
  detailLoading.value = false
  if (result.code === 0) {
    runDetail.value = result.data
  }
  else {
    message.error(result.message || '运行详情加载失败')
  }
}

function openRunDetail(row: AiAgentAutomationRunRow) {
  detailRunId.value = row.runId
  detailDrawerVisible.value = true
  loadRunDetail(row.runId)
}

async function retryAutomationRun(row: AiAgentAutomationRunRow) {
  if (!can(P.aiOpsManage) || retryingRunId.value) return
  retryingRunId.value = row.runId
  const result = await api.post<AiAgentAutomationRetryResult>(`ai/agent/automation-runs/${encodeURIComponent(row.runId)}/retry`)
  retryingRunId.value = ''
  if (result.code === 0) {
    message.success('已发起重试并写入新的运行记录')
    await Promise.all([loadSummary(), loadTasks(), loadRuns(), loadAbnormalRuns()])
    const nextRunId = result.data?.execution?.automationRun?.runId
    if (nextRunId) {
      detailRunId.value = nextRunId
      await loadRunDetail(nextRunId)
    }
    else {
      await loadRunDetail(row.runId)
    }
  }
  else {
    message.error(result.message || '重试失败')
  }
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
  if (result.code === 0) {
    trace.value = result.data
  }
  else {
    message.error(result.message || '未找到该 trace')
  }
}

function openTraceDrawer(value?: string | null) {
  const trace = value?.trim()
  if (!trace) return
  traceId.value = trace
  traceDrawerVisible.value = true
  loadTrace()
}

function openFeedbackCenter(value?: string | null) {
  const trace = value?.trim()
  if (!trace) return
  navigateTo(`/ai/usage?tab=feedback&traceId=${encodeURIComponent(trace)}`)
}

function openFeedbackDashboard() {
  navigateTo('/ai/usage?tab=feedback')
}

function compactQuery(values: Record<string, string | number | boolean | null | undefined>) {
  return Object.fromEntries(
    Object.entries(values).filter(([, value]) => value !== '' && value !== null && value !== undefined),
  )
}

function fmt(value?: string | null) {
  return value ? value.substring(0, 19).replace('T', ' ') : '—'
}

function shortTraceId(value: string) {
  return value.length > 28 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value
}

function percentLabel(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${(value * 100).toFixed(value > 0 && value < 0.01 ? 2 : 1)}%`
}

function percentStyle(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '0%'
  if (value <= 0) return '0%'
  return `${Math.max(2, Math.min(100, value * 100))}%`
}

function decimalLabel(value?: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return value.toFixed(value >= 10 ? 1 : 2)
}

function usageBarWidth(value: number) {
  return `${Math.max(value > 0 ? 4 : 0, Math.min(100, (value / maxDailyUsage.value) * 100))}%`
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

function renderRunActions(row: AiAgentAutomationRunRow) {
  return h(NSpace, { size: 8 }, {
    default: () => [
      h(NButton, { size: 'small', secondary: true, type: 'primary', onClick: () => openRunDetail(row) }, { default: () => '详情' }),
      h(NButton, { size: 'small', secondary: true, onClick: () => viewRunTask(row) }, { default: () => '看任务' }),
      h(
        NButton,
        {
          size: 'small',
          secondary: true,
          type: 'primary',
          disabled: !row.traceId,
          onClick: () => openTraceDrawer(row.traceId),
        },
        { default: () => '回查' },
      ),
      h(
        NButton,
        {
          size: 'small',
          secondary: true,
          disabled: !row.traceId,
          onClick: () => openFeedbackCenter(row.traceId),
        },
        { default: () => '验收' },
      ),
    ],
  })
}

function renderOutboxActions(row: AiNotificationOutboxRow) {
  const retryable = isNotificationRetryable(row)
  return h(NSpace, { size: 8 }, {
    default: () => [
      h(
        NPopconfirm,
        {
          disabled: !can(P.aiOpsManage) || !retryable,
          onPositiveClick: () => retryNotification(row),
        },
        {
          trigger: () => h(
            NButton,
            {
              size: 'small',
              secondary: true,
              type: 'warning',
              disabled: !can(P.aiOpsManage) || !retryable,
              loading: retryingNotificationId.value === row.notificationId,
            },
            { default: () => '重试' },
          ),
          default: () => '确认将这条通知加入手动重试队列？',
        },
      ),
    ],
  })
}

function isNotificationRetryable(row: AiNotificationOutboxRow) {
  return row.status !== 'delivered' && row.status !== 'dispatching'
}

function notificationPayloadTitle(row: AiNotificationOutboxRow) {
  const ref = row.payloadRef
  const task = ref?.task as { name?: unknown, id?: unknown } | null
  const workflow = ref?.workflow as { name?: unknown, id?: unknown } | null
  const match = ref?.match as { title?: unknown } | null
  return String(task?.name || workflow?.name || match?.title || ref?.taskId || row.conditionId || '通知任务')
}

function notificationPayloadSubtitle(row: AiNotificationOutboxRow) {
  const ref = row.payloadRef
  const parts = [
    ref?.workflowId ? `流程 ${ref.workflowId}` : '',
    ref?.runId ? `运行 ${shortTraceId(ref.runId)}` : '',
    ref?.traceId ? `Trace ${shortTraceId(ref.traceId)}` : '',
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : row.notificationId
}

function taskDisplayName(row: AiAgentAutomationRunRow) {
  return taskNameMap.value.get(row.taskId) || row.workflowId || row.taskId
}

function humanizeRunReason(row: AiAgentAutomationRunRow) {
  if (row.errorMessage) return row.errorMessage
  if (row.status === 'failed') return '运行失败，但未返回具体错误信息。'
  if (row.status === 'skipped') return '本次运行被门禁或调度策略跳过。'
  if (row.status === 'partial') return '部分步骤完成，请回查 trace 确认失败步骤。'
  return '—'
}

function durationLabel(value?: number | null) {
  if (!value) return '—'
  return value >= 1000 ? `${(value / 1000).toFixed(1)} 秒` : `${value} ms`
}

function presetLabel(value: string) {
  return value === 'today_hot'
    ? '今日重点'
    : value === 'search'
      ? '搜索赛事'
      : value === 'snapshot'
        ? '单场快照'
        : value === 'trend'
          ? '走势分析'
          : value === 'anomaly'
            ? '异常证据'
            : value === 'metric'
              ? '指标解读'
              : value
}

function subjectTypeLabel(value: string) {
  return value === 'user'
    ? '用户'
    : value === 'organization'
      ? '企业'
      : value === 'internal'
        ? '内部服务'
        : value === 'client'
          ? '客户端'
          : value
}

function triggerLabel(value: string) {
  return value === 'scheduled'
    ? '定时'
    : value === 'match_status'
      ? '赛前/赛中'
      : value === 'watch_condition'
        ? '观察条件'
        : value
}

function triggerSourceLabel(value: string) {
  return value === 'manual'
    ? '用户手动'
    : value === 'scheduler'
      ? '后台调度'
      : value === 'watch_condition'
        ? '观察条件'
        : value === 'system'
          ? '系统'
          : value
}

function notificationChannelLabel(value: string) {
  return value === 'in_app'
    ? '站内消息'
    : value === 'email'
      ? '邮件'
      : value === 'webhook'
        ? 'Webhook'
        : value
}

function cadenceLabel(value: string) {
  return value === 'daily'
    ? '每日'
    : value === 'hourly'
      ? '每小时'
      : value === 'before_kickoff'
        ? '开赛前'
        : value === 'live_window'
          ? '赛中窗口'
          : value === 'on_signal'
            ? '信号触发'
            : value
}

function scopeLabel(value: string) {
  return value === 'daily_watchlist'
    ? '每日观察列表'
    : value === 'selected_match'
      ? '固定比赛'
      : value === 'ask_each_run'
        ? '运行时选择'
        : value
}

function statusLabel(value: string) {
  return value === 'never'
    ? '未运行'
    : value === 'success'
      ? '成功'
      : value === 'partial'
        ? '部分完成'
        : value === 'failed'
          ? '失败'
          : value === 'skipped'
            ? '已跳过'
            : value === 'queued'
              ? '排队中'
              : value === 'running'
                ? '运行中'
                : value === 'manual'
                  ? '手工记录'
                  : value
}

function notificationStatusLabel(value: string) {
  return value === 'pending'
    ? '待投递'
    : value === 'dispatching'
      ? '投递中'
      : value === 'retry_waiting'
        ? '等待重试'
        : value === 'delivered'
          ? '已送达'
          : value === 'skipped'
            ? '已跳过'
            : value === 'failed'
              ? '失败'
              : value
}

function statusTagType(value: string) {
  return value === 'success'
    ? 'success'
    : value === 'failed'
      ? 'error'
      : value === 'partial' || value === 'skipped'
        ? 'warning'
        : value === 'running' || value === 'queued'
          ? 'info'
          : 'default'
}

function notificationStatusTagType(value: string) {
  return value === 'delivered'
    ? 'success'
    : value === 'failed'
      ? 'error'
      : value === 'retry_waiting' || value === 'skipped'
        ? 'warning'
        : value === 'dispatching' || value === 'pending'
          ? 'info'
          : 'default'
}

function riskLevelLabel(value: string) {
  return value === 'critical'
    ? '高风险'
    : value === 'warning'
      ? '需关注'
      : value === 'watch'
        ? '观察'
        : '正常'
}

function riskTagType(value: string) {
  return value === 'critical'
    ? 'error'
    : value === 'warning'
      ? 'warning'
      : value === 'watch'
        ? 'info'
        : 'success'
}

onMounted(loadAll)
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

.run-detail-hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.run-detail-hero h3 {
  margin: 10px 0 4px;
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.run-detail-hero p {
  margin: 0;
  color: #6b7280;
}

.step-timeline {
  display: grid;
  gap: 10px;
}

.step-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 14px;
  background: #fff;
}

.step-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.step-card-head > div:first-child {
  display: flex;
  align-items: center;
  gap: 8px;
}

.step-card-head b {
  color: #111827;
}

.step-card p {
  margin: 10px 0;
  color: #374151;
  line-height: 1.6;
}

.step-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  color: #6b7280;
  font-size: 12px;
}

.step-link {
  color: #2563eb;
  border: 0;
  background: transparent;
  padding: 0;
  cursor: pointer;
}

.ops-dashboard {
  display: grid;
  gap: 14px;
}

.ops-summary-panel,
.ops-threshold-panel,
.provider-drill-panel {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.ops-summary-panel {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding: 14px;
}

.ops-summary-panel h3,
.ops-threshold-panel h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #111827;
}

.ops-summary-panel p {
  margin: 6px 0 0;
  color: #4b5563;
  line-height: 1.7;
}

.ops-alert-list {
  display: grid;
  gap: 8px;
}

.ops-threshold-panel {
  display: grid;
  gap: 12px;
  padding: 14px;
}

.provider-drill-panel {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 12px;
  padding: 12px;
}

.ops-metric-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
}

.ops-metric,
.ops-panel {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
}

.ops-metric {
  padding: 14px;
}

.ops-metric span {
  display: block;
  color: #6b7280;
  font-size: 12px;
}

.ops-metric strong {
  display: block;
  margin-top: 6px;
  color: #111827;
  font-size: 24px;
  line-height: 1.1;
}

.ops-metric small {
  display: block;
  margin-top: 8px;
  color: #6b7280;
  line-height: 1.5;
}

.ops-dashboard-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
  gap: 12px;
}

.ops-panel {
  padding: 14px;
}

.ops-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.ops-panel-head h3 {
  margin: 0;
  color: #111827;
  font-size: 14px;
  font-weight: 700;
}

.ops-panel-head span {
  color: #9ca3af;
  font-size: 12px;
}

.status-bars,
.usage-bars {
  display: grid;
  gap: 10px;
}

.status-bar-row,
.usage-bar-row {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr) 46px;
  align-items: center;
  gap: 10px;
  color: #4b5563;
  font-size: 12px;
}

.status-bar-row b,
.usage-bar-row b {
  color: #111827;
  text-align: right;
}

.status-bar-track,
.usage-bar-track {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: #eef2f7;
}

.status-bar-fill,
.usage-bar-track i {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: #8b5cf6;
}

.status-success {
  background: #10b981;
}

.status-partial {
  background: #f59e0b;
}

.status-failed {
  background: #ef4444;
}

.status-skipped {
  background: #64748b;
}

.status-other {
  background: #94a3b8;
}

.usage-bar-track i {
  background: #0f766e;
}

.risk-list {
  display: grid;
  gap: 10px;
}

.risk-row {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(260px, .8fr) auto;
  align-items: center;
  gap: 14px;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #f8fafc;
}

.risk-row b {
  margin-left: 8px;
  color: #111827;
}

.risk-row p {
  margin: 8px 0 0;
  color: #4b5563;
  line-height: 1.5;
}

.risk-meta {
  display: grid;
  gap: 4px;
  color: #6b7280;
  font-size: 12px;
}

@media (max-width: 1180px) {
  .ops-metric-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .ops-dashboard-grid,
  .risk-row {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .ops-metric-grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
