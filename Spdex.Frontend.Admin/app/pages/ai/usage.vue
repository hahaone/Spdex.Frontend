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

        <NCard size="small" class="mb-4" title="P5 上线门禁">
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
          <NButton type="primary" :loading="billingLoading" @click="loadBillingPreview">刷新预演</NButton>
        </NSpace>

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
          <NButton :loading="billingLoading" @click="loadBillingPreview">刷新预演</NButton>
          <NButton type="primary" :disabled="!billingPreview?.items.length" @click="exportBillingCsv">导出预演 CSV</NButton>
        </NSpace>
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
            <NDescriptionsItem label="回答验收">
              已加载 {{ feedbackSampleStats.loaded }} 条，已流转 {{ feedbackSampleStats.reviewed }} 条，目标 30 条。
            </NDescriptionsItem>
            <NDescriptionsItem label="最近样本">
              审计 {{ qualityTotals.calls }} 条，站内通知 {{ notifications?.count ?? 0 }} 条。
            </NDescriptionsItem>
          </NDescriptions>
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
  AiAuditResult,
  AiAuditRow,
  AiBillingPreviewResult,
  AiBillingPreviewRow,
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
const audit = ref<AiAuditResult | null>(null)
const trace = ref<AiAuditResult | null>(null)
const notifications = ref<AiInAppNotificationResult | null>(null)
const feedback = ref<AiAnswerFeedbackResult | null>(null)
const goldenCandidates = ref<AiGoldenSampleCandidateResult | null>(null)
const usageLoading = ref(false)
const billingLoading = ref(false)
const auditLoading = ref(false)
const traceLoading = ref(false)
const notificationsLoading = ref(false)
const feedbackLoading = ref(false)
const goldenCandidatesLoading = ref(false)
const productionGateLoading = ref(false)
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
      'P5 决策：预发布和非计费测试继续使用单实例 SQLite ledger；正式多实例售卖前必须迁移集中账本或启用双写对账。',
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
    issueTag: feedbackFilters.issueTag || undefined,
    searchTerm: feedbackFilters.searchTerm.trim() || undefined,
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

async function loadProductionGateEvidence() {
  productionGateLoading.value = true
  await Promise.allSettled([
    can(P.aiUsageView) ? loadUsage() : Promise.resolve(),
    can(P.aiBillingReconcile) ? loadBillingPreview() : Promise.resolve(),
    can(P.aiAuditView) ? loadQuality() : Promise.resolve(),
    can(P.aiAuditView) ? loadInAppNotifications() : Promise.resolve(),
    can(P.aiAuditView) ? loadFeedback() : Promise.resolve(),
  ])
  productionGateLoading.value = false
  message.success('生产门禁证据已刷新')
}

function exportProductionGateMarkdown() {
  const generatedAt = new Date().toISOString()
  const rows = productionGateRows.value
  const totals = productionGateTotals.value
  const lines = [
    '# SPdex AI MCP P5 生产灰度门禁报告',
    '',
    `生成时间：${generatedAt}`,
    `结论：${productionGateConclusion.value.title}`,
    `状态汇总：阻断 ${totals.blocked}，待复核 ${totals.pending}，需关注 ${totals.warning}，已通过 ${totals.passed}`,
    '',
    '## 边界',
    '',
    '- 当前仍是测试环境和 allowlist 灰度，不代表正式公开售卖。',
    '- 当前应保持 billable=false，不生成正式账单，不扣真实额度。',
    '- 当前只开放站内通知，email/webhook 外部投递保持关闭。',
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
  if (can(P.aiBillingReconcile)) loadBillingPreview()
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
