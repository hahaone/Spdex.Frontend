<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold">业务意图字典</h2>
        <div class="mt-1 text-sm text-gray-500">维护用户表达与受控业务意图的映射，不开放工具、权限和计费参数编辑。</div>
      </div>
      <NSpace>
        <NButton :loading="loading" @click="load">刷新</NButton>
        <NButton v-if="can(P.aiOpsManage)" type="primary" :disabled="!hasUnpublishedChanges" @click="openPublish">
          发布版本
        </NButton>
      </NSpace>
    </div>

    <NAlert class="mb-4" type="info" title="受控发布边界">
      管理员只能把新表达映射到已审核的意图。已存在的高优先级窄意图不会被别名覆盖；候选审核后仍需单独发布版本才会生效。
    </NAlert>

    <NGrid :cols="4" :x-gap="12" :y-gap="12" item-responsive class="mb-4">
      <NGi span="4 700:1"><NCard size="small"><NStatistic label="当前版本" :value="snapshot?.activeVersionLabel || '—'" /></NCard></NGi>
      <NGi span="4 700:1"><NCard size="small"><NStatistic label="基础意图" :value="snapshot?.intents.length ?? 0" /></NCard></NGi>
      <NGi span="4 700:1"><NCard size="small"><NStatistic label="已发布别名" :value="snapshot?.activeAliases.length ?? 0" /></NCard></NGi>
      <NGi span="4 700:1"><NCard size="small"><NStatistic label="已批准候选" :value="approvedCount" /></NCard></NGi>
    </NGrid>

    <NCard title="路由预演" size="small" class="mb-4">
      <template #header-extra><NTag size="small" type="info">不执行专业工具，不产生用量</NTag></template>
      <NForm label-placement="top">
        <NGrid :cols="12" :x-gap="12" :y-gap="4" item-responsive>
          <NGi span="12 900:7">
            <NFormItem label="用户原始问题">
              <NInput v-model:value="previewForm.question" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="例如：查一下这场 GL 的紫框盘口" />
            </NFormItem>
          </NGi>
          <NGi span="12 600:4 900:3">
            <NFormItem label="拟映射意图（可选）">
              <NSelect v-model:value="previewForm.targetIntentId" clearable filterable :options="intentOptions" placeholder="只看当前解析可留空" />
            </NFormItem>
          </NGi>
          <NGi span="12 600:4 900:2">
            <NFormItem label="比赛 ID（单场必填）">
              <NInputNumber v-model:value="previewForm.matchId" :min="1" :show-button="false" class="w-full" placeholder="matchId" />
            </NFormItem>
          </NGi>
        </NGrid>
        <NButton type="primary" secondary :loading="previewing" :disabled="!previewForm.question.trim()" @click="runPreview">运行预演</NButton>
      </NForm>

      <NGrid v-if="preview" :cols="2" :x-gap="12" :y-gap="12" item-responsive class="mt-4">
        <NGi span="2 850:1">
          <NCard size="small" title="当前发布结果" embedded>
            <ResolutionSummary :value="preview.current" />
          </NCard>
        </NGi>
        <NGi span="2 850:1">
          <NCard size="small" title="候选映射结果" embedded>
            <ResolutionSummary v-if="preview.proposed" :value="preview.proposed" />
            <NEmpty v-else size="small" description="选择拟映射意图后查看" />
          </NCard>
        </NGi>
        <NGi span="2">
          <NAlert :type="preview.canPublish ? 'success' : 'error'" :title="preview.canPublish ? '预演通过' : '预演未通过'">
            {{ preview.decision }}
          </NAlert>
        </NGi>
      </NGrid>
    </NCard>

    <NTabs type="line" animated>
      <NTabPane name="candidates" tab="候选与审核">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="text-sm text-gray-500">审核只改变候选状态，不会立即影响线上解析。</div>
          <NButton v-if="can(P.aiOpsManage)" type="primary" secondary @click="openCreate">新增候选</NButton>
        </div>
        <NDataTable :columns="candidateColumns" :data="snapshot?.candidates ?? []" :pagination="{ pageSize: 10 }" :row-key="candidateRowKey" :scroll-x="1120" />
      </NTabPane>

      <NTabPane name="dictionary" tab="当前字典">
        <NDataTable :columns="intentColumns" :data="intentRows" :pagination="{ pageSize: 15 }" :row-key="intentRowKey" :scroll-x="980" />
      </NTabPane>

      <NTabPane name="versions" tab="版本与回滚">
        <NDataTable :columns="versionColumns" :data="snapshot?.versions ?? []" :pagination="{ pageSize: 10 }" :row-key="versionRowKey" :scroll-x="900" />
      </NTabPane>
    </NTabs>

    <NModal v-model:show="showCreate" preset="card" title="新增候选表达" style="width:min(620px, calc(100vw - 32px))">
      <NAlert class="mb-4" type="warning">候选必须使用一条真实样本完成预演。这里不能修改目标工具或参数模板。</NAlert>
      <NForm label-placement="top">
        <NFormItem label="候选表达">
          <NInput v-model:value="candidateForm.phrase" maxlength="80" show-count placeholder="例如：紫框盘口" />
        </NFormItem>
        <NFormItem label="目标意图">
          <NSelect v-model:value="candidateForm.intentId" filterable :options="intentOptions" />
        </NFormItem>
        <NFormItem label="真实样本问题">
          <NInput v-model:value="candidateForm.sampleQuestion" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="问题中应包含候选表达" />
        </NFormItem>
        <NFormItem label="比赛 ID（单场意图必填）">
          <NInputNumber v-model:value="candidateForm.matchId" :min="1" :show-button="false" class="w-full" />
        </NFormItem>
        <NFormItem label="来源">
          <NSelect v-model:value="candidateForm.source" :options="sourceOptions" />
        </NFormItem>
        <NFormItem label="业务说明">
          <NInput v-model:value="candidateForm.notes" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="说明用户为什么这样表达，以及期望业务含义" />
        </NFormItem>
      </NForm>
      <NAlert v-if="candidatePreview" class="mb-3" :type="candidatePreview.canPublish ? 'success' : 'error'">
        {{ candidatePreview.decision }}
      </NAlert>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showCreate = false">取消</NButton>
          <NButton :loading="candidatePreviewing" :disabled="!candidateReady" @click="previewCandidate">预演</NButton>
          <NButton type="primary" :loading="creating" :disabled="!candidatePreview?.canPublish" @click="createCandidate">保存草稿</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="showReview" preset="card" title="审核候选表达" style="width:min(520px, calc(100vw - 32px))">
      <NDescriptions v-if="reviewTarget" :column="1" size="small" class="mb-4">
        <NDescriptionsItem label="表达">{{ reviewTarget.phrase }}</NDescriptionsItem>
        <NDescriptionsItem label="目标意图">{{ intentLabel(reviewTarget.intentId) }}</NDescriptionsItem>
      </NDescriptions>
      <NForm label-placement="top">
        <NFormItem label="审核结论"><NSelect v-model:value="reviewForm.status" :options="reviewStatusOptions" /></NFormItem>
        <NFormItem label="审核说明"><NInput v-model:value="reviewForm.reviewNotes" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" /></NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showReview = false">取消</NButton>
          <NButton type="primary" :loading="reviewing" :disabled="!reviewForm.reviewNotes.trim()" @click="submitReview">确认审核</NButton>
        </div>
      </template>
    </NModal>

    <NModal v-model:show="showPublish" preset="card" title="发布意图字典版本" style="width:min(520px, calc(100vw - 32px))">
      <NAlert class="mb-4" type="warning">将把当前所有“已批准”候选固化为不可变快照。发布后 `query_spdex` 新请求立即使用该版本。</NAlert>
      <NForm label-placement="top">
        <NFormItem label="版本号"><NInput v-model:value="publishForm.versionLabel" placeholder="例如：2026.08.20.2" /></NFormItem>
        <NFormItem label="发布说明"><NInput v-model:value="publishForm.notes" type="textarea" :autosize="{ minRows: 3, maxRows: 5 }" /></NFormItem>
      </NForm>
      <template #footer>
        <div class="flex justify-end gap-2">
          <NButton @click="showPublish = false">取消</NButton>
          <NButton type="primary" :loading="publishing" :disabled="!publishForm.versionLabel.trim() || !publishForm.notes.trim()" @click="publishCatalog">确认发布</NButton>
        </div>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NTag, useDialog, useMessage, type DataTableColumns } from 'naive-ui'
import type {
  AiIntentAliasCandidate,
  AiIntentCatalogResult,
  AiIntentCatalogSnapshot,
  AiIntentCatalogVersion,
  AiIntentDefinition,
  AiIntentPreview,
  AiIntentPreviewResult,
} from '~/types/admin-ai'
import { P } from '~/utils/permissions'

const ResolutionSummary = defineComponent({
  props: { value: { type: Object as PropType<AiIntentPreview['current']>, required: true } },
  setup(props) {
    return () => h('div', { class: 'space-y-2 text-sm' }, [
      h('div', [h('span', { class: 'text-gray-500' }, '意图：'), h('code', props.value.intent)]),
      h('div', [h('span', { class: 'text-gray-500' }, '工具：'), h('code', props.value.toolName)]),
      h('div', [h('span', { class: 'text-gray-500' }, '置信度：'), `${Math.round(props.value.confidence * 100)}%`]),
      h('pre', { class: 'overflow-auto rounded bg-gray-100 p-2 text-xs whitespace-pre-wrap' }, JSON.stringify(props.value.arguments, null, 2)),
      h('div', { class: 'text-gray-500' }, props.value.explanation),
    ])
  },
})

interface IntentRow extends AiIntentDefinition { aliases: string[] }

const api = useAdminApi()
const { can } = usePermission()
const message = useMessage()
const dialog = useDialog()
const loading = ref(false)
const snapshot = ref<AiIntentCatalogSnapshot | null>(null)
const previewing = ref(false)
const preview = ref<AiIntentPreview | null>(null)
const previewForm = reactive({ question: '', targetIntentId: null as string | null, matchId: null as number | null })

const showCreate = ref(false)
const creating = ref(false)
const candidatePreviewing = ref(false)
const candidatePreview = ref<AiIntentPreview | null>(null)
const candidateForm = reactive({ phrase: '', intentId: null as string | null, sampleQuestion: '', matchId: null as number | null, source: 'manual', notes: '' })

const showReview = ref(false)
const reviewing = ref(false)
const reviewTarget = ref<AiIntentAliasCandidate | null>(null)
const reviewForm = reactive({ status: 'approved', reviewNotes: '' })

const showPublish = ref(false)
const publishing = ref(false)
const publishForm = reactive({ versionLabel: '', notes: '' })

const sourceOptions = [
  { label: '人工测试', value: 'manual' },
  { label: '回答验收', value: 'answer_review' },
  { label: '客服反馈', value: 'support' },
  { label: '内部评测', value: 'internal_eval' },
]
const reviewStatusOptions = [
  { label: '批准，进入待发布', value: 'approved' },
  { label: '驳回', value: 'rejected' },
  { label: '停用，下一版本移除', value: 'retired' },
]

const intentOptions = computed(() => (snapshot.value?.intents ?? []).map(item => ({
  label: `${item.label} · ${item.intentId}`,
  value: item.intentId,
})))
const approvedCount = computed(() => snapshot.value?.candidates.filter(item => item.status === 'approved').length ?? 0)
const hasUnpublishedChanges = computed(() => {
  if (!snapshot.value) return false
  const approved = snapshot.value.candidates
    .filter(item => item.status === 'approved')
    .map(item => `${item.candidateId}:${item.intentId}:${item.phrase}`)
    .sort()
  const active = snapshot.value.activeAliases
    .map(item => `${item.candidateId}:${item.intentId}:${item.phrase}`)
    .sort()
  return approved.length !== active.length || approved.some((value, index) => value !== active[index])
})
const candidateReady = computed(() => !!candidateForm.phrase.trim() && !!candidateForm.intentId && !!candidateForm.sampleQuestion.trim() && candidateForm.sampleQuestion.includes(candidateForm.phrase))
const intentRows = computed<IntentRow[]>(() => (snapshot.value?.intents ?? []).map(intent => ({
  ...intent,
  aliases: (snapshot.value?.activeAliases ?? []).filter(alias => alias.intentId === intent.intentId).map(alias => alias.phrase),
})))

const candidateColumns: DataTableColumns<AiIntentAliasCandidate> = [
  { title: '候选表达', key: 'phrase', width: 160, render: row => h('strong', row.phrase) },
  { title: '目标意图', key: 'intentId', width: 260, render: row => h('div', [h('div', intentLabel(row.intentId)), h('code', { class: 'text-xs text-gray-400' }, row.intentId)]) },
  { title: '状态', key: 'status', width: 100, render: row => h(NTag, { size: 'small', type: statusTag(row.status) }, { default: () => statusLabel(row.status) }) },
  { title: '来源', key: 'source', width: 110 },
  { title: '命中', key: 'hitCount', width: 80 },
  { title: '说明', key: 'notes', minWidth: 220, ellipsis: { tooltip: true } },
  { title: '更新时间', key: 'updatedAtUtc', width: 160, render: row => fmt(row.updatedAtUtc) },
  {
    title: '操作', key: 'actions', width: 110, fixed: 'right',
    render: row => can(P.aiOpsManage) ? h(NButton, { size: 'small', secondary: true, onClick: () => openReview(row) }, { default: () => '审核' }) : null,
  },
]

const intentColumns: DataTableColumns<IntentRow> = [
  { title: '业务意图', key: 'label', width: 190, render: row => h('strong', row.label) },
  { title: 'Intent ID', key: 'intentId', width: 290, render: row => h('code', row.intentId) },
  { title: '固定工具', key: 'toolName', width: 240, render: row => h('code', row.toolName) },
  { title: '比赛上下文', key: 'requiresMatchContext', width: 110, render: row => row.requiresMatchContext ? '需要' : '不需要' },
  { title: '当前发布别名', key: 'aliases', minWidth: 220, render: row => row.aliases.length ? h('div', { class: 'flex flex-wrap gap-1' }, row.aliases.map(alias => h(NTag, { size: 'small' }, { default: () => alias }))) : '—' },
]

const versionColumns: DataTableColumns<AiIntentCatalogVersion> = [
  { title: '版本', key: 'versionLabel', width: 210, render: row => h('div', { class: 'flex items-center gap-2' }, [h('strong', row.versionLabel), row.active ? h(NTag, { type: 'success', size: 'small' }, { default: () => '当前' }) : null]) },
  { title: '别名', key: 'aliasCount', width: 80 },
  { title: '发布人', key: 'createdBy', width: 150 },
  { title: '说明', key: 'notes', minWidth: 260, ellipsis: { tooltip: true } },
  { title: '发布时间', key: 'createdAtUtc', width: 160, render: row => fmt(row.createdAtUtc) },
  {
    title: '操作', key: 'actions', width: 110, fixed: 'right',
    render: row => can(P.aiOpsManage) && !row.active ? h(NButton, { size: 'small', secondary: true, type: 'warning', onClick: () => confirmRollback(row) }, { default: () => '回滚到此版' }) : null,
  },
]

const candidateRowKey = (row: AiIntentAliasCandidate) => row.candidateId
const intentRowKey = (row: IntentRow) => row.intentId
const versionRowKey = (row: AiIntentCatalogVersion) => row.versionId

async function load() {
  loading.value = true
  const result = await api.get<AiIntentCatalogResult>('ai/intents/catalog')
  loading.value = false
  if (result.code === 0 && result.data) snapshot.value = result.data.snapshot
  else message.error(result.message || '意图字典加载失败')
}

async function runPreview() {
  previewing.value = true
  const result = await api.post<AiIntentPreviewResult>('ai/intents/preview', {
    question: previewForm.question,
    matchId: previewForm.matchId,
    targetIntentId: previewForm.targetIntentId,
  })
  previewing.value = false
  if (result.code === 0 && result.data) preview.value = result.data.preview
  else message.error(result.message || '预演失败')
}

function openCreate() {
  Object.assign(candidateForm, { phrase: '', intentId: null, sampleQuestion: '', matchId: null, source: 'manual', notes: '' })
  candidatePreview.value = null
  showCreate.value = true
}

async function previewCandidate() {
  candidatePreviewing.value = true
  const result = await api.post<AiIntentPreviewResult>('ai/intents/preview', {
    question: candidateForm.sampleQuestion,
    matchId: candidateForm.matchId,
    phrase: candidateForm.phrase,
    targetIntentId: candidateForm.intentId,
  })
  candidatePreviewing.value = false
  if (result.code === 0 && result.data) candidatePreview.value = result.data.preview
  else message.error(result.message || '候选预演失败')
}

async function createCandidate() {
  creating.value = true
  const result = await api.post('ai/intents/candidates', {
    phrase: candidateForm.phrase,
    intentId: candidateForm.intentId,
    source: candidateForm.source,
    notes: candidateForm.notes,
    sampleQuestion: candidateForm.sampleQuestion,
    sampleMatchId: candidateForm.matchId,
  })
  creating.value = false
  if (result.code === 0) {
    message.success('候选表达已保存为草稿')
    showCreate.value = false
    await load()
  }
  else message.error(result.message || '候选保存失败')
}

function openReview(row: AiIntentAliasCandidate) {
  reviewTarget.value = row
  reviewForm.status = row.status === 'approved' ? 'retired' : 'approved'
  reviewForm.reviewNotes = ''
  showReview.value = true
}

async function submitReview() {
  if (!reviewTarget.value) return
  reviewing.value = true
  const result = await api.put(`ai/intents/candidates/${reviewTarget.value.candidateId}`, reviewForm)
  reviewing.value = false
  if (result.code === 0) {
    message.success('审核状态已更新；发布新版本后才会生效')
    showReview.value = false
    await load()
  }
  else message.error(result.message || '审核失败')
}

function openPublish() {
  if (!hasUnpublishedChanges.value) {
    message.info('当前审核状态与已发布版本一致，无需重复发布')
    return
  }
  const now = new Date()
  publishForm.versionLabel = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}.${String((snapshot.value?.versions.length ?? 0) + 1)}`
  publishForm.notes = `发布 ${approvedCount.value} 条已批准业务表达。`
  showPublish.value = true
}

async function publishCatalog() {
  publishing.value = true
  const result = await api.post('ai/intents/publish', publishForm)
  publishing.value = false
  if (result.code === 0) {
    message.success('意图字典新版本已发布')
    showPublish.value = false
    await load()
  }
  else message.error(result.message || '发布失败')
}

function confirmRollback(row: AiIntentCatalogVersion) {
  dialog.warning({
    title: '回滚意图字典',
    content: `确认将当前字典切换到 ${row.versionLabel}？候选审核记录不会删除。`,
    positiveText: '确认回滚',
    negativeText: '取消',
    async onPositiveClick() {
      const result = await api.post(`ai/intents/rollback/${row.versionId}`)
      if (result.code === 0) {
        message.success(`已回滚到 ${row.versionLabel}`)
        await load()
      }
      else message.error(result.message || '回滚失败')
    },
  })
}

function intentLabel(intentId: string) { return snapshot.value?.intents.find(item => item.intentId === intentId)?.label ?? intentId }
function fmt(value?: string | null) { return value ? value.substring(0, 19).replace('T', ' ') : '—' }
function statusLabel(value: string) { return ({ draft: '草稿', approved: '已批准', rejected: '已驳回', retired: '待移除' } as Record<string, string>)[value] ?? value }
function statusTag(value: string): 'default' | 'success' | 'error' | 'warning' { return value === 'approved' ? 'success' : value === 'rejected' ? 'error' : value === 'retired' ? 'warning' : 'default' }

onMounted(load)
</script>
