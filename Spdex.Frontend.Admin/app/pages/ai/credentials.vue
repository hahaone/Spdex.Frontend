<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold">AI / MCP 企业凭据</h2>
        <div class="mt-1 text-xs text-gray-400">长期接入凭据、scope、IP 白名单与轮换状态</div>
      </div>
      <NSpace>
        <NInput v-model:value="keyword" clearable placeholder="凭据 / 企业 / Client ID" style="width:250px" />
        <NSelect v-model:value="statusFilter" :options="statusFilterOptions" style="width:130px" />
        <NButton :loading="loading" @click="load">刷新</NButton>
        <NButton v-if="can(P.aiCredentialManage)" type="primary" @click="openCreate">签发凭据</NButton>
      </NSpace>
    </div>

    <NAlert v-if="expiringCount" type="warning" class="mb-4" title="凭据到期提醒">
      {{ expiringCount }} 个活跃凭据将在 14 天内到期。
    </NAlert>

    <NAlert v-if="incidents?.snapshot.openCredentialCount" type="error" class="mb-4" title="存在未关闭的凭据安全事件">
      {{ incidents.snapshot.openCredentialCount }} 个凭据仍有未关闭事件。先完成影响确认、轮换或撤销，再追加“已关闭”记录。
    </NAlert>

    <NAlert type="info" class="mb-4" title="凭据安全边界">
      企业凭据只用于受信任的 MCP 客户端或企业 Agent。签发前确认合同主体、scope、IP 白名单和有效期；
      不要把 token、Authorization header 或本地 MCP 配置写入工单、截图、帮助中心或聊天模型上下文。发现泄露时先撤销，再重新签发。
    </NAlert>

    <NDataTable
      :columns="columns"
      :data="filteredCredentials"
      :loading="loading"
      :pagination="{ pageSize: 20 }"
      :row-key="(row: AiCredential) => row.id"
      :scroll-x="1700"
    />

    <section class="mt-6">
      <div class="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 class="text-base font-semibold">凭据事件记录</h3>
          <div class="mt-1 text-xs text-gray-400">追加式事件时间线；不得写入 token、请求头、密码或连接串</div>
        </div>
        <NButton size="small" :loading="loading" @click="load">刷新记录</NButton>
      </div>
      <NDataTable
        :columns="incidentColumns"
        :data="incidents?.snapshot.items ?? []"
        :loading="loading"
        :pagination="{ pageSize: 10 }"
        :row-key="(row: AiCredentialIncidentRecord) => row.incidentId"
        :scroll-x="1180"
      />
    </section>

    <NModal v-model:show="showCreate" preset="card" title="签发企业凭据" style="width:min(700px, 94vw)">
      <NForm label-placement="top">
        <NGrid :cols="2" :x-gap="14" item-responsive>
          <NGi span="2 640:1">
            <NFormItem label="企业">
              <NSelect
                v-model:value="createForm.organizationId"
                :options="organizationOptions"
                filterable
                placeholder="选择合同主体"
              />
            </NFormItem>
          </NGi>
          <NGi span="2 640:1">
            <NFormItem label="凭据名称">
              <NInput v-model:value="createForm.name" placeholder="例如 Production MCP" />
            </NFormItem>
          </NGi>
          <NGi span="2 640:1">
            <NFormItem label="Tenant ID">
              <NInput v-model:value="createForm.tenantId" placeholder="可选" />
            </NFormItem>
          </NGi>
          <NGi span="2 640:1">
            <NFormItem label="Client ID">
              <NInput v-model:value="createForm.clientId" placeholder="可选" />
            </NFormItem>
          </NGi>
          <NGi span="2 640:1">
            <NFormItem label="有效天数">
              <NInputNumber v-model:value="createForm.ttlDays" :min="1" :max="365" style="width:100%" />
            </NFormItem>
          </NGi>
          <NGi span="2 640:1">
            <NFormItem label="Quota policy">
              <NInput v-model:value="createForm.quotaPolicy" placeholder="留空使用合同策略" />
            </NFormItem>
          </NGi>
          <NGi span="2">
            <NFormItem label="工具权限">
              <NCheckboxGroup v-model:value="createForm.scopes">
                <NSpace>
                  <NCheckbox
                    v-for="scope in aiScopeOptions"
                    :key="scope.value"
                    :value="scope.value"
                    :label="scope.label"
                  />
                </NSpace>
              </NCheckboxGroup>
            </NFormItem>
          </NGi>
        <NGi span="2">
          <NFormItem label="IP 白名单">
            <NInput
              v-model:value="createForm.ipAllowList"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 5 }"
                placeholder="每行一个 IP 或 CIDR；留空不限制"
            />
          </NFormItem>
        </NGi>
      </NGrid>
      <NAlert type="warning" title="签发前确认" class="mt-1">
        正式售卖前仍处于测试计量与账单预演阶段。企业凭据会受合同、scope、额度和审计约束；
        外部 Agent 平台可能另行保存对话并收取模型费用。
      </NAlert>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showCreate = false">取消</NButton>
          <NButton type="primary" :loading="saving" @click="createCredential">签发</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="showRotate" preset="card" title="轮换企业凭据" style="width:min(430px, 94vw)">
      <NForm label-placement="top">
        <NFormItem label="新凭据有效天数">
          <NInputNumber v-model:value="rotateTtlDays" :min="1" :max="365" style="width:100%" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showRotate = false">取消</NButton>
          <NButton type="primary" :loading="saving" @click="rotateCredential">确认轮换</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal v-model:show="showIncident" preset="card" title="追加凭据安全事件" style="width:min(620px, 94vw)">
      <NAlert class="mb-4" type="warning" title="事件记录提交后不可覆盖或删除">
        只记录凭据 ID、影响判断和处置过程。不要粘贴 token、Authorization 请求头、密码、连接串或包含这些内容的日志。
      </NAlert>
      <NDescriptions v-if="incidentTarget" :column="1" size="small" bordered class="mb-4">
        <NDescriptionsItem label="凭据">{{ incidentTarget.name }}</NDescriptionsItem>
        <NDescriptionsItem label="凭据 ID">{{ incidentTarget.id }}</NDescriptionsItem>
        <NDescriptionsItem label="使用摘要">
          调用 {{ incidentTarget.callCount }} 次 · 最近 {{ fmt(incidentTarget.lastUsedAt) }} · IP {{ incidentTarget.lastSourceIp || '—' }}
        </NDescriptionsItem>
      </NDescriptions>
      <NForm label-placement="top">
        <NGrid :cols="2" :x-gap="12">
          <NGi>
            <NFormItem label="严重度">
              <NSelect v-model:value="incidentForm.severity" :options="incidentSeverityOptions" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="处置节点">
              <NSelect v-model:value="incidentForm.action" :options="incidentActionOptions" />
            </NFormItem>
          </NGi>
        </NGrid>
        <NFormItem label="事件记录">
          <NInput
            v-model:value="incidentForm.notes"
            type="textarea"
            maxlength="2000"
            show-count
            :autosize="{ minRows: 4, maxRows: 8 }"
            placeholder="记录发现渠道、影响范围、处置动作、验证结果和后续安排。"
          />
        </NFormItem>
        <NFormItem label="证据编号（可选）">
          <NInput v-model:value="incidentForm.evidenceRef" maxlength="500" placeholder="例如 SEC-2026-001；不要填写含密钥的地址" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton :disabled="saving" @click="showIncident = false">取消</NButton>
          <NButton type="primary" :loading="saving" @click="submitIncident">确认追加</NButton>
        </NSpace>
      </template>
    </NModal>

    <NModal
      v-model:show="showToken"
      preset="card"
      title="一次性接入凭据"
      style="width:min(680px, 94vw)"
      :mask-closable="false"
      @after-leave="clearIssuedToken"
    >
      <NAlert type="warning" class="mb-3">
        此 token 关闭后无法再次查看。复制后只交给受信任客户端配置；如果已经出现在截图、聊天记录、日志或工单中，应立即撤销该凭据并重新签发。
      </NAlert>
      <NDescriptions v-if="issued?.credential" :column="1" label-placement="left" size="small" class="mb-3">
        <NDescriptionsItem label="凭据">{{ issued.credential.name }}</NDescriptionsItem>
        <NDescriptionsItem label="ID">{{ issued.credential.id }}</NDescriptionsItem>
        <NDescriptionsItem label="到期">{{ fmt(issued.credential.expiresAt) }}</NDescriptionsItem>
      </NDescriptions>
      <NInput :value="issued?.accessToken || ''" type="textarea" readonly :autosize="{ minRows: 3, maxRows: 6 }" />
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showToken = false">关闭</NButton>
          <NButton type="primary" @click="copyToken">复制 token</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NSpace, NTag, useDialog, useMessage } from 'naive-ui'
import type { AiCredential, AiCredentialIncidentRecord, AiCredentialIncidentResult, AiCredentialIssue, AiOrganization } from '~/types/admin-ai'
import { aiScopeOptions } from '~/types/admin-ai'
import { P } from '~/utils/permissions'

const api = useAdminApi()
const { can } = usePermission()
const message = useMessage()
const dialog = useDialog()
const credentials = ref<AiCredential[]>([])
const organizations = ref<AiOrganization[]>([])
const incidents = ref<AiCredentialIncidentResult | null>(null)
const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const showCreate = ref(false)
const showRotate = ref(false)
const showIncident = ref(false)
const incidentTarget = ref<AiCredential | null>(null)
const rotateCredentialId = ref('')
const rotateTtlDays = ref(90)
const showToken = ref(false)
const issued = ref<AiCredentialIssue | null>(null)
const incidentForm = reactive({
  severity: 'high',
  action: 'detected',
  notes: '',
  evidenceRef: '',
})

const createForm = reactive({
  organizationId: '',
  name: '',
  tenantId: '',
  clientId: '',
  ttlDays: 90,
  scopes: aiScopeOptions.map(item => item.value),
  ipAllowList: '',
  quotaPolicy: '',
})

const statusFilterOptions = [
  { label: '全部状态', value: '' },
  { label: '活跃', value: 'active' },
  { label: '已撤销', value: 'revoked' },
  { label: '已停用', value: 'disabled' },
]
const incidentSeverityOptions = [
  { label: '低', value: 'low' },
  { label: '中', value: 'medium' },
  { label: '高', value: 'high' },
  { label: '严重', value: 'critical' },
]
const incidentActionOptions = [
  { label: '已发现', value: 'detected' },
  { label: '调查中', value: 'investigating' },
  { label: '已轮换', value: 'rotated' },
  { label: '已撤销', value: 'revoked' },
  { label: '已控制', value: 'contained' },
  { label: '已关闭', value: 'closed' },
]

const organizationOptions = computed(() => organizations.value.map(org => ({
  label: `${org.organizationName} · ${org.organizationId}${org.contractStatus === 'active' ? '' : ` · ${statusLabel(org.contractStatus)}`}`,
  value: org.organizationId,
  disabled: org.contractStatus !== 'active',
})))

const expiringCount = computed(() => {
  const threshold = Date.now() + 14 * 86400000
  return credentials.value.filter(item =>
    item.status === 'active' && new Date(item.expiresAt).getTime() <= threshold).length
})

const filteredCredentials = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return credentials.value.filter((item) => {
    if (statusFilter.value && item.status !== statusFilter.value) return false
    if (!query) return true
    return `${item.id} ${item.name} ${item.subjectId} ${item.displayName ?? ''} ${item.clientId ?? ''} ${item.tokenPrefix}`
      .toLowerCase()
      .includes(query)
  })
})

const columns = [
  {
    title: '凭据',
    key: 'name',
    width: 220,
    fixed: 'left' as const,
    render: (row: AiCredential) => h('div', [
      h('div', { class: 'font-medium' }, row.name),
      h('div', { class: 'text-xs text-gray-400' }, row.tokenPrefix),
    ]),
  },
  { title: '企业', key: 'displayName', width: 190, render: (row: AiCredential) => row.displayName || row.subjectId },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (row: AiCredential) => h(
      NTag,
      { size: 'small', type: credentialStatusTag(row.status) },
      { default: () => credentialStatusLabel(row.status) },
    ),
  },
  { title: '调用', key: 'callCount', width: 90 },
  { title: '最近使用', key: 'lastUsedAt', width: 170, render: (row: AiCredential) => fmt(row.lastUsedAt) },
  { title: '到期', key: 'expiresAt', width: 170, render: (row: AiCredential) => fmt(row.expiresAt) },
  {
    title: 'Scope',
    key: 'scopes',
    width: 300,
    render: (row: AiCredential) => h(
      NSpace,
      { size: 4 },
      { default: () => row.scopes.map(scope => h(NTag, { size: 'small', bordered: false }, { default: () => scope })) },
    ),
  },
  { title: 'Client ID', key: 'clientId', width: 160, render: (row: AiCredential) => row.clientId || '—' },
  { title: '最近 IP', key: 'lastSourceIp', width: 140, render: (row: AiCredential) => row.lastSourceIp || '—' },
  {
    title: '操作',
    key: 'actions',
    width: 290,
    fixed: 'right' as const,
    render: (row: AiCredential) => can(P.aiCredentialManage)
      ? h(NSpace, { size: 6 }, {
          default: () => [
            ...(row.status === 'active'
              ? [
                  h(NButton, { size: 'small', onClick: () => openRotate(row) }, { default: () => '轮换' }),
                  h(NButton, {
                    size: 'small',
                    type: 'error',
                    secondary: true,
                    onClick: () => revoke(row),
                  }, { default: () => '撤销' }),
                ]
              : []),
            h(NButton, { size: 'small', tertiary: true, onClick: () => openIncident(row) }, { default: () => '记事件' }),
          ],
        })
      : '—',
  },
]

const incidentColumns = [
  { title: '凭据 ID', key: 'credentialId', width: 230, ellipsis: { tooltip: true } },
  {
    title: '严重度',
    key: 'severity',
    width: 100,
    render: (row: AiCredentialIncidentRecord) => h(
      NTag,
      { size: 'small', type: incidentSeverityTag(row.severity) },
      { default: () => incidentSeverityLabel(row.severity) },
    ),
  },
  {
    title: '处置节点',
    key: 'action',
    width: 120,
    render: (row: AiCredentialIncidentRecord) => h(
      NTag,
      { size: 'small', type: row.action === 'closed' ? 'success' : row.action === 'detected' ? 'error' : 'warning' },
      { default: () => incidentActionLabel(row.action) },
    ),
  },
  { title: '记录人', key: 'reporter', width: 150 },
  { title: '事件记录', key: 'notes', width: 360, ellipsis: { tooltip: true } },
  { title: '证据编号', key: 'evidenceRef', width: 170, render: (row: AiCredentialIncidentRecord) => row.evidenceRef || '—' },
  { title: '时间', key: 'createdAtUtc', width: 170, render: (row: AiCredentialIncidentRecord) => fmt(row.createdAtUtc) },
]

async function load() {
  loading.value = true
  const [credentialResult, organizationResult, incidentResult] = await Promise.all([
    api.get<AiCredential[]>('ai/credentials'),
    api.get<AiOrganization[]>('ai/organizations'),
    api.get<AiCredentialIncidentResult>('ai/credential-incidents', { limit: 100 }),
  ])
  loading.value = false
  if (credentialResult.code === 0) credentials.value = credentialResult.data ?? []
  else message.error(credentialResult.message || '凭据列表加载失败')
  if (organizationResult.code === 0) organizations.value = organizationResult.data ?? []
  if (incidentResult.code === 0) incidents.value = incidentResult.data
  else message.error(incidentResult.message || '凭据事件记录加载失败')
}

function openCreate() {
  Object.assign(createForm, {
    organizationId: '',
    name: '',
    tenantId: '',
    clientId: '',
    ttlDays: 90,
    scopes: aiScopeOptions.map(item => item.value),
    ipAllowList: '',
    quotaPolicy: '',
  })
  showCreate.value = true
}

async function createCredential() {
  const organization = organizations.value.find(item => item.organizationId === createForm.organizationId)
  if (!organization || !createForm.name.trim() || !createForm.scopes.length) {
    message.warning('请选择企业，并填写名称和至少一项工具权限')
    return
  }
  saving.value = true
  const result = await api.post<AiCredentialIssue>('ai/credentials', {
    organizationId: organization.organizationId,
    organizationName: organization.organizationName,
    tenantId: createForm.tenantId.trim() || null,
    name: createForm.name.trim(),
    clientId: createForm.clientId.trim() || null,
    ttlDays: createForm.ttlDays,
    scopes: createForm.scopes,
    ipAllowList: lines(createForm.ipAllowList),
    quotaPolicy: createForm.quotaPolicy.trim() || null,
    rateLimitPolicy: null,
  })
  saving.value = false
  if (result.code === 0 && result.data) {
    issued.value = result.data
    showCreate.value = false
    showToken.value = true
    await load()
  }
  else message.error(result.message || '凭据签发失败')
}

function openRotate(row: AiCredential) {
  rotateCredentialId.value = row.id
  rotateTtlDays.value = 90
  showRotate.value = true
}

function openIncident(row: AiCredential) {
  incidentTarget.value = row
  Object.assign(incidentForm, {
    severity: 'high',
    action: row.status === 'active' ? 'detected' : row.status === 'revoked' ? 'revoked' : 'contained',
    notes: '',
    evidenceRef: '',
  })
  showIncident.value = true
}

async function submitIncident() {
  if (!incidentTarget.value || !incidentForm.notes.trim()) {
    message.warning('请填写事件记录')
    return
  }
  saving.value = true
  const result = await api.post('ai/credential-incidents', {
    credentialId: incidentTarget.value.id,
    severity: incidentForm.severity,
    action: incidentForm.action,
    notes: incidentForm.notes.trim(),
    evidenceRef: incidentForm.evidenceRef.trim() || undefined,
  })
  saving.value = false
  if (result.code !== 0) {
    message.error(result.message || '凭据事件记录追加失败')
    return
  }
  showIncident.value = false
  message.success('凭据事件记录已追加')
  await load()
}

async function rotateCredential() {
  saving.value = true
  const result = await api.post<AiCredentialIssue>(
    `ai/credentials/${encodeURIComponent(rotateCredentialId.value)}/rotate`,
    { ttlDays: rotateTtlDays.value },
  )
  saving.value = false
  if (result.code === 0 && result.data) {
    issued.value = result.data
    showRotate.value = false
    showToken.value = true
    await load()
  }
  else message.error(result.message || '凭据轮换失败')
}

function revoke(row: AiCredential) {
  dialog.warning({
    title: '撤销企业凭据',
    content: `确认撤销 ${row.name}（${row.tokenPrefix}）？已有连接将立即失效。`,
    positiveText: '撤销',
    negativeText: '取消',
    onPositiveClick: async () => {
      const result = await api.del(`ai/credentials/${encodeURIComponent(row.id)}`)
      if (result.code === 0) {
        message.success('凭据已撤销')
        await load()
      }
      else message.error(result.message || '撤销失败')
    },
  })
}

async function copyToken() {
  if (!issued.value?.accessToken) return
  try {
    await navigator.clipboard.writeText(issued.value.accessToken)
    message.success('token 已复制')
  }
  catch {
    message.warning('复制失败，请手动选择')
  }
}

function clearIssuedToken() {
  issued.value = null
}
function lines(value: string) {
  return value.split(/\r?\n|,/).map(item => item.trim()).filter(Boolean)
}
function fmt(value?: string | null) {
  return value ? value.substring(0, 19).replace('T', ' ') : '—'
}
function statusLabel(status: string) {
  return status === 'active' ? '生效' : status === 'suspended' ? '暂停' : '已过期'
}
function credentialStatusLabel(status: AiCredential['status']) {
  return status === 'active' ? '活跃' : status === 'revoked' ? '已撤销' : '已停用'
}
function credentialStatusTag(status: AiCredential['status']) {
  return status === 'active' ? 'success' : status === 'revoked' ? 'default' : 'warning'
}
function incidentSeverityLabel(severity: AiCredentialIncidentRecord['severity']) {
  return { low: '低', medium: '中', high: '高', critical: '严重' }[severity]
}
function incidentSeverityTag(severity: AiCredentialIncidentRecord['severity']) {
  return severity === 'critical' ? 'error' : severity === 'high' ? 'warning' : severity === 'medium' ? 'info' : 'default'
}
function incidentActionLabel(action: AiCredentialIncidentRecord['action']) {
  return {
    detected: '已发现',
    investigating: '调查中',
    rotated: '已轮换',
    revoked: '已撤销',
    contained: '已控制',
    closed: '已关闭',
  }[action]
}

onMounted(load)
</script>
