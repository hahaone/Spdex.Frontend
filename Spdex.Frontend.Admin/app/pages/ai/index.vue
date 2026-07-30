<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold">AI / MCP 运行总览</h2>
        <div class="mt-1 text-xs text-gray-400">
          {{ status?.service || 'spdex-ai-mcp' }} · {{ status?.environment || '—' }} · v{{ status?.version || '—' }}
        </div>
      </div>
      <NSpace>
        <NButton :loading="loading" @click="load">刷新</NButton>
        <NButton
          v-if="can(P.aiOpsManage)"
          type="primary"
          secondary
          :loading="archiving"
          @click="createArchive"
        >
          创建账本归档
        </NButton>
      </NSpace>
    </div>

    <NAlert
      v-if="status"
      class="mb-4"
      :type="status.status === 'ok' ? 'success' : status.status === 'degraded' ? 'warning' : 'error'"
      :title="statusLabel(status.status)"
    >
      最近检查 {{ fmt(status.generatedAtUtc) }}，当前 {{ alerts.length }} 项需关注。
    </NAlert>

    <NGrid :cols="4" :x-gap="12" :y-gap="12" item-responsive class="mb-4">
      <NGi span="4 700:1">
        <NCard size="small">
          <NStatistic label="工具" :value="status?.tools.count ?? '—'" />
        </NCard>
      </NGi>
      <NGi span="4 700:1">
        <NCard size="small">
          <NStatistic label="账本记录" :value="status?.audit.ledgerRecordCount ?? '—'" />
        </NCard>
      </NGi>
      <NGi span="4 700:1">
        <NCard size="small">
          <NStatistic label="用量聚合" :value="status?.usage.aggregateCount ?? '—'" />
        </NCard>
      </NGi>
      <NGi span="4 700:1">
        <NCard size="small">
          <NStatistic label="企业 / 活跃凭据" :value="`${organizations.length} / ${activeCredentials}`" />
        </NCard>
      </NGi>
    </NGrid>

    <NGrid :cols="2" :x-gap="12" :y-gap="12" item-responsive class="mb-4">
      <NGi span="2 900:1">
        <NCard title="服务链路" size="small">
          <NDescriptions label-placement="left" :column="1" size="small">
            <NDescriptionsItem label="AI 服务">
              <NTag size="small" :type="statusTag(status?.status)">{{ statusLabel(status?.status) }}</NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="WebApi 下游">
              <NTag size="small" :type="status?.downstream.healthy ? 'success' : 'error'">
                {{ status?.downstream.healthy ? '正常' : `异常 ${status?.downstream.httpStatusCode || ''}` }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="限流协调">
              <NTag size="small" :type="coordinatorHealthy ? 'success' : 'warning'">
                {{ status?.subjectPolicyCoordination.provider || '—' }}
                {{ status?.subjectPolicyCoordination.centralized ? '集中式' : '本机' }}
              </NTag>
            </NDescriptionsItem>
            <NDescriptionsItem label="持久账本">
              <NTag size="small" :type="status?.audit.persistent ? 'success' : 'warning'">
                {{ status?.audit.storageProvider || '—' }}
              </NTag>
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
      <NGi span="2 900:1">
        <NCard title="备份与归档" size="small">
          <NDescriptions label-placement="left" :column="1" size="small">
            <NDescriptionsItem label="在线归档">
              <NTag size="small" :type="integrityTag(status?.ledgerMaintenance.latestArchiveIntegrityOk)">
                {{ integrityLabel(status?.ledgerMaintenance.latestArchiveIntegrityOk) }}
              </NTag>
              <span class="ml-2 text-xs text-gray-400">{{ fmt(status?.ledgerMaintenance.latestArchiveCreatedAtUtc) }}</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="归档记录">
              {{ status?.ledgerMaintenance.latestArchiveRecordCount ?? '—' }}
            </NDescriptionsItem>
            <NDescriptionsItem label="卷外备份">
              <NTag size="small" :type="integrityTag(status?.ledgerMaintenance.externalBackupIntegrityOk)">
                {{ integrityLabel(status?.ledgerMaintenance.externalBackupIntegrityOk) }}
              </NTag>
              <span class="ml-2 text-xs text-gray-400">{{ fmt(status?.ledgerMaintenance.externalBackupCreatedAtUtc) }}</span>
            </NDescriptionsItem>
            <NDescriptionsItem label="备份记录">
              {{ status?.ledgerMaintenance.externalBackupRecordCount ?? '—' }}
            </NDescriptionsItem>
          </NDescriptions>
        </NCard>
      </NGi>
    </NGrid>

    <NCard title="告警与合同提醒" size="small">
      <NEmpty v-if="!alerts.length" description="当前没有待处理告警" />
      <NDataTable
        v-else
        :columns="alertColumns"
        :data="alerts"
        :pagination="{ pageSize: 10 }"
        :row-key="(row: AlertRow) => row.id"
      />
    </NCard>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NTag, useMessage } from 'naive-ui'
import type { AiCredential, AiOpsStatus, AiOrganization } from '~/types/admin-ai'
import { P } from '~/utils/permissions'

interface AlertRow {
  id: string
  level: 'error' | 'warning'
  source: string
  message: string
}

const api = useAdminApi()
const { can } = usePermission()
const message = useMessage()
const status = ref<AiOpsStatus | null>(null)
const organizations = ref<AiOrganization[]>([])
const credentials = ref<AiCredential[]>([])
const loading = ref(false)
const archiving = ref(false)

const coordinatorHealthy = computed(() =>
  !!status.value?.subjectPolicyCoordination.available
  && status.value.subjectPolicyCoordination.errorCount === 0
  && status.value.subjectPolicyCoordination.fallbackAcquisitionCount === 0)

const activeCredentials = computed(() =>
  credentials.value.filter(item => item.status === 'active' && new Date(item.expiresAt).getTime() > Date.now()).length)

const alerts = computed<AlertRow[]>(() => {
  const rows: AlertRow[] = (status.value?.warnings ?? []).map((warning, index) => ({
    id: `ops-${index}`,
    level: warning.startsWith('not_ready:') ? 'error' : 'warning',
    source: '运行状态',
    message: warning.replace(/^(not_ready|degraded):\s*/, ''),
  }))
  const soon = Date.now() + 30 * 86400000
  for (const org of organizations.value) {
    if (org.contractStatus !== 'active') {
      rows.push({
        id: `org-status-${org.organizationId}`,
        level: org.contractStatus === 'expired' ? 'error' : 'warning',
        source: org.organizationName,
        message: `合同状态为 ${contractLabel(org.contractStatus)}`,
      })
    }
    else if (org.contractEndsAt && new Date(org.contractEndsAt).getTime() <= soon) {
      rows.push({
        id: `org-expiry-${org.organizationId}`,
        level: 'warning',
        source: org.organizationName,
        message: `合同将在 ${fmt(org.contractEndsAt)} 到期`,
      })
    }
  }
  return rows
})

const alertColumns = [
  {
    title: '级别',
    key: 'level',
    width: 90,
    render: (row: AlertRow) => h(
      NTag,
      { type: row.level === 'error' ? 'error' : 'warning', size: 'small' },
      { default: () => row.level === 'error' ? '严重' : '提醒' },
    ),
  },
  { title: '来源', key: 'source', width: 180 },
  { title: '内容', key: 'message' },
]

async function load() {
  loading.value = true
  const requests: Promise<unknown>[] = []
  const statusRequest = api.get<AiOpsStatus>('ai/status')
  requests.push(statusRequest)
  const organizationRequest = can(P.aiOrganizationView)
    ? api.get<AiOrganization[]>('ai/organizations')
    : Promise.resolve(null)
  requests.push(organizationRequest)
  const credentialRequest = can(P.aiCredentialView)
    ? api.get<AiCredential[]>('ai/credentials')
    : Promise.resolve(null)
  requests.push(credentialRequest)

  const [statusResult, organizationResult, credentialResult] = await Promise.all([
    statusRequest,
    organizationRequest,
    credentialRequest,
  ])
  loading.value = false
  status.value = statusResult.code === 0 ? statusResult.data : null
  if (organizationResult?.code === 0) organizations.value = organizationResult.data ?? []
  if (credentialResult?.code === 0) credentials.value = credentialResult.data ?? []
  if (statusResult.code !== 0) message.error(statusResult.message || '运行状态加载失败')
}

async function createArchive() {
  archiving.value = true
  const result = await api.post('ai/maintenance/archive')
  archiving.value = false
  if (result.code === 0) {
    message.success('在线归档已创建并校验')
    await load()
  }
  else {
    message.error(result.message || '归档失败')
  }
}

function fmt(value?: string | null) {
  return value ? value.substring(0, 19).replace('T', ' ') : '—'
}
function statusLabel(value?: string) {
  return value === 'ok' ? '运行正常' : value === 'degraded' ? '服务降级' : value === 'not_ready' ? '未就绪' : '未知'
}
function statusTag(value?: string) {
  return value === 'ok' ? 'success' : value === 'degraded' ? 'warning' : 'error'
}
function integrityLabel(value?: boolean | null) {
  return value === true ? '校验通过' : value === false ? '校验失败' : '暂无'
}
function integrityTag(value?: boolean | null) {
  return value === true ? 'success' : value === false ? 'error' : 'default'
}
function contractLabel(value: string) {
  return value === 'active' ? '生效' : value === 'suspended' ? '暂停' : '已过期'
}

onMounted(load)
</script>
