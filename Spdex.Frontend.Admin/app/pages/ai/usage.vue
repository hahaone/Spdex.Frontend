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
          <NButton v-if="usageFilters.subjectId" @click="clearSubjectDrill">返回全部主体</NButton>
          <NButton :disabled="!usage?.items.length" @click="exportCsv">导出用量 CSV</NButton>
        </NSpace>

        <NAlert
          v-if="usage"
          class="mb-3"
          :type="usage.billable ? 'warning' : 'info'"
          :title="usage.billable ? '可计费数据' : '测试计量，不产生账单'"
        >
          billing mode: {{ usage.billingMode }}
        </NAlert>

        <NGrid :cols="6" :x-gap="12" item-responsive class="mb-4">
          <NGi span="6 700:1"><NCard size="small"><NStatistic label="调用次数" :value="usageTotals.calls" /></NCard></NGi>
          <NGi span="6 700:1"><NCard size="small"><NStatistic label="成功" :value="usageTotals.success" /></NCard></NGi>
          <NGi span="6 700:1"><NCard size="small"><NStatistic label="失败" :value="usageTotals.failed" /></NCard></NGi>
          <NGi span="6 700:1"><NCard size="small"><NStatistic label="总计量" :value="usageTotals.units" /></NCard></NGi>
          <NGi span="6 700:1"><NCard size="small"><NStatistic label="成功用量" :value="usageTotals.successfulUnits" /></NCard></NGi>
          <NGi span="6 700:1"><NCard size="small"><NStatistic label="排除用量" :value="usageTotals.failedUnits" /></NCard></NGi>
        </NGrid>

        <NDataTable
          :columns="usageColumns"
          :data="usage?.items ?? []"
          :loading="usageLoading"
          :pagination="{ pageSize: 25 }"
          :row-key="(row: AiUsageRow) => `${row.dateUtc}:${row.subjectType}:${row.subjectId}:${row.toolName}`"
          :scroll-x="1650"
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
        <NCard size="small" class="mb-4" title="模型用量与成本基线">
          <NAlert class="mb-3" type="info" title="以模型返回 token 和实际响应耗时为准">
            这里不硬编码供应商单价，也不等同于供应商账单。财务估算应将输入、输出 token 与对应模型在调用时适用的价格表另行核对。
          </NAlert>
          <NGrid :cols="5" :x-gap="10" item-responsive class="mb-3">
            <NGi span="5 700:1"><NStatistic label="模型调用" :value="modelUsage?.summary.calls ?? 0" /></NGi>
            <NGi span="5 700:1"><NStatistic label="失败率" :value="modelFailureRate" /></NGi>
            <NGi span="5 700:1"><NStatistic label="输入 token" :value="modelUsage?.summary.inputTokens ?? 0" /></NGi>
            <NGi span="5 700:1"><NStatistic label="输出 token" :value="modelUsage?.summary.outputTokens ?? 0" /></NGi>
            <NGi span="5 700:1"><NStatistic label="平均响应" :value="modelUsage ? `${modelUsage.summary.averageDurationMs} ms` : '—'" /></NGi>
          </NGrid>
          <NDataTable
            :columns="modelUsageColumns"
            :data="modelUsage?.summary.items ?? []"
            :loading="modelUsageLoading"
            :pagination="{ pageSize: 10 }"
            :row-key="(row: AiAgentModelUsageRow) => `${row.provider}:${row.model}`"
            :scroll-x="1160"
          />
        </NCard>
        <NGrid :cols="4" :x-gap="12" item-responsive class="mb-4">
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="样本调用" :value="qualityTotals.calls" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="失败调用" :value="qualityTotals.failed" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="总体成功率" :value="`${qualityTotals.successRate}%`" /></NCard></NGi>
          <NGi span="4 700:1"><NCard size="small"><NStatistic label="最慢工具 P95" :value="slowestQuality ? `${slowestQuality.p95Ms} ms` : '—'" /></NCard></NGi>
        </NGrid>
        <NSpace class="mb-3">
          <NButton type="primary" :loading="auditLoading || modelUsageLoading" @click="loadQuality">刷新质量与模型用量</NButton>
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
        <NCard size="small" class="mb-4" title="内部模拟评测">
          <NAlert class="mb-3" type="warning" title="仅用于提前发现可读性、数据边界和安全问题">
            这是确定性规则检查，不代表足球专家验收，也不会自动把回答标记为已验证。专家签字门禁保持独立。
          </NAlert>
          <NSpace class="mb-3" align="center">
            <NSelect v-model:value="answerQualityFilters.category" :options="answerQualityCategoryOptions" style="width:190px" />
            <NSelect v-model:value="answerQualityFilters.passed" :options="answerQualityPassedOptions" style="width:150px" />
            <NInputNumber v-model:value="answerQualityFilters.limit" :min="1" :max="500" style="width:120px" />
            <NButton type="primary" :loading="answerQualityLoading" @click="loadAnswerQualityEvaluations">刷新评测</NButton>
          </NSpace>
          <NGrid :cols="3" :x-gap="12" item-responsive class="mb-3">
            <NGi span="3 700:1"><NStatistic label="评测样本" :value="answerQuality?.count ?? 0" /></NGi>
            <NGi span="3 700:1"><NStatistic label="规则通过" :value="answerQuality?.passedCount ?? 0" /></NGi>
            <NGi span="3 700:1"><NStatistic label="需人工复核" :value="answerQuality?.failedCount ?? 0" /></NGi>
          </NGrid>
          <NDataTable
            :columns="answerQualityColumns"
            :data="answerQuality?.items ?? []"
            :loading="answerQualityLoading"
            :pagination="{ pageSize: 10 }"
            :row-key="(row: AiAnswerQualityEvaluation) => row.evaluationId"
            :scroll-x="1120"
          />
        </NCard>
        <NGrid :cols="2" :x-gap="12" :y-gap="12" item-responsive class="mb-3">
          <NGi span="2 1100:1">
            <NCard size="small" title="无专家阶段质检规则">
              <NGrid :cols="2" :x-gap="10" :y-gap="10" item-responsive>
                <NGi v-for="rule in qualityReviewRules" :key="rule.id" span="2 900:1">
                  <div class="rounded border border-gray-100 bg-gray-50 p-3">
                    <div class="mb-1 flex items-center justify-between gap-2">
                      <span class="text-sm font-medium text-gray-700">{{ rule.label }}</span>
                      <NTag size="small" :type="rule.required ? 'warning' : 'info'">
                        {{ rule.required ? '必查' : '建议' }}
                      </NTag>
                    </div>
                    <div class="text-xs leading-5 text-gray-500">{{ rule.description }}</div>
                  </div>
                </NGi>
              </NGrid>
            </NCard>
          </NGi>
          <NGi span="2 1100:1">
            <NCard size="small" title="抽样进度与风险问题池">
              <NGrid :cols="4" :x-gap="8" :y-gap="8" item-responsive class="mb-3">
                <NGi span="4 700:1"><NStatistic label="本轮已加载" :value="feedbackSampleStats.loaded" /></NGi>
                <NGi span="4 700:1"><NStatistic label="已流转" :value="feedbackSampleStats.reviewed" /></NGi>
                <NGi span="4 700:1"><NStatistic label="目标进度" :value="`${feedbackSampleStats.progress}%`" /></NGi>
                <NGi span="4 700:1"><NStatistic label="审计 Trace" :value="`${feedbackSampleStats.auditTraceCoverage}%`" /></NGi>
              </NGrid>
              <NProgress
                class="mb-3"
                type="line"
                :percentage="feedbackSampleStats.progress"
                :status="feedbackSampleStats.progress >= 100 ? 'success' : 'warning'"
                :height="10"
              />
              <NAlert
                v-if="feedbackSampleStats.reviewed < feedbackSampleStats.target"
                class="mb-3"
                type="warning"
                :title="`还需流转 ${feedbackSampleStats.target - feedbackSampleStats.reviewed} 条，才能完成本轮 30 条抽样验收`"
              >
                建议优先处理高风险池、严重度高、或 trace 可回查的真实问题。
              </NAlert>
              <NSpace size="small">
                <NButton
                  v-for="pool in feedbackRiskPools"
                  :key="pool.id"
                  size="small"
                  :type="feedbackFilters.riskPool === pool.id ? 'primary' : 'default'"
                  secondary
                  @click="applyFeedbackRiskPool(pool)"
                >
                  {{ pool.label }}{{ riskPoolCounts[pool.id] ? ` · ${riskPoolCounts[pool.id]}` : '' }}
                </NButton>
                <NButton size="small" tertiary @click="clearFeedbackRiskPool">清除风险池</NButton>
                <NButton size="small" tertiary :disabled="!feedback?.items?.length" @click="exportFeedbackCsv">导出当前反馈</NButton>
              </NSpace>
            </NCard>
          </NGi>
        </NGrid>
        <NSpace class="mb-3" align="center">
          <NSelect v-model:value="feedbackFilters.status" :options="feedbackStatusOptions" style="width:170px" />
          <NSelect v-model:value="feedbackFilters.feedbackType" :options="feedbackTypeOptions" style="width:150px" />
          <NSelect v-model:value="feedbackFilters.tool" :options="toolFilterOptions" style="width:210px" />
          <NSelect v-model:value="feedbackFilters.issueTag" :options="issueTagOptions" style="width:190px" />
          <NInput v-model:value="feedbackFilters.searchTerm" clearable placeholder="问题/备注关键词" style="width:220px" />
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
            <NButton size="small" :disabled="!selectedFeedbackRows.length" :loading="feedbackReviewSubmitting" @click="batchReviewFeedback('triaged')">批量分诊</NButton>
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
          v-if="billingPreview"
          class="mb-4"
          :type="billingPreview.billable ? 'warning' : 'info'"
          :title="billingPreview.billable ? '账单数据待财务确认' : '当前仅提供非计费预演'"
        >
          策略 {{ billingPreview.policy.version }} · {{ billingPreview.billingMode }} ·
          成功工具调用计入预演可扣额度，工具发现、鉴权失败、参数校验错误和失败调用不计入预演账单。
        </NAlert>
        <NAlert v-else class="mb-4" type="info" title="当前仅提供非计费预演">
          选择日期和主体后刷新预演；正式价格、账单与扣费开关尚未启用。
        </NAlert>

        <NCard size="small" class="mb-4" title="计费上线边界">
          <template #header-extra>
            <NButton tag="a" :href="usageHelpUrl" target="_blank" rel="noopener noreferrer" size="small" tertiary>
              用户帮助
            </NButton>
          </template>
          <NDescriptions :column="1" size="small">
            <NDescriptionsItem label="当前状态">测试计量与账单预演，不生成正式账单，不扣用户真实额度。</NDescriptionsItem>
            <NDescriptionsItem label="预演口径">成功工具调用按 usage units 计入；工具发现、鉴权失败、权限失败、参数校验错误和系统失败排除。</NDescriptionsItem>
            <NDescriptionsItem label="正式前置">套餐定价、额度扣减、冲正/退款、账单对账、帮助中心说明和上线门禁签字完成后，才允许打开 billable。</NDescriptionsItem>
          </NDescriptions>
        </NCard>

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
          <NButton type="primary" :loading="billingEvidenceLoading" @click="loadBillingEvidence">刷新计费证据</NButton>
        </NSpace>

        <NGrid :cols="2" :x-gap="12" :y-gap="12" item-responsive class="mb-4">
          <NGi span="2 1100:1">
            <NCard size="small" title="Billing Ledger">
              <template #header-extra>
                <NTag size="small" :type="billingLedgerStatusTag">{{ billingLedgerStatusText }}</NTag>
              </template>
              <NAlert class="mb-3" :type="billingLedgerNotice.type" :title="billingLedgerNotice.title">
                {{ billingLedgerNotice.description }}
              </NAlert>
              <NDescriptions :column="2" size="small">
                <NDescriptionsItem label="Provider">{{ billingLedger?.provider ?? '—' }}</NDescriptionsItem>
                <NDescriptionsItem label="Billing mode">{{ billingLedger?.billingMode ?? '—' }}</NDescriptionsItem>
                <NDescriptionsItem label="Policy">{{ billingLedger?.policyVersion ?? '—' }}</NDescriptionsItem>
                <NDescriptionsItem label="记录数">{{ billingLedger?.recordCount ?? 0 }}</NDescriptionsItem>
                <NDescriptionsItem label="最新写入">{{ fmt(billingLedger?.latestRecordAtUtc) }}</NDescriptionsItem>
                <NDescriptionsItem label="失败次数">{{ billingLedger?.failureCount ?? 0 }}</NDescriptionsItem>
                <NDescriptionsItem label="送达计费策略">{{ billingLedger?.deliveryPolicy ?? '—' }}</NDescriptionsItem>
                <NDescriptionsItem label="中心账本">{{ billingLedger?.centralized ? '已接入' : '未接入' }}</NDescriptionsItem>
                <NDescriptionsItem label="持久双写">{{ billingLedger?.durableDoubleWrite ? '已启用' : '未启用' }}</NDescriptionsItem>
                <NDescriptionsItem label="中心复制">
                  {{ billingLedger?.replicationEnabled ? (billingLedger.replicationHealthy ? '健康' : '异常') : '未启用' }}
                </NDescriptionsItem>
                <NDescriptionsItem label="待复制事件">{{ billingLedger?.pendingReplicationEvents ?? 0 }}</NDescriptionsItem>
                <NDescriptionsItem label="死信事件">{{ billingLedger?.deadLetterReplicationEvents ?? 0 }}</NDescriptionsItem>
                <NDescriptionsItem label="最近复制">{{ fmt(billingLedger?.lastReplicatedAtUtc) }}</NDescriptionsItem>
                <NDescriptionsItem label="商业化计费门禁">
                  <NTag size="small" :type="billingLedger?.commercialBillingReady ? 'success' : 'warning'">
                    {{ billingLedger?.commercialBillingReady ? '已满足技术门禁' : '未满足' }}
                  </NTag>
                </NDescriptionsItem>
              </NDescriptions>
              <NAlert class="mt-3" :type="billingReplicationNotice.type" :title="billingReplicationNotice.title">
                {{ billingReplicationNotice.description }}
              </NAlert>
            </NCard>
          </NGi>
          <NGi span="2 1100:1">
            <NCard size="small" title="Usage 与 Billing Ledger 对账">
              <template #header-extra>
                <NSpace size="small">
                  <NTag
                    size="small"
                    :type="billingReconciliation?.matches ? 'success' : billingReconciliation?.enabled ? 'warning' : 'info'"
                  >
                    {{ billingReconciliation ? (billingReconciliation.matches ? '一致' : '有差异') : '未加载' }}
                  </NTag>
                  <NButton size="small" :loading="billingReconciliationLoading" @click="loadBillingReconciliation">
                    刷新对账
                  </NButton>
                </NSpace>
              </template>
              <NAlert class="mb-3" :type="billingReconciliationNotice.type" :title="billingReconciliationNotice.title">
                {{ billingReconciliationNotice.description }}
              </NAlert>
              <NGrid :cols="4" :x-gap="8" item-responsive>
                <NGi span="4 700:1">
                  <NStatistic label="Usage 成功调用" :value="billingReconciliation?.totals.usageSuccessfulCalls ?? 0" />
                </NGi>
                <NGi span="4 700:1">
                  <NStatistic label="Ledger 记录" :value="billingReconciliation?.totals.billingRows ?? 0" />
                </NGi>
                <NGi span="4 700:1">
                  <NStatistic label="调用差异" :value="billingReconciliation?.totals.callDelta ?? 0" />
                </NGi>
                <NGi span="4 700:1">
                  <NStatistic label="用量差异" :value="billingReconciliation?.totals.usageUnitDelta ?? 0" />
                </NGi>
              </NGrid>
            </NCard>
          </NGi>
        </NGrid>

        <NCard size="small" class="mb-4" title="Billing Ledger 回放预检">
          <template #header-extra>
            <NSpace size="small">
              <NButton size="small" :loading="billingReplayLoading" @click="runBillingReplay(true)">
                预检回放
              </NButton>
              <NPopconfirm
                positive-text="执行非计费回放"
                negative-text="取消"
                :disabled="!billingReplayCanExecute"
                @positive-click="runBillingReplay(false)"
              >
                <template #trigger>
                  <NButton
                    size="small"
                    type="warning"
                    ghost
                    :disabled="!billingReplayCanExecute"
                    :loading="billingReplayLoading"
                  >
                    执行回放
                  </NButton>
                </template>
                仅将当前筛选范围内的历史成功调用幂等写入非计费 shadow ledger，不生成正式账单。
              </NPopconfirm>
            </NSpace>
          </template>
          <NAlert class="mb-3" :type="billingReplayNotice.type" :title="billingReplayNotice.title">
            {{ billingReplayNotice.description }}
          </NAlert>
          <NGrid :cols="5" :x-gap="8" item-responsive>
            <NGi span="5 700:1">
              <NStatistic label="候选记录" :value="billingReplay?.candidateRecords ?? 0" />
            </NGi>
            <NGi span="5 700:1">
              <NStatistic label="尝试写入" :value="billingReplay?.attemptedRecords ?? 0" />
            </NGi>
            <NGi span="5 700:1">
              <NStatistic label="新增记录" :value="billingReplay?.insertedRecords ?? 0" />
            </NGi>
            <NGi span="5 700:1">
              <NStatistic label="已存在/跳过" :value="billingReplay?.existingOrSkippedRecords ?? 0" />
            </NGi>
            <NGi span="5 700:1">
              <NStatistic label="账本记录数" :value="billingReplay ? `${billingReplay.recordCountBefore} → ${billingReplay.recordCountAfter}` : '—'" />
            </NGi>
          </NGrid>
        </NCard>

        <NGrid :cols="5" :x-gap="12" item-responsive class="mb-4">
          <NGi span="5 700:1"><NCard size="small"><NStatistic label="主体数" :value="billingPreview?.totals.subjectCount ?? 0" /></NCard></NGi>
          <NGi span="5 700:1"><NCard size="small"><NStatistic label="调用次数" :value="billingPreview?.totals.calls ?? 0" /></NCard></NGi>
          <NGi span="5 700:1"><NCard size="small"><NStatistic label="预演可扣单位" :value="billingPreview?.totals.previewChargeableUsageUnits ?? 0" /></NCard></NGi>
          <NGi span="5 700:1"><NCard size="small"><NStatistic label="排除单位" :value="billingPreview?.totals.excludedUsageUnits ?? 0" /></NCard></NGi>
          <NGi span="5 700:1"><NCard size="small"><NStatistic label="预估金额" :value="`¥${billingPreview?.totals.estimatedAmountCny ?? '0.00'}`" /></NCard></NGi>
        </NGrid>

        <NCard v-if="billingPreview" size="small" class="mb-4" title="默认计费口径">
          <NDescriptions :column="1" size="small">
            <NDescriptionsItem label="计入预演">{{ billingPreview.policy.billableEvents.join('、') }}</NDescriptionsItem>
            <NDescriptionsItem label="排除事件">{{ billingPreview.policy.excludedEvents.join('、') }}</NDescriptionsItem>
            <NDescriptionsItem label="Workflow">{{ billingPreview.policy.workflowPolicy }}</NDescriptionsItem>
            <NDescriptionsItem label="说明">{{ billingPreview.policy.note }}</NDescriptionsItem>
          </NDescriptions>
        </NCard>

        <NSpace class="mb-3">
          <NButton :loading="billingEvidenceLoading" @click="loadBillingEvidence">刷新计费证据</NButton>
          <NButton type="primary" :disabled="!billingPreview?.items.length" @click="exportBillingCsv">导出预演 CSV</NButton>
          <NButton :disabled="!billingReconciliation?.items.length" @click="exportBillingReconciliationCsv">
            导出对账差异 CSV
          </NButton>
        </NSpace>
        <NDataTable
          v-if="billingReconciliation?.items.length"
          class="mb-4"
          :columns="billingReconciliationColumns"
          :data="billingReconciliation.items"
          :loading="billingReconciliationLoading"
          :pagination="{ pageSize: 10 }"
          :row-key="(row: AiBillingReconciliationItem) => `${row.dateUtc}:${row.subjectType}:${row.subjectId}:${row.toolName}`"
          :scroll-x="1160"
        />
        <NDataTable
          :columns="billingColumns"
          :data="billingPreview?.items ?? []"
          :loading="billingLoading"
          :pagination="{ pageSize: 25 }"
          :row-key="(row: AiBillingPreviewRow) => `${row.dateUtc}:${row.subjectType}:${row.subjectId}:${row.toolName}`"
          :scroll-x="1680"
        />
      </NTabPane>

      <NTabPane v-if="can(P.aiBillingReconcile)" name="gate" tab="生产门禁">
        <NAlert
          class="mb-4"
          :type="productionGateConclusion.type"
          :title="productionGateConclusion.title"
        >
          {{ productionGateConclusion.description }}
        </NAlert>

        <NSpace class="mb-3" align="center">
          <NButton type="primary" :loading="productionGateLoading" @click="loadProductionGateEvidence">
            刷新门禁证据
          </NButton>
          <NButton :disabled="!productionGateRows.length" @click="exportProductionGateMarkdown">
            导出门禁报告
          </NButton>
          <NButton tag="a" :href="usageHelpUrl" target="_blank" rel="noopener noreferrer" tertiary>
            用户边界文档
          </NButton>
        </NSpace>

        <NGrid :cols="4" :x-gap="12" item-responsive class="mb-4">
          <NGi span="4 700:1">
            <NCard size="small"><NStatistic label="阻断项" :value="productionGateTotals.blocked" /></NCard>
          </NGi>
          <NGi span="4 700:1">
            <NCard size="small"><NStatistic label="待复核" :value="productionGateTotals.pending" /></NCard>
          </NGi>
          <NGi span="4 700:1">
            <NCard size="small"><NStatistic label="需关注" :value="productionGateTotals.warning" /></NCard>
          </NGi>
          <NGi span="4 700:1">
            <NCard size="small"><NStatistic label="已通过" :value="productionGateTotals.passed" /></NCard>
          </NGi>
        </NGrid>

        <NCard size="small" class="mb-4" title="门禁快照">
          <NDescriptions :column="2" size="small" bordered>
            <NDescriptionsItem label="发布策略">测试环境和 allowlist 灰度，不做正式公开售卖。</NDescriptionsItem>
            <NDescriptionsItem label="计费状态">
              {{ billingPreview ? `${billingPreview.billingMode} / billable=${billingPreview.billable}` : '未加载' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="计费口径">
              成功工具调用计入预演；鉴权、权限、参数校验、失败调用和工具发现不进入预演扣费。
            </NDescriptionsItem>
            <NDescriptionsItem label="通知边界">当前只允许站内通知；email/webhook 保持关闭。</NDescriptionsItem>
            <NDescriptionsItem label="Billing Ledger">{{ billingLedgerSnapshot }}</NDescriptionsItem>
            <NDescriptionsItem label="中心复制">{{ billingReplicationSnapshot }}</NDescriptionsItem>
            <NDescriptionsItem label="Usage 对账">{{ billingReconciliationSnapshot }}</NDescriptionsItem>
            <NDescriptionsItem label="回答验收">
              已加载 {{ feedbackSampleStats.loaded }} 条，已流转 {{ feedbackSampleStats.reviewed }} 条，目标 30 条。
            </NDescriptionsItem>
            <NDescriptionsItem label="最近样本">
              审计 {{ qualityTotals.calls }} 条，站内通知 {{ notifications?.count ?? 0 }} 条。
            </NDescriptionsItem>
            <NDescriptionsItem label="模型成本基线">
              {{ modelUsage ? `${modelUsage.summary.calls} 次模型调用 · ${modelUsage.summary.totalTokens} tokens · 平均 ${modelUsage.summary.averageDurationMs} ms` : '未加载' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="正式签核">
              {{ releaseSignoffs ? (releaseSignoffs.snapshot.formalReady ? '五个责任角色均已人工批准' : '未完成；内部模拟不计入正式批准') : '未加载' }}
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>

        <NCard v-if="can(P.aiOpsView)" size="small" class="mb-4" title="发布签核记录">
          <template #header-extra>
            <NSpace>
              <NButton size="small" :loading="releaseSignoffsLoading" @click="loadReleaseSignoffs">刷新</NButton>
              <NButton v-if="can(P.aiOpsManage)" size="small" type="primary" @click="openReleaseSignoffModal">
                追加记录
              </NButton>
            </NSpace>
          </template>
          <NAlert
            class="mb-3"
            :type="releaseSignoffs?.snapshot.formalReady ? 'success' : 'warning'"
            :title="releaseSignoffs?.snapshot.formalReady ? '正式人工签核已齐备' : '尚未达到正式发布条件'"
          >
            内部模拟用于发现问题和保存测试证据，不具备人工专家、财务、安全或运维签字效力，也不会让正式门禁通过。
          </NAlert>
          <NGrid :cols="5" :x-gap="10" :y-gap="10" item-responsive class="mb-3">
            <NGi v-for="role in releaseSignoffs?.snapshot.roles ?? []" :key="role.role" span="5 720:1">
              <NCard size="small">
                <div class="flex items-center justify-between gap-2">
                  <strong>{{ releaseRoleLabel(role.role) }}</strong>
                  <NTag size="small" :type="role.formallyApproved ? 'success' : 'warning'">
                    {{ role.formallyApproved ? '人工已批准' : releaseDecisionLabel(role.latest?.decision) }}
                  </NTag>
                </div>
                <div class="mt-2 text-xs text-gray-500">
                  {{ role.latest ? `${role.latest.reviewer} · ${fmt(role.latest.createdAtUtc)}` : '暂无记录' }}
                </div>
              </NCard>
            </NGi>
          </NGrid>
          <NDataTable
            :columns="releaseSignoffColumns"
            :data="releaseSignoffs?.snapshot.items ?? []"
            :loading="releaseSignoffsLoading"
            :pagination="{ pageSize: 10 }"
            :row-key="(row: AiReleaseSignoffRecord) => row.signoffId"
            :scroll-x="1180"
          />
        </NCard>

        <NCard v-if="productionGateBlockers.length" size="small" class="mb-4" title="阻断项">
          <NAlert
            v-for="item in productionGateBlockers"
            :key="`${item.section}:${item.item}`"
            class="mb-2"
            type="error"
            :title="item.item"
          >
            {{ item.nextAction }}
          </NAlert>
        </NCard>

        <NDataTable
          :columns="productionGateColumns"
          :data="productionGateRows"
          :loading="productionGateLoading"
          :pagination="{ pageSize: 20 }"
          :row-key="(row: ProductionGateRow) => `${row.section}:${row.item}`"
          :scroll-x="1320"
        />
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
      v-model:show="releaseSignoffVisible"
      preset="card"
      title="追加发布签核记录"
      style="width:min(620px, calc(100vw - 32px))"
    >
      <NAlert class="mb-4" type="warning" title="记录只追加，提交后不可覆盖或删除">
        当前默认使用内部模拟。只有具名人工评审选择“人工评审 / 批准”，并覆盖全部责任角色，才可能满足正式签核门禁。
      </NAlert>
      <NForm label-placement="top">
        <NFormItem label="发布批次">
          <NInput v-model:value="releaseSignoffForm.releaseId" maxlength="96" />
        </NFormItem>
        <NGrid :cols="2" :x-gap="12">
          <NGi>
            <NFormItem label="责任角色">
              <NSelect v-model:value="releaseSignoffForm.role" :options="releaseRoleOptions" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="评审类型">
              <NSelect v-model:value="releaseSignoffForm.reviewerType" :options="releaseReviewerTypeOptions" />
            </NFormItem>
          </NGi>
        </NGrid>
        <NFormItem label="结论">
          <NSelect v-model:value="releaseSignoffForm.decision" :options="releaseDecisionOptions" />
        </NFormItem>
        <NFormItem label="评审记录">
          <NInput
            v-model:value="releaseSignoffForm.notes"
            type="textarea"
            maxlength="2000"
            show-count
            :autosize="{ minRows: 4, maxRows: 8 }"
            placeholder="记录检查范围、依据、发现的问题和剩余风险；不要粘贴密码、token、请求头或连接串。"
          />
        </NFormItem>
        <NFormItem label="证据引用（可选）">
          <NInput
            v-model:value="releaseSignoffForm.evidenceRef"
            maxlength="500"
            placeholder="文档路径、工单编号或不含凭证的报告引用"
          />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton :disabled="releaseSignoffSubmitting" @click="releaseSignoffVisible = false">取消</NButton>
          <NButton type="primary" :loading="releaseSignoffSubmitting" @click="submitReleaseSignoff">确认追加</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal
      v-model:show="feedbackReviewVisible"
      preset="card"
      :title="feedbackReviewTitle"
      style="width:min(560px, calc(100vw - 32px))"
    >
      <NSpace v-if="feedbackReviewTarget" vertical size="large">
        <NDescriptions :column="1" size="small" bordered>
          <NDescriptionsItem label="回答">{{ feedbackReviewTarget.answerId }}</NDescriptionsItem>
          <NDescriptionsItem label="问题">{{ feedbackReviewTarget.questionText || '—' }}</NDescriptionsItem>
          <NDescriptionsItem label="用户反馈">{{ feedbackReviewTarget.commentText || feedbackIssueSummary(feedbackReviewTarget) }}</NDescriptionsItem>
          <NDescriptionsItem label="工具">{{ feedbackReviewTarget.toolName || '—' }}</NDescriptionsItem>
          <NDescriptionsItem label="Trace">{{ feedbackReviewTarget.traceId || '—' }}</NDescriptionsItem>
          <NDescriptionsItem label="审计 Trace">
            {{ feedbackReviewTarget.auditTraceIds?.length ? feedbackReviewTarget.auditTraceIds.map(shortTraceId).join('、') : '—' }}
          </NDescriptionsItem>
        </NDescriptions>
        <NAlert type="warning" title="模拟专家验收检查项">
          <ul class="ml-4 list-disc text-sm leading-6">
            <li v-for="rule in qualityReviewRules" :key="rule.id">
              {{ rule.label }}：{{ rule.description }}
            </li>
          </ul>
        </NAlert>
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
  AiAnswerQualityEvaluation,
  AiAnswerQualityEvaluationResult,
  AiAgentModelUsageResult,
  AiAgentModelUsageRow,
  AiReleaseSignoffRecord,
  AiReleaseSignoffResult,
  AiAuditResult,
  AiAuditRow,
  AiBillingPreviewResult,
  AiBillingPreviewRow,
  AiBillingReconciliationItem,
  AiBillingReconciliationResult,
  AiBillingReplayResult,
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
const config = useRuntimeConfig()
const helpCenterUrl = computed(() => String(config.public.helpCenterUrl || 'https://help-test.spdex.com').replace(/\/$/, ''))
const usageHelpUrl = computed(() => `${helpCenterUrl.value}/ai/ai-mcp-usage-quota`)
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
interface QualityReviewRule {
  id: string
  label: string
  description: string
  required: boolean
}
interface FeedbackRiskPool {
  id: string
  label: string
  description: string
  issueTag?: string
  searchTerm?: string
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
type ProductionGateStatus = 'passed' | 'warning' | 'pending' | 'blocked'
interface ProductionGateRow {
  section: string
  item: string
  status: ProductionGateStatus
  evidence: string
  owner: string
  nextAction: string
}
const route = useRoute()
const routeTraceId = queryString(route.query.traceId)
const activeTab = ref(initialTab())
const range = ref<[number, number] | null>(defaultRange())
const usage = ref<AiUsageResult | null>(null)
const billingPreview = ref<AiBillingPreviewResult | null>(null)
const billingReconciliation = ref<AiBillingReconciliationResult | null>(null)
const billingReplay = ref<AiBillingReplayResult | null>(null)
const audit = ref<AiAuditResult | null>(null)
const trace = ref<AiAuditResult | null>(null)
const notifications = ref<AiInAppNotificationResult | null>(null)
const feedback = ref<AiAnswerFeedbackResult | null>(null)
const answerQuality = ref<AiAnswerQualityEvaluationResult | null>(null)
const modelUsage = ref<AiAgentModelUsageResult | null>(null)
const releaseSignoffs = ref<AiReleaseSignoffResult | null>(null)
const goldenCandidates = ref<AiGoldenSampleCandidateResult | null>(null)
const usageLoading = ref(false)
const billingLoading = ref(false)
const billingReconciliationLoading = ref(false)
const billingReplayLoading = ref(false)
const auditLoading = ref(false)
const traceLoading = ref(false)
const notificationsLoading = ref(false)
const feedbackLoading = ref(false)
const answerQualityLoading = ref(false)
const modelUsageLoading = ref(false)
const releaseSignoffsLoading = ref(false)
const goldenCandidatesLoading = ref(false)
const productionGateLoading = ref(false)
const traceDrawerVisible = ref(false)
const feedbackReviewVisible = ref(false)
const releaseSignoffVisible = ref(false)
const releaseSignoffSubmitting = ref(false)
const feedbackReviewSubmitting = ref(false)
const feedbackReviewTarget = ref<AiAnswerFeedbackRow | null>(null)
const feedbackCheckedKeys = ref<string[]>([])
const traceId = ref(routeTraceId)
const feedbackReviewForm = reactive({
  status: 'reviewing',
  severity: 'medium',
  reviewReason: '',
})
const releaseSignoffForm = reactive({
  releaseId: 'p6-controlled-pre-release',
  role: 'product',
  reviewerType: 'internal_simulation',
  decision: 'simulated',
  notes: '',
  evidenceRef: '',
})
watch(() => releaseSignoffForm.reviewerType, (reviewerType) => {
  releaseSignoffForm.decision = reviewerType === 'internal_simulation' ? 'simulated' : 'needs_work'
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
  issueTag: string
  searchTerm: string
  traceId: string
  riskPool: string
  limit: number
}>({
  status: routeTraceId ? '' : 'new',
  feedbackType: '',
  tool: '',
  issueTag: '',
  searchTerm: '',
  traceId: routeTraceId,
  riskPool: '',
  limit: 100,
})
const answerQualityFilters = reactive({
  category: '',
  passed: '',
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
const answerQualityCategoryOptions = [
  { label: '全部场景', value: '' },
  { label: '大额交易', value: 'big_trades' },
  { label: '市场异常', value: 'market_anomaly' },
  { label: '预测市场背离', value: 'prediction_divergence' },
  { label: '观察条件', value: 'watch_condition' },
  { label: '赛中信号', value: 'live_signal' },
  { label: '指标解释', value: 'metric_explanation' },
  { label: '通用问题', value: 'general' },
]
const answerQualityPassedOptions = [
  { label: '全部结果', value: '' },
  { label: '规则通过', value: 'true' },
  { label: '需人工复核', value: 'false' },
]
const releaseRoleOptions = [
  { label: '产品负责人', value: 'product' },
  { label: '财务负责人', value: 'finance' },
  { label: '安全负责人', value: 'security' },
  { label: '运维负责人', value: 'operations' },
  { label: '足球专家', value: 'football_expert' },
]
const releaseReviewerTypeOptions = [
  { label: '内部模拟（不具备正式效力）', value: 'internal_simulation' },
  { label: '具名人工评审', value: 'human' },
]
const releaseDecisionOptions = computed(() => releaseSignoffForm.reviewerType === 'internal_simulation'
  ? [{ label: '完成内部模拟', value: 'simulated' }]
  : [
      { label: '需要继续完善', value: 'needs_work' },
      { label: '不批准', value: 'rejected' },
      { label: '批准', value: 'approved' },
    ])
const issueTagOptions = [
  { label: '全部标签', value: '' },
  { label: '数据不准确', value: 'wrong_data' },
  { label: '缺少关键背景', value: 'missing_critical_context' },
  { label: '排序不合理', value: 'ranking_issue' },
  { label: '阈值需校准', value: 'threshold_issue' },
  { label: '字段不清楚', value: 'field_name_issue' },
  { label: '背离解释不足', value: 'prediction_market_gap' },
  { label: '表达看不懂', value: 'unclear_wording' },
]
const qualityReviewRules: QualityReviewRule[] = [
  {
    id: 'conclusion_first',
    label: '结论先行',
    description: '回答先给直接判断，再展开盘口、成交、异常或背离证据。',
    required: true,
  },
  {
    id: 'data_boundary',
    label: '数据边界',
    description: '说明哪些数据可用、哪些缺失或未返回，避免把缺失说成没有异常。',
    required: true,
  },
  {
    id: 'non_betting_advice',
    label: '非投注建议',
    description: '只表达市场观察和风险提示，不给投注指令、胜负推荐或确定性预测。',
    required: true,
  },
  {
    id: 'human_labels',
    label: '中文可读',
    description: '字段、标签和证据说明使用中文业务语言，不直接暴露内部代码名。',
    required: true,
  },
  {
    id: 'risk_distinction',
    label: '风险类型区分',
    description: '区分异常、大额单笔、连续放量、Hold/共振和预测市场背离。',
    required: true,
  },
  {
    id: 'trace_linked',
    label: 'Trace 可回查',
    description: '反馈记录能关联回答 trace 和工具审计 trace，便于复盘和回归。',
    required: true,
  },
]
const feedbackRiskPools: FeedbackRiskPool[] = [
  {
    id: 'large_trade',
    label: '大额交易',
    description: '大额单笔、连续放量、成交量时间分布。',
    searchTerm: '大额',
  },
  {
    id: 'anomaly',
    label: '异常证据',
    description: '异常观察分、阈值、异常标签解释。',
    searchTerm: '异常',
  },
  {
    id: 'watch_condition',
    label: '观察条件',
    description: 'watch condition、触发条件、持续观察。',
    searchTerm: '观察条件',
  },
  {
    id: 'prediction_divergence',
    label: '预测市场背离',
    description: 'SPdex 与外部预测市场差异解释。',
    issueTag: 'prediction_market_gap',
    searchTerm: '背离',
  },
  {
    id: 'live_signal',
    label: '赛中信号',
    description: '赛中盘、实时数据、临场信号。',
    searchTerm: '赛中',
  },
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
    successfulUnits: total.successfulUnits + row.successfulUsageUnits,
    failedUnits: total.failedUnits + row.failedUsageUnits,
  }),
  { calls: 0, success: 0, failed: 0, units: 0, successfulUnits: 0, failedUnits: 0 },
))

const billingEvidenceLoading = computed(() => billingLoading.value || billingReconciliationLoading.value)
const billingLedger = computed(() => billingPreview.value?.billingLedger ?? null)
const billingLedgerStatusText = computed(() => {
  const ledger = billingLedger.value
  if (!ledger) return '未加载'
  if (ledger.billable) return '正式扣费已开启'
  if (!ledger.enabled) return '未启用'
  if (!ledger.healthy) return '异常'
  return '健康'
})
const billingLedgerStatusTag = computed(() => {
  const ledger = billingLedger.value
  if (!ledger) return 'default'
  if (ledger.billable || !ledger.healthy) return 'error'
  if (!ledger.enabled) return 'warning'
  return 'success'
})
const billingLedgerNotice = computed(() => {
  const ledger = billingLedger.value
  if (!ledger) {
    return {
      type: 'info' as const,
      title: 'Billing Ledger 尚未加载',
      description: '刷新计费证据后，可查看影子账本开关、健康状态和记录规模。',
    }
  }
  if (ledger.billable) {
    return {
      type: 'error' as const,
      title: '正式扣费开关已开启',
      description: '当前阶段不应打开 billable。请立即停止发布流程，确认没有生成正式账单或扣除真实额度。',
    }
  }
  if (!ledger.enabled) {
    return {
      type: 'warning' as const,
      title: '影子账本未启用',
      description: '当前只做非计费预演和接口门禁验证；正式售卖前必须启用集中账本或等价的双写对账链路。',
    }
  }
  if (!ledger.healthy) {
    return {
      type: 'error' as const,
      title: 'Billing Ledger 写入或读取异常',
      description: '账本不健康时不得进入正式扣费；需要先排查写入失败、存储权限、备份恢复和对账结果。',
    }
  }
  return {
    type: 'success' as const,
    title: 'Billing Ledger 可用',
    description: '影子账本已启用且健康，可用于与 usage ledger 进行非计费对账。',
  }
})
const billingReplicationNotice = computed(() => {
  const ledger = billingLedger.value
  if (!ledger) {
    return {
      type: 'info' as const,
      title: '中心复制状态尚未加载',
      description: '刷新计费证据后，可查看待复制、死信和最近成功复制时间。',
    }
  }
  if (!ledger.replicationEnabled) {
    return {
      type: 'warning' as const,
      title: '中心复制保持关闭',
      description: '当前只运行本地非计费影子账本。正式收费前必须完成独立中心账本、持久双写和恢复演练。',
    }
  }
  if (!ledger.replicationHealthy || ledger.deadLetterReplicationEvents > 0) {
    return {
      type: 'error' as const,
      title: '中心复制链路异常',
      description: `待复制 ${ledger.pendingReplicationEvents} 条，死信 ${ledger.deadLetterReplicationEvents} 条。应先停止计费发布流程并完成重放或冲正。`,
    }
  }
  if (ledger.pendingReplicationEvents > 0) {
    return {
      type: 'warning' as const,
      title: '中心复制仍有积压',
      description: `当前有 ${ledger.pendingReplicationEvents} 条待复制事件，需确认积压能在运行手册规定的时限内清零。`,
    }
  }
  return {
    type: 'success' as const,
    title: '中心复制链路健康',
    description: '复制队列无积压和死信，仍需结合 Usage 对账、备份恢复与人工签字判断是否可正式收费。',
  }
})
const billingReconciliationNotice = computed(() => {
  const reconciliation = billingReconciliation.value
  if (!reconciliation) {
    return {
      type: 'info' as const,
      title: 'Usage 对账尚未加载',
      description: '刷新对账后，可查看成功工具调用与 billing ledger 写入是否一致。',
    }
  }
  if (reconciliation.billable && !reconciliation.matches) {
    return {
      type: 'error' as const,
      title: '正式计费对账不一致',
      description: 'billable=true 时任何 usage 与 billing ledger 差异都属于阻断项。',
    }
  }
  if (!reconciliation.healthy) {
    return {
      type: 'error' as const,
      title: '对账链路异常',
      description: '无法可靠读取 billing ledger，需先修复后再继续灰度评审。',
    }
  }
  if (!reconciliation.enabled) {
    return {
      type: 'warning' as const,
      title: '账本未启用，对账只验证接口可达',
      description: '当前差异来自 billing ledger 未写入，是非计费测试阶段的预期状态；正式售卖前必须消除该差异。',
    }
  }
  if (!reconciliation.matches) {
    return {
      type: 'warning' as const,
      title: '影子账本存在对账差异',
      description: '非计费阶段可继续排查；正式扣费前需要把调用数和 usage units 差异归零。',
    }
  }
  return {
    type: 'success' as const,
    title: 'Usage 与 Billing Ledger 一致',
    description: '当前筛选范围内成功调用数和可扣 usage units 均已对齐。',
  }
})
const billingLedgerSnapshot = computed(() => {
  const ledger = billingLedger.value
  if (!ledger) return '未加载'
  return `${billingLedgerStatusText.value} · ${ledger.provider} · ${ledger.billingMode} · ${ledger.recordCount} 条`
})
const billingReplicationSnapshot = computed(() => {
  const ledger = billingLedger.value
  if (!ledger) return '未加载'
  if (!ledger.replicationEnabled) return '未启用 · 正式收费阻断'
  return `${ledger.replicationHealthy ? '健康' : '异常'} · 待复制 ${ledger.pendingReplicationEvents} · 死信 ${ledger.deadLetterReplicationEvents}`
})
const billingReconciliationSnapshot = computed(() => {
  const reconciliation = billingReconciliation.value
  if (!reconciliation) return '未加载'
  return `${reconciliation.matches ? '一致' : '有差异'} · 调用差 ${reconciliation.totals.callDelta} · 用量差 ${reconciliation.totals.usageUnitDelta}`
})
const billingReplayCanExecute = computed(() => {
  const ledger = billingLedger.value
  const replay = billingReplay.value
  return Boolean(
    ledger?.enabled &&
    ledger.healthy &&
    !ledger.billable &&
    replay?.dryRun &&
    replay.candidateRecords > 0,
  )
})
const billingReplayNotice = computed(() => {
  const ledger = billingLedger.value
  const replay = billingReplay.value
  if (!replay) {
    return {
      type: 'info' as const,
      title: '先做 dry-run 预检',
      description: '回放用于把历史 successful usage 幂等写入非计费 shadow ledger，帮助排查账本启用前造成的对账差异。',
    }
  }
  if (replay.status.startsWith('blocked')) {
    return {
      type: 'error' as const,
      title: '回放被阻断',
      description: replay.message,
    }
  }
  if (!ledger?.enabled) {
    return {
      type: 'warning' as const,
      title: '账本未启用',
      description: '当前只能预检候选记录，不能写入 billing ledger。正式售卖前应启用集中账本或双写对账。',
    }
  }
  if (ledger.billable) {
    return {
      type: 'error' as const,
      title: '正式扣费开关异常',
      description: 'billable=true 时前端和后端都会阻断普通回放，避免历史记录被误写成正式计费事件。',
    }
  }
  if (replay.dryRun) {
    return {
      type: replay.candidateRecords > 0 ? 'warning' as const : 'success' as const,
      title: replay.candidateRecords > 0 ? '发现可回放成功调用' : '当前筛选范围无候选记录',
      description: replay.message,
    }
  }
  return {
    type: replay.healthy ? 'success' as const : 'warning' as const,
    title: replay.healthy ? '非计费回放完成' : '回放完成但账本需复核',
    description: replay.message,
  }
})

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
const modelFailureRate = computed(() => {
  const summary = modelUsage.value?.summary
  if (!summary?.calls) return '0%'
  return `${Math.round((summary.failedCalls / summary.calls) * 1000) / 10}%`
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
const feedbackSampleStats = computed(() => {
  const rows = feedback.value?.items ?? []
  const target = 30
  const reviewed = rows.filter(row => row.status !== 'new').length
  const auditTraceLinked = rows.filter(row => row.auditTraceIds?.length).length
  return {
    target,
    loaded: rows.length,
    reviewed,
    progress: Math.min(100, Math.round((reviewed / target) * 100)),
    auditTraceCoverage: rows.length ? Math.round((auditTraceLinked / rows.length) * 100) : 0,
  }
})
const productionGateRows = computed<ProductionGateRow[]>(() => {
  const billing = billingPreview.value
  const ledger = billing?.billingLedger ?? null
  const reconciliation = billingReconciliation.value
  const notificationRows = notifications.value?.items ?? []
  const billingStatus = !billing
    ? 'pending'
    : billing.billable
      ? 'blocked'
      : billing.billingMode === 'test_metering_only'
        ? 'passed'
        : 'warning'
  const billingTotalsComplete = Boolean(
    billing &&
    Number.isFinite(billing.totals.meteredUsageUnits) &&
    Number.isFinite(billing.totals.previewChargeableUsageUnits) &&
    Number.isFinite(billing.totals.excludedUsageUnits),
  )
  const notificationPayloadSafe = notificationRows.every(row => row.payloadRef?.rawPayloadOmitted !== false)
  const feedbackLoaded = feedback.value !== null
  const feedbackStats = feedbackSampleStats.value
  const ledgerStatus = !ledger
    ? 'pending'
    : ledger.billable
      ? 'blocked'
      : !ledger.healthy
        ? 'blocked'
        : ledger.enabled
          ? 'passed'
          : 'warning'
  const commercialBillingStatus = !ledger
    ? 'pending'
    : ledger.commercialBillingReady
      ? 'passed'
      : 'blocked'
  const reconciliationStatus = !reconciliation
    ? 'pending'
    : !reconciliation.healthy
      ? 'blocked'
      : reconciliation.billable && !reconciliation.matches
        ? 'blocked'
        : !reconciliation.enabled
          ? 'warning'
          : reconciliation.matches
            ? 'passed'
            : 'warning'

  return [
    productionGateRow(
      '发布边界',
      'AI 观察助手仍按 allowlist 灰度',
      'warning',
      'NewSpdex AI 入口由后端 AI access gate 控制；正式前仍需用普通账号复核不可见。',
      '产品 / QA',
      '发布前用普通非测试账号验证：首页、/ai、/push 和账号中心均不展示 AI/MCP/通知实验入口。',
    ),
    productionGateRow(
      '正式域名',
      'mcp.spdex.com 仅用于受控预发布 smoke',
      'warning',
      'P5 预发布 smoke 已通过 health、readiness、metadata、tools/list 和 bearer 工具调用；仍不对外宣发。',
      '运维 / 安全',
      '正式售卖前确认独立生产实例或独立凭证域、Host allowlist、回滚开关和事故响应值班。',
    ),
    productionGateRow(
      '计费',
      '正式扣费开关保持关闭',
      billingStatus,
      billing
        ? `${billing.billingMode}，billable=${billing.billable}，pricing=${billing.pricingStatus}`
        : '尚未加载账单预演，请刷新门禁证据。',
      '产品 / 财务',
      billing?.billable
        ? '立即停止发布流程，确认没有真实扣费或正式账单生成。'
        : '正式售卖前完成套餐、额度扣减、冲正/退款、账单对账和签字流程。',
    ),
    productionGateRow(
      '计费',
      '预演用量拆分完整',
      !billing ? 'pending' : billingTotalsComplete ? 'passed' : 'warning',
      billing
        ? `审计 ${billing.totals.meteredUsageUnits}，预演可扣 ${billing.totals.previewChargeableUsageUnits}，排除 ${billing.totals.excludedUsageUnits}。`
        : '尚未加载账单预演。',
      '财务 / 后端',
      '对比 usage ledger 与预演 CSV，确认失败调用和校验错误不进入可扣单位。',
    ),
    productionGateRow(
      '计费',
      'Admin 支持账单预演导出',
      'passed',
      '计费对账页可按日期、工具、主体筛选并导出预演 CSV。',
      '运营 / 财务',
      '每次灰度评审导出一份样本，与审计 trace 抽查对齐。',
    ),
    productionGateRow(
      '计费',
      'Billing ledger 写入开关和健康状态',
      ledgerStatus,
      ledger
        ? `${ledger.enabled ? 'enabled' : 'disabled'}，provider=${ledger.provider}，billable=${ledger.billable}，healthy=${ledger.healthy}，records=${ledger.recordCount}。`
        : '尚未加载 billing ledger 状态。',
      '后端 / 财务',
      ledger?.billable
        ? '立即关闭 billable 并核查是否产生真实账单。'
        : ledger?.healthy === false
          ? '修复账本读写异常后再继续灰度评审。'
          : ledger?.enabled
            ? '继续复核 usage 对账结果和备份恢复状态。'
            : '测试阶段可保持关闭；正式售卖前必须启用集中账本或等价双写对账链路。',
    ),
    productionGateRow(
      '计费',
      '商业化计费链路完整',
      commercialBillingStatus,
      ledger
        ? `中心账本=${ledger.centralized ? '是' : '否'}，持久双写=${ledger.durableDoubleWrite ? '是' : '否'}，送达确认=${ledger.deliveryFinalizationEnabled ? '是' : '否'}，冲正落账=${ledger.appliedAdjustmentsEnabled ? '是' : '否'}，复制=${ledger.replicationEnabled ? (ledger.replicationHealthy ? '健康' : '异常') : '关闭'}，待复制=${ledger.pendingReplicationEvents}，死信=${ledger.deadLetterReplicationEvents}。`
        : '尚未加载商业化计费链路证据。',
      '后端 / 财务 / 运维',
      ledger?.commercialBillingReady
        ? '继续执行财务对账、恢复演练与发布签字；自动门禁通过不等于已经批准正式收费。'
        : '保持 billable=false；完成独立中心账本、持久双写、送达确认、冲正落账、零死信和无差异对账后再提交正式收费评审。',
    ),
    productionGateRow(
      '计费',
      'Usage 与 billing ledger 可对账',
      reconciliationStatus,
      reconciliation
        ? `matches=${reconciliation.matches}，usage calls=${reconciliation.totals.usageSuccessfulCalls}，ledger rows=${reconciliation.totals.billingRows}，usage units=${reconciliation.totals.usageChargeableUnits}，ledger units=${reconciliation.totals.billingUsageUnits}。`
        : '尚未加载 usage 与 billing ledger 对账。',
      '财务 / 后端',
      reconciliation?.billable && !reconciliation.matches
        ? '正式扣费状态下对账差异为阻断项，必须暂停发布并回放账本。'
        : reconciliation?.enabled
          ? '对差异明细逐项核查，正式扣费前把调用数和 usage units 差异归零。'
          : '当前 ledger 未启用导致差异属预期；正式售卖前必须跑通无差异对账。',
    ),
    productionGateRow(
      '通知',
      '通知 release switch 独立于 AI 入口',
      'passed',
      '站内通知接口使用独立 NotificationsEnabled 门禁；AI 可见不等于通知可见。',
      '产品 / 后端',
      '保持 AI 入口、观察条件写入和通知中心三个开关分离。',
    ),
    productionGateRow(
      '通知',
      'P5 只开放站内通知',
      'passed',
      '用户侧隐藏 email/webhook 配置，当前 provider drill 只允许站内消息。',
      '产品 / 运维',
      '外部通知 provider 凭证、重试和失败告警完成前，不开放邮件和 Webhook。',
    ),
    productionGateRow(
      '通知',
      '用户侧收件箱不暴露原始 payload',
      notifications.value === null
        ? 'pending'
        : notificationPayloadSafe
          ? 'passed'
          : 'blocked',
      notifications.value === null
        ? '尚未加载站内通知样本。'
        : `${notificationRows.length} 条样本，raw payload ${notificationPayloadSafe ? '均已省略' : '存在暴露风险'}。`,
      '前端 / 安全',
      notificationPayloadSafe
        ? '继续抽样检查通知详情和 Admin 通知抽屉。'
        : '立即修正通知接口或前端展示，禁止原始 payload 对用户或普通运营可见。',
    ),
    productionGateRow(
      '回答验收',
      '真实问题抽样状态流转',
      !feedbackLoaded
        ? 'pending'
        : feedbackStats.reviewed >= feedbackStats.target
          ? 'passed'
          : 'warning',
      feedbackLoaded
        ? `已加载 ${feedbackStats.loaded} 条，已流转 ${feedbackStats.reviewed}/${feedbackStats.target}，trace 覆盖 ${feedbackStats.auditTraceCoverage}%。`
        : '尚未加载回答反馈。',
      '运营 / 产品',
      '继续处理大额交易、异常证据、预测市场背离、watch condition 和赛中信号问题池。',
    ),
    productionGateRow(
      '成本治理',
      '模型用量可按 provider 和 model 追踪',
      modelUsage.value ? 'passed' : 'pending',
      modelUsage.value
        ? `${modelUsage.value.summary.calls} 次调用，输入 ${modelUsage.value.summary.inputTokens} tokens，输出 ${modelUsage.value.summary.outputTokens} tokens，失败 ${modelUsage.value.summary.failedCalls} 次，平均响应 ${modelUsage.value.summary.averageDurationMs} ms。`
        : '尚未加载模型用量聚合。',
      '后端 / 运营 / 财务',
      '供应商单价变化时单独维护价格表和生效区间；不要把当前 token 聚合误认为供应商正式账单。',
    ),
    productionGateRow(
      '发布签核',
      '五个责任角色均已具名人工批准',
      !releaseSignoffs.value
        ? 'pending'
        : releaseSignoffs.value.snapshot.formalReady
          ? 'passed'
          : 'blocked',
      releaseSignoffs.value
        ? `${releaseSignoffs.value.snapshot.roles.filter(role => role.formallyApproved).length}/${releaseSignoffs.value.snapshot.requiredRoles.length} 个角色已人工批准；内部模拟记录不计入正式批准。`
        : '尚未加载发布签核记录。',
      '产品 / 财务 / 安全 / 运维 / 足球专家',
      releaseSignoffs.value?.snapshot.formalReady
        ? '保留追加式证据记录；任何角色后续追加“不批准”或“需要完善”都会重新阻断门禁。'
        : '当前继续按测试环境和 allowlist 灰度运行；正式发布前完成五个角色的具名人工评审。',
    ),
    productionGateRow(
      '帮助中心',
      '用户边界文档已接入',
      'passed',
      'NewSpdex AI、MCP token、OAuth 授权、Admin 计费对账已链接到同一帮助中心用量与安全边界文章。',
      '产品 / 文档',
      '正式前再做一次普通用户视角校对，避免内部过程、接口和未确认价格进入文案。',
    ),
    productionGateRow(
      '凭证安全',
      '测试凭证清理与正式凭证域隔离',
      'pending',
      '已有 inventory/revoke 脚本和 Host allowlist；正式售卖仍建议独立生产实例或独立凭证域。',
      '安全 / 运维',
      '正式评审前导出活跃凭证 inventory，撤销过期测试凭证，确认测试 token 不可用于正式域。',
    ),
    productionGateRow(
      '运维',
      'Ledger 备份和恢复演练',
      'passed',
      '2026-08-05 已完成外部备份与临时 Docker volume 恢复演练，记录数 1777，完整性校验通过，生产 volume 未挂载到恢复流程。',
      '后端 / 运维',
      '保持每日归档和外部备份新鲜度监控；每次正式灰度评审前复跑恢复演练。',
    ),
    productionGateRow(
      '运维',
      '正式计费账本存储策略',
      'warning',
      '本地 shadow billing ledger、append-only 保护和 reconciliation API 已实现；正式多实例售卖前仍必须迁移集中账本或启用双写对账。',
      '后端 / 运维',
      '在 billable=true 之前完成集中存储/双写实施、回放校验、备份恢复和财务对账签字。',
    ),
  ]
})
const productionGateTotals = computed(() => productionGateRows.value.reduce(
  (totals, row) => ({
    passed: totals.passed + (row.status === 'passed' ? 1 : 0),
    warning: totals.warning + (row.status === 'warning' ? 1 : 0),
    pending: totals.pending + (row.status === 'pending' ? 1 : 0),
    blocked: totals.blocked + (row.status === 'blocked' ? 1 : 0),
  }),
  { passed: 0, warning: 0, pending: 0, blocked: 0 },
))
const productionGateBlockers = computed(() =>
  productionGateRows.value.filter(row => row.status === 'blocked'))
const productionGateConclusion = computed(() => {
  const totals = productionGateTotals.value
  if (totals.blocked > 0) {
    return {
      type: 'error' as const,
      title: '不得进入正式灰度',
      description: `当前存在 ${totals.blocked} 个阻断项，需要先处理真实风险。`,
    }
  }
  if (totals.pending > 0 || totals.warning > 0) {
    return {
      type: 'warning' as const,
      title: '继续测试和预发布，不进入正式售卖',
      description: `当前无真实阻断风险，但还有 ${totals.pending} 个待复核项、${totals.warning} 个需关注项；仍应保持 billable=false 和 allowlist 灰度。`,
    }
  }
  return {
    type: 'success' as const,
    title: '可提交小范围正式灰度评审',
    description: '所有自动化门禁证据已通过；仍需产品、财务、安全和运维签字后才能正式开放。',
  }
})
const riskPoolCounts = computed(() => {
  const counts: Record<string, number> = {}
  const rows = feedback.value?.items ?? []
  for (const pool of feedbackRiskPools) {
    counts[pool.id] = rows.filter(row => feedbackMatchesRiskPool(row, pool)).length
  }
  return counts
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
  if (can(P.aiBillingReconcile)) {
    allowed.add('billing')
    allowed.add('gate')
  }
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

async function drillIntoSubject(row: Pick<AiUsageRow, 'subjectType' | 'subjectId'>) {
  usageFilters.subjectType = row.subjectType
  usageFilters.subjectId = row.subjectId
  activeTab.value = 'usage'
  await Promise.allSettled([
    loadUsage(),
    can(P.aiBillingReconcile) ? loadBillingEvidence() : Promise.resolve(),
  ])
  message.success(`已切换到 ${row.subjectType}:${row.subjectId} 的用量详情`)
}

async function clearSubjectDrill() {
  usageFilters.subjectType = ''
  usageFilters.subjectId = ''
  await Promise.allSettled([
    loadUsage(),
    can(P.aiBillingReconcile) ? loadBillingEvidence() : Promise.resolve(),
  ])
}

const usageColumns = [
  { title: 'UTC 日期', key: 'dateUtc', width: 120 },
  {
    title: '主体',
    key: 'subjectId',
    width: 210,
    render: (row: AiUsageRow) => h('div', [
      h(
        NButton,
        {
          text: true,
          type: 'primary',
          title: '查看该主体的用量与账单预演',
          onClick: () => drillIntoSubject(row),
        },
        { default: () => row.subjectId },
      ),
      h('div', { class: 'text-xs text-gray-400' }, row.subjectType),
    ]),
  },
  { title: '工具', key: 'toolName', width: 210 },
  { title: '调用', key: 'calls', width: 80 },
  { title: '成功', key: 'successfulCalls', width: 80 },
  { title: '失败', key: 'failedCalls', width: 80 },
  { title: '总计量', key: 'usageUnits', width: 90 },
  { title: '成功用量', key: 'successfulUsageUnits', width: 100 },
  { title: '排除用量', key: 'failedUsageUnits', width: 100 },
  { title: '来源', key: 'principalSource', width: 170, render: (row: AiUsageRow) => row.principalSource || '—' },
  { title: '权益', key: 'entitlementProfile', width: 120, render: (row: AiUsageRow) => row.entitlementProfile || '—' },
  { title: 'AI Client', key: 'aiClientId', width: 150, render: (row: AiUsageRow) => row.aiClientId || '—' },
  { title: '最后调用', key: 'lastSeenUtc', width: 170, render: (row: AiUsageRow) => fmt(row.lastSeenUtc) },
]

const billingColumns = [
  { title: 'UTC 日期', key: 'dateUtc', width: 120 },
  {
    title: '主体',
    key: 'subjectId',
    width: 210,
    render: (row: AiBillingPreviewRow) => h('div', [
      h('div', row.subjectId),
      h('div', { class: 'text-xs text-gray-400' }, row.subjectType),
    ]),
  },
  { title: '工具', key: 'toolName', width: 220 },
  { title: '调用', key: 'calls', width: 80 },
  { title: '成功', key: 'successfulCalls', width: 80 },
  { title: '失败', key: 'failedCalls', width: 80 },
  { title: '审计计量', key: 'meteredUsageUnits', width: 100 },
  { title: '预演可扣', key: 'previewChargeableUsageUnits', width: 100 },
  { title: '排除', key: 'excludedUsageUnits', width: 80 },
  {
    title: '计费状态',
    key: 'billable',
    width: 110,
    render: (row: AiBillingPreviewRow) => h(
      NTag,
      { type: row.billable ? 'warning' : 'info', size: 'small' },
      { default: () => row.billable ? '可计费' : '不计费' },
    ),
  },
  {
    title: '排除原因',
    key: 'exclusionReason',
    width: 210,
    render: (row: AiBillingPreviewRow) => formatBillingExclusion(row.exclusionReason),
  },
  { title: '来源', key: 'principalSource', width: 170, render: (row: AiBillingPreviewRow) => row.principalSource || '—' },
  { title: '权益', key: 'entitlementProfile', width: 120, render: (row: AiBillingPreviewRow) => row.entitlementProfile || '—' },
  { title: 'AI Client', key: 'aiClientId', width: 150, render: (row: AiBillingPreviewRow) => row.aiClientId || '—' },
  { title: '最后调用', key: 'lastSeenUtc', width: 170, render: (row: AiBillingPreviewRow) => fmt(row.lastSeenUtc) },
]

const billingReconciliationColumns = [
  { title: 'UTC 日期', key: 'dateUtc', width: 120 },
  {
    title: '主体',
    key: 'subjectId',
    width: 210,
    render: (row: AiBillingReconciliationItem) => h('div', [
      h('div', row.subjectId),
      h('div', { class: 'text-xs text-gray-400' }, row.subjectType),
    ]),
  },
  { title: '工具', key: 'toolName', width: 250 },
  { title: 'Usage 成功调用', key: 'usageSuccessfulCalls', width: 130 },
  { title: 'Ledger 记录', key: 'billingRows', width: 110 },
  {
    title: '调用差异',
    key: 'callDelta',
    width: 100,
    render: (row: AiBillingReconciliationItem) => h(
      NTag,
      { type: row.callDelta === 0 ? 'success' : 'warning', size: 'small' },
      { default: () => String(row.callDelta) },
    ),
  },
  { title: 'Usage 可扣单位', key: 'usageChargeableUnits', width: 130 },
  { title: 'Ledger 用量', key: 'billingUsageUnits', width: 110 },
  {
    title: '用量差异',
    key: 'usageUnitDelta',
    width: 100,
    render: (row: AiBillingReconciliationItem) => h(
      NTag,
      { type: row.usageUnitDelta === 0 ? 'success' : 'warning', size: 'small' },
      { default: () => String(row.usageUnitDelta) },
    ),
  },
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
const modelUsageColumns = [
  { title: 'Provider', key: 'provider', width: 150 },
  { title: '模型', key: 'model', width: 190 },
  { title: '调用', key: 'calls', width: 80 },
  {
    title: '失败率',
    key: 'failureRate',
    width: 100,
    render: (row: AiAgentModelUsageRow) => {
      const rate = row.calls ? Math.round((row.failedCalls / row.calls) * 1000) / 10 : 0
      return h(NTag, { size: 'small', type: rate === 0 ? 'success' : rate <= 5 ? 'warning' : 'error' }, { default: () => `${rate}%` })
    },
  },
  { title: '输入 token', key: 'inputTokens', width: 110 },
  { title: '输出 token', key: 'outputTokens', width: 110 },
  { title: '总 token', key: 'totalTokens', width: 110 },
  { title: '工具单位', key: 'toolUsageUnits', width: 100 },
  { title: '平均响应', key: 'averageDurationMs', width: 120, render: (row: AiAgentModelUsageRow) => `${row.averageDurationMs} ms` },
  { title: '最大响应', key: 'maximumDurationMs', width: 120, render: (row: AiAgentModelUsageRow) => `${row.maximumDurationMs} ms` },
  { title: '最近调用', key: 'lastSeenUtc', width: 170, render: (row: AiAgentModelUsageRow) => fmt(row.lastSeenUtc) },
]
const releaseSignoffColumns = [
  { title: '角色', key: 'role', width: 130, render: (row: AiReleaseSignoffRecord) => releaseRoleLabel(row.role) },
  {
    title: '效力',
    key: 'reviewerType',
    width: 150,
    render: (row: AiReleaseSignoffRecord) => h(
      NTag,
      { size: 'small', type: row.reviewerType === 'human' ? 'info' : 'warning' },
      { default: () => row.reviewerType === 'human' ? '具名人工评审' : '内部模拟' },
    ),
  },
  {
    title: '结论',
    key: 'decision',
    width: 120,
    render: (row: AiReleaseSignoffRecord) => h(
      NTag,
      { size: 'small', type: row.decision === 'approved' ? 'success' : row.decision === 'rejected' ? 'error' : 'warning' },
      { default: () => releaseDecisionLabel(row.decision) },
    ),
  },
  { title: '记录人', key: 'reviewer', width: 160 },
  { title: '评审记录', key: 'notes', width: 360, ellipsis: { tooltip: true } },
  { title: '证据引用', key: 'evidenceRef', width: 220, ellipsis: { tooltip: true }, render: (row: AiReleaseSignoffRecord) => row.evidenceRef || '—' },
  { title: '时间', key: 'createdAtUtc', width: 170, render: (row: AiReleaseSignoffRecord) => fmt(row.createdAtUtc) },
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
const productionGateColumns = [
  { title: '模块', key: 'section', width: 120 },
  { title: '检查项', key: 'item', width: 260 },
  {
    title: '状态',
    key: 'status',
    width: 110,
    render: (row: ProductionGateRow) => h(
      NTag,
      { type: productionGateStatusTag(row.status), size: 'small' },
      { default: () => productionGateStatusLabel(row.status) },
    ),
  },
  { title: '证据', key: 'evidence', width: 360 },
  { title: '负责人', key: 'owner', width: 140 },
  { title: '下一步', key: 'nextAction', width: 330 },
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
    width: 430,
    fixed: 'right' as const,
    render: (row: AiAnswerFeedbackRow) => can(P.aiOpsManage)
      ? h('div', { class: 'flex flex-wrap gap-1' }, [
          feedbackTraceButton(row),
          feedbackActionButton(row, 'triaged', '分诊'),
          feedbackActionButton(row, 'reviewing', '处理中'),
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
const answerQualityColumns = [
  {
    title: '结果',
    key: 'passed',
    width: 120,
    render: (row: AiAnswerQualityEvaluation) => h(
      NTag,
      { type: row.passed ? 'success' : 'warning', size: 'small' },
      { default: () => row.passed ? '规则通过' : '需人工复核' },
    ),
  },
  {
    title: '场景',
    key: 'category',
    width: 150,
    render: (row: AiAnswerQualityEvaluation) => answerQualityCategoryLabel(row.category),
  },
  { title: '得分', key: 'score', width: 90 },
  {
    title: '未通过项',
    key: 'checks',
    width: 280,
    render: (row: AiAnswerQualityEvaluation) => row.checks
      .filter(check => !check.passed)
      .map(check => check.label)
      .join('、') || '—',
  },
  {
    title: '建议',
    key: 'recommendations',
    width: 330,
    render: (row: AiAnswerQualityEvaluation) => row.recommendations.join('；') || '—',
  },
  {
    title: 'Trace',
    key: 'traceId',
    width: 180,
    render: (row: AiAnswerQualityEvaluation) => renderTraceButton(row.traceId),
  },
  { title: '评测时间', key: 'evaluatedAtUtc', width: 170, render: (row: AiAnswerQualityEvaluation) => fmt(row.evaluatedAtUtc) },
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

async function loadBillingPreview() {
  billingLoading.value = true
  const result = await api.get<AiBillingPreviewResult>('ai/billing/preview', {
    from: range.value ? toYmd(range.value[0]) : undefined,
    to: range.value ? toYmd(range.value[1]) : undefined,
    tool: usageFilters.tool || undefined,
    subjectType: usageFilters.subjectType || undefined,
    subjectId: usageFilters.subjectId.trim() || undefined,
    limit: 500,
  })
  billingLoading.value = false
  if (result.code === 0) billingPreview.value = result.data
  else message.error(result.message || '计费预演查询失败')
}

async function loadBillingReconciliation() {
  billingReconciliationLoading.value = true
  const result = await api.get<AiBillingReconciliationResult>('ai/billing/reconciliation', {
    from: range.value ? toYmd(range.value[0]) : undefined,
    to: range.value ? toYmd(range.value[1]) : undefined,
    tool: usageFilters.tool || undefined,
    subjectType: usageFilters.subjectType || undefined,
    subjectId: usageFilters.subjectId.trim() || undefined,
    limit: 500,
  })
  billingReconciliationLoading.value = false
  if (result.code === 0) billingReconciliation.value = result.data
  else message.error(result.message || '计费对账查询失败')
}

async function loadBillingEvidence() {
  await Promise.allSettled([
    loadBillingPreview(),
    loadBillingReconciliation(),
  ])
}

async function runBillingReplay(dryRun: boolean) {
  billingReplayLoading.value = true
  const result = await api.post<AiBillingReplayResult>('ai/billing/replay', {
    from: range.value ? toYmd(range.value[0]) : undefined,
    to: range.value ? toYmd(range.value[1]) : undefined,
    tool: usageFilters.tool || undefined,
    subjectType: usageFilters.subjectType || undefined,
    subjectId: usageFilters.subjectId.trim() || undefined,
    limit: 5000,
    dryRun,
  })
  billingReplayLoading.value = false
  if (result.code !== 0 || !result.data) {
    message.error(result.message || 'Billing Ledger 回放失败')
    return
  }

  billingReplay.value = result.data
  if (dryRun) {
    message.success(`回放预检完成，候选 ${result.data.candidateRecords} 条`)
    return
  }

  message.success(`非计费回放完成，新增 ${result.data.insertedRecords} 条`)
  await loadBillingEvidence()
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
  await Promise.allSettled([loadAudit(), loadModelUsage()])
}

async function loadModelUsage() {
  modelUsageLoading.value = true
  const result = await api.get<AiAgentModelUsageResult>('ai/agent/model-usage', {
    from: range.value ? toYmd(range.value[0]) : undefined,
    to: range.value ? toYmd(range.value[1]) : undefined,
    limit: 100,
  })
  modelUsageLoading.value = false
  if (result.code === 0) modelUsage.value = result.data
  else message.error(result.message || '模型用量查询失败')
}

async function loadReleaseSignoffs() {
  releaseSignoffsLoading.value = true
  const result = await api.get<AiReleaseSignoffResult>('ai/release-signoffs', {
    releaseId: releaseSignoffForm.releaseId.trim() || 'p6-controlled-pre-release',
    limit: 100,
  })
  releaseSignoffsLoading.value = false
  if (result.code === 0) releaseSignoffs.value = result.data
  else message.error(result.message || '发布签核记录加载失败')
}

function openReleaseSignoffModal() {
  releaseSignoffForm.releaseId = releaseSignoffs.value?.snapshot.releaseId || 'p6-controlled-pre-release'
  releaseSignoffForm.role = 'product'
  releaseSignoffForm.reviewerType = 'internal_simulation'
  releaseSignoffForm.decision = 'simulated'
  releaseSignoffForm.notes = ''
  releaseSignoffForm.evidenceRef = ''
  releaseSignoffVisible.value = true
}

async function submitReleaseSignoff() {
  if (!releaseSignoffForm.releaseId.trim() || !releaseSignoffForm.notes.trim()) {
    message.warning('请填写发布批次和评审记录')
    return
  }
  releaseSignoffSubmitting.value = true
  const result = await api.post('ai/release-signoffs', {
    releaseId: releaseSignoffForm.releaseId.trim(),
    role: releaseSignoffForm.role,
    reviewerType: releaseSignoffForm.reviewerType,
    decision: releaseSignoffForm.decision,
    notes: releaseSignoffForm.notes.trim(),
    evidenceRef: releaseSignoffForm.evidenceRef.trim() || undefined,
  })
  releaseSignoffSubmitting.value = false
  if (result.code !== 0) {
    message.error(result.message || '发布签核记录追加失败')
    return
  }
  releaseSignoffVisible.value = false
  message.success(releaseSignoffForm.reviewerType === 'internal_simulation'
    ? '内部模拟记录已追加，不计入正式批准'
    : '人工评审记录已追加')
  await loadReleaseSignoffs()
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
    issueTag: feedbackFilters.issueTag || undefined,
    searchTerm: feedbackFilters.searchTerm.trim() || undefined,
    traceId: feedbackFilters.traceId.trim() || undefined,
    limit: feedbackFilters.limit,
  })
  feedbackLoading.value = false
  if (result.code === 0) feedback.value = result.data
  else message.error(result.message || '回答反馈查询失败')
}

async function loadAnswerQualityEvaluations() {
  answerQualityLoading.value = true
  const result = await api.get<AiAnswerQualityEvaluationResult>('ai/quality/recent', {
    category: answerQualityFilters.category || undefined,
    passed: answerQualityFilters.passed === '' ? undefined : answerQualityFilters.passed === 'true',
    limit: answerQualityFilters.limit,
  })
  answerQualityLoading.value = false
  if (result.code === 0) answerQuality.value = result.data
  else message.error(result.message || '内部模拟评测查询失败')
}

async function loadGoldenCandidates() {
  goldenCandidatesLoading.value = true
  const result = await api.get<AiGoldenSampleCandidateResult>('ai/feedback/golden-candidates', {
    status: feedbackFilters.status || undefined,
    feedbackType: feedbackFilters.feedbackType || undefined,
    tool: feedbackFilters.tool || undefined,
    issueTag: feedbackFilters.issueTag || undefined,
    searchTerm: feedbackFilters.searchTerm.trim() || undefined,
    limit: 50,
  })
  goldenCandidatesLoading.value = false
  if (result.code === 0) goldenCandidates.value = result.data
  else message.error(result.message || '黄金样本候选查询失败')
}

async function applyFeedbackRiskPool(pool: FeedbackRiskPool) {
  feedbackFilters.riskPool = pool.id
  feedbackFilters.status = ''
  feedbackFilters.feedbackType = ''
  feedbackFilters.issueTag = pool.issueTag || ''
  feedbackFilters.searchTerm = pool.searchTerm || ''
  feedbackFilters.limit = Math.max(feedbackFilters.limit, 100)
  await Promise.allSettled([loadFeedback(), loadGoldenCandidates()])
}

async function clearFeedbackRiskPool() {
  feedbackFilters.riskPool = ''
  feedbackFilters.issueTag = ''
  feedbackFilters.searchTerm = ''
  await Promise.allSettled([loadFeedback(), loadGoldenCandidates()])
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
    reviewReason: batchReviewReason(status),
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

function batchReviewReason(status: string) {
  return [
    `质检结论：后台批量标记为${feedbackStatusLabel(status)}`,
    '检查项：结论先行、数据边界、非投注建议、中文可读、风险类型区分、Trace 可回查。',
    `适用范围：${selectedFeedbackRows.value.length} 条当前勾选反馈。`,
  ].join('\n')
}

function reviewReasonTemplate(status: string, row: AiAnswerFeedbackRow) {
  const issueSummary = feedbackIssueSummary(row)
  const traceSummary = row.auditTraceIds?.length
    ? `回答 trace 与 ${row.auditTraceIds.length} 条审计 trace 已关联。`
    : '仅有回答 trace，需确认是否能回查到底层工具调用。'
  return [
    `质检结论：${feedbackStatusLabel(status)}`,
    `用户问题：${row.questionText || '未记录问题原文'}`,
    `反馈类型：${feedbackTypeLabel(row.feedbackType)}；问题标签：${issueSummary}`,
    `检查项：结论先行、数据边界、非投注建议、中文可读、风险类型区分、Trace 可回查。`,
    `Trace：${traceSummary}`,
    `处理建议：${reviewActionHint(status)}`,
  ].join('\n')
}

function reviewActionHint(status: string) {
  const hints: Record<string, string> = {
    triaged: '已完成分诊，后续按问题类型进入复核。',
    reviewing: '继续结合 trace 和工具证据复核。',
    needs_calibration: '沉淀为口径校准样本，重点检查阈值、排序、异常/背离表达。',
    needs_code_fix: '沉淀为代码回归样本，定位工具调用、数据映射或状态流转问题。',
    needs_copy_fix: '沉淀为文案改写样本，优化字段解释和用户可读性。',
    verified: '回答满足当前无专家阶段质检规则，可作为正向样本参考。',
    closed: '无需继续跟进，保留记录用于审计。',
  }
  return hints[status] ?? '继续复核。'
}

function openFeedbackReview(row: AiAnswerFeedbackRow, status: string) {
  feedbackReviewTarget.value = row
  feedbackReviewForm.status = status
  feedbackReviewForm.severity = row.severity && row.severity !== 'none' ? row.severity : inferReviewSeverity(status)
  feedbackReviewForm.reviewReason = reviewReasonTemplate(status, row)
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
    'successfulCalls', 'failedCalls', 'usageUnits', 'successfulUsageUnits',
    'failedUsageUnits', 'principalSource',
    'entitlementProfile', 'aiClientId', 'firstSeenUtc', 'lastSeenUtc',
  ] as const
  const rows = [
    columns.join(','),
    ...usage.value.items.map(row => columns.map(key => csv(row[key])).join(',')),
  ]
  const blob = new Blob([`\uFEFF${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const [fromLabel, toLabel] = selectedRangeLabels()
  link.href = url
  link.download = `spdex-ai-usage-${fromLabel}-${toLabel}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function exportBillingCsv() {
  if (!billingPreview.value?.items.length) return
  const columns = [
    'dateUtc', 'subjectType', 'subjectId', 'toolName', 'calls',
    'successfulCalls', 'failedCalls', 'meteredUsageUnits',
    'previewChargeableUsageUnits', 'excludedUsageUnits', 'billable',
    'billingMode', 'exclusionReason', 'principalSource',
    'entitlementProfile', 'aiClientId', 'firstSeenUtc', 'lastSeenUtc',
  ] as const
  const rows = [
    columns.join(','),
    ...billingPreview.value.items.map(row => columns.map(key => csv(row[key])).join(',')),
  ]
  const blob = new Blob([`\uFEFF${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const [fromLabel, toLabel] = selectedRangeLabels()
  link.href = url
  link.download = `spdex-ai-billing-preview-${fromLabel}-${toLabel}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function exportBillingReconciliationCsv() {
  if (!billingReconciliation.value?.items.length) return
  const columns = [
    'dateUtc',
    'subjectType',
    'subjectId',
    'toolName',
    'usageSuccessfulCalls',
    'billingRows',
    'usageChargeableUnits',
    'billingUsageUnits',
    'callDelta',
    'usageUnitDelta',
  ] as const
  const rows = [
    columns.join(','),
    ...billingReconciliation.value.items.map(row => columns.map(key => csv(row[key])).join(',')),
  ]
  const blob = new Blob([`\uFEFF${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const [fromLabel, toLabel] = selectedRangeLabels()
  link.href = url
  link.download = `spdex-ai-billing-reconciliation-${fromLabel}-${toLabel}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

async function loadProductionGateEvidence() {
  productionGateLoading.value = true
  await Promise.allSettled([
    can(P.aiUsageView) ? loadUsage() : Promise.resolve(),
    can(P.aiBillingReconcile) ? loadBillingEvidence() : Promise.resolve(),
    can(P.aiAuditView) ? loadQuality() : Promise.resolve(),
    can(P.aiAuditView) ? loadInAppNotifications() : Promise.resolve(),
    can(P.aiAuditView) ? loadFeedback() : Promise.resolve(),
    can(P.aiAuditView) ? loadAnswerQualityEvaluations() : Promise.resolve(),
    can(P.aiOpsView) ? loadReleaseSignoffs() : Promise.resolve(),
  ])
  productionGateLoading.value = false
  message.success('生产门禁证据已刷新')
}

function exportProductionGateMarkdown() {
  const generatedAt = new Date().toISOString()
  const rows = productionGateRows.value
  const totals = productionGateTotals.value
  const lines = [
    '# SPdex AI MCP 生产灰度门禁报告',
    '',
    `生成时间：${generatedAt}`,
    `结论：${productionGateConclusion.value.title}`,
    `状态汇总：阻断 ${totals.blocked}，待复核 ${totals.pending}，需关注 ${totals.warning}，已通过 ${totals.passed}`,
    '',
    '## 边界',
    '',
    '- 当前仍是测试环境和 allowlist 灰度，不代表正式公开售卖。',
    '- 当前应保持 billable=false，不生成正式账单，不扣真实额度。',
    '- Billing ledger 仍处于影子验证链路；正式售卖前必须完成中心账本、持久双写、送达确认、冲正落账、无差异对账和财务签字。',
    '- 当前只开放站内通知，email/webhook 外部投递保持关闭。',
    '- 内部模拟评测和模拟签核只作为研发证据，不具备正式人工批准效力。',
    '',
    '## 检查项',
    '',
    '| 模块 | 检查项 | 状态 | 证据 | 下一步 |',
    '| --- | --- | --- | --- | --- |',
    ...rows.map(row => [
      row.section,
      row.item,
      productionGateStatusLabel(row.status),
      row.evidence,
      row.nextAction,
    ].map(markdownTableCell).join(' | ')).map(line => `| ${line} |`),
    '',
    '## Usage 与 Billing Ledger 对账',
    '',
    billingReconciliation.value
      ? `- 状态：${billingReconciliation.value.matches ? '一致' : '存在差异'}；调用差异 ${billingReconciliation.value.totals.callDelta}；用量差异 ${billingReconciliation.value.totals.usageUnitDelta}。`
      : '- 尚未加载对账证据。',
    '',
    '## 模型成本基线',
    '',
    '| Provider | Model | 调用 | 失败 | 输入 tokens | 输出 tokens | 平均响应 ms |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ...(modelUsage.value?.summary.items.length
      ? modelUsage.value.summary.items.map(row => `| ${[
          row.provider,
          row.model,
          row.calls,
          row.failedCalls,
          row.inputTokens,
          row.outputTokens,
          row.averageDurationMs,
        ].map(markdownTableCell).join(' | ')} |`)
      : ['| 未加载 | — | 0 | 0 | 0 | 0 | 0 |']),
    '',
    '## 发布签核',
    '',
    `- 发布批次：${releaseSignoffs.value?.snapshot.releaseId || '未加载'}`,
    `- 正式人工签核：${releaseSignoffs.value?.snapshot.formalReady ? '已齐备' : '未齐备'}`,
    '- 内部模拟记录不计入正式批准。',
    '',
    '| 责任角色 | 最新结论 | 评审类型 | 评审人 | 时间 | 证据引用 |',
    '| --- | --- | --- | --- | --- | --- |',
    ...(releaseSignoffs.value?.snapshot.roles.length
      ? releaseSignoffs.value.snapshot.roles.map(role => `| ${[
          releaseRoleLabel(role.role),
          releaseDecisionLabel(role.latest?.decision),
          role.latest?.reviewerType === 'human' ? '人工评审' : role.latest ? '内部模拟' : '无记录',
          role.latest?.reviewer || '—',
          role.latest ? fmt(role.latest.createdAtUtc) : '—',
          role.latest?.evidenceRef || '—',
        ].map(markdownTableCell).join(' | ')} |`)
      : ['| 未加载 | — | — | — | — | — |']),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `spdex-ai-p5-production-gate-${generatedAt.slice(0, 10)}.md`
  link.click()
  URL.revokeObjectURL(url)
}

function exportFeedbackCsv() {
  if (!feedback.value?.items.length) return
  const columns = [
    'feedbackId',
    'answerId',
    'traceId',
    'auditTraceIds',
    'feedbackType',
    'status',
    'severity',
    'issueTags',
    'toolName',
    'preset',
    'matchId',
    'questionText',
    'commentText',
    'subjectType',
    'subjectId',
    'reviewReason',
    'reviewerId',
    'createdAtUtc',
    'updatedAtUtc',
  ] as const
  const rows = [
    columns.join(','),
    ...feedback.value.items.map(row => columns.map((key) => {
      const value = key === 'auditTraceIds'
        ? row.auditTraceIds?.join(';')
        : key === 'issueTags'
          ? row.issueTags.join(';')
          : row[key]
      return csv(value)
    }).join(',')),
  ]
  const blob = new Blob([`\uFEFF${rows.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `spdex-ai-feedback-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

function csv(value: unknown) {
  const text = value == null ? '' : String(value)
  return `"${text.replaceAll('"', '""')}"`
}
function markdownTableCell(value: unknown) {
  return String(value ?? '')
    .replaceAll('|', '\\|')
    .replace(/\s+/g, ' ')
    .trim()
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
function selectedRangeLabels(): [string, string] {
  return range.value ? [toYmd(range.value[0]), toYmd(range.value[1])] : ['all', 'all']
}
function fmt(value?: string | null) {
  return value ? value.substring(0, 19).replace('T', ' ') : '—'
}
function releaseRoleLabel(value?: string | null) {
  return {
    product: '产品负责人',
    finance: '财务负责人',
    security: '安全负责人',
    operations: '运维负责人',
    football_expert: '足球专家',
  }[String(value ?? '')] ?? String(value || '未知角色')
}
function releaseDecisionLabel(value?: string | null) {
  return {
    approved: '人工已批准',
    rejected: '不批准',
    needs_work: '需要完善',
    simulated: '完成内部模拟',
  }[String(value ?? '')] ?? '暂无记录'
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
function formatBillingExclusion(value?: string | null) {
  const labels: Record<string, string> = {
    failed_or_non_billable_calls_excluded: '失败或非计费调用已排除',
  }
  return value ? labels[value] ?? value : '—'
}
function productionGateRow(
  section: string,
  item: string,
  status: ProductionGateStatus,
  evidence: string,
  owner: string,
  nextAction: string,
): ProductionGateRow {
  return { section, item, status, evidence, owner, nextAction }
}
function productionGateStatusLabel(value: ProductionGateStatus) {
  const labels: Record<ProductionGateStatus, string> = {
    passed: '已通过',
    warning: '需关注',
    pending: '待复核',
    blocked: '阻断',
  }
  return labels[value]
}
function productionGateStatusTag(value: ProductionGateStatus) {
  const tags: Record<ProductionGateStatus, 'success' | 'warning' | 'info' | 'error'> = {
    passed: 'success',
    warning: 'warning',
    pending: 'info',
    blocked: 'error',
  }
  return tags[value]
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
function feedbackIssueSummary(row: AiAnswerFeedbackRow) {
  return row.issueTags?.length
    ? row.issueTags.map(feedbackIssueLabel).join('、')
    : '未选择具体问题标签'
}
function feedbackMatchesRiskPool(row: AiAnswerFeedbackRow, pool: FeedbackRiskPool) {
  if (pool.issueTag && !row.issueTags.includes(pool.issueTag)) {
    return false
  }
  if (!pool.searchTerm) {
    return true
  }
  const needle = pool.searchTerm.toLowerCase()
  const haystack = [
    row.questionText,
    row.commentText,
    row.toolName,
    row.preset,
    ...row.issueTags.map(feedbackIssueLabel),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(needle)
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
function answerQualityCategoryLabel(value: string) {
  const labels: Record<string, string> = {
    big_trades: '大额交易',
    market_anomaly: '市场异常',
    prediction_divergence: '预测市场背离',
    watch_condition: '观察条件',
    live_signal: '赛中信号',
    metric_explanation: '指标解释',
    general: '通用问题',
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
  if (can(P.aiBillingReconcile)) loadBillingEvidence()
  if (can(P.aiOpsView)) loadReleaseSignoffs()
  if (can(P.aiAuditView)) {
    loadAudit()
    loadModelUsage()
    loadInAppNotifications()
    loadFeedback()
    loadAnswerQualityEvaluations()
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
