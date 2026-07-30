<template>
  <div>
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold">AI 企业与合同</h2>
        <div class="mt-1 text-xs text-gray-400">企业主体、合同状态、配额与 SLA</div>
      </div>
      <NSpace>
        <NInput v-model:value="keyword" clearable placeholder="企业 ID / 名称 / 联系人" style="width:240px" />
        <NSelect v-model:value="statusFilter" :options="statusFilterOptions" style="width:130px" />
        <NButton :loading="loading" @click="load">刷新</NButton>
        <NButton v-if="can(P.aiOrganizationManage)" type="primary" @click="openCreate">新增企业</NButton>
      </NSpace>
    </div>

    <NGrid :cols="4" :x-gap="12" item-responsive class="mb-4">
      <NGi span="4 700:1"><NCard size="small"><NStatistic label="企业总数" :value="organizations.length" /></NCard></NGi>
      <NGi span="4 700:1"><NCard size="small"><NStatistic label="生效" :value="countOf('active')" /></NCard></NGi>
      <NGi span="4 700:1"><NCard size="small"><NStatistic label="暂停" :value="countOf('suspended')" /></NCard></NGi>
      <NGi span="4 700:1"><NCard size="small"><NStatistic label="已过期" :value="countOf('expired')" /></NCard></NGi>
    </NGrid>

    <NDataTable
      :columns="columns"
      :data="filteredOrganizations"
      :loading="loading"
      :pagination="{ pageSize: 20 }"
      :row-key="(row: AiOrganization) => row.organizationId"
      :scroll-x="1500"
    />

    <NModal v-model:show="showForm" preset="card" :title="editing ? '编辑企业合同' : '新增企业'" style="width:min(720px, 94vw)">
      <NForm label-placement="top">
        <NGrid :cols="2" :x-gap="14" item-responsive>
          <NGi span="2 640:1">
            <NFormItem label="企业 ID">
              <NInput v-model:value="form.organizationId" :disabled="editing" placeholder="例如 acme-cn" />
            </NFormItem>
          </NGi>
          <NGi span="2 640:1">
            <NFormItem label="企业名称">
              <NInput v-model:value="form.organizationName" placeholder="合同主体名称" />
            </NFormItem>
          </NGi>
          <NGi span="2 640:1">
            <NFormItem label="联系人">
              <NInput v-model:value="form.contactName" />
            </NFormItem>
          </NGi>
          <NGi span="2 640:1">
            <NFormItem label="联系邮箱">
              <NInput v-model:value="form.contactEmail" />
            </NFormItem>
          </NGi>
          <NGi span="2 640:1">
            <NFormItem label="合同状态">
              <NSelect v-model:value="form.contractStatus" :options="statusOptions" />
            </NFormItem>
          </NGi>
          <NGi span="2 640:1">
            <NFormItem label="SLA 等级">
              <NSelect v-model:value="form.slaTier" :options="slaOptions" tag filterable />
            </NFormItem>
          </NGi>
          <NGi span="2">
            <NFormItem label="合同有效期">
              <NDatePicker v-model:value="form.contractRange" type="datetimerange" clearable style="width:100%" />
            </NFormItem>
          </NGi>
          <NGi span="2 640:1">
            <NFormItem label="每日用量单位">
              <NInputNumber v-model:value="form.dailyUsageUnits" :min="1" :max="10000000" style="width:100%" />
            </NFormItem>
          </NGi>
          <NGi span="2 640:1">
            <NFormItem label="每分钟请求">
              <NInputNumber v-model:value="form.requestsPerMinute" :min="1" :max="100000" style="width:100%" />
            </NFormItem>
          </NGi>
          <NGi span="2 640:1">
            <NFormItem label="最大并发">
              <NInputNumber v-model:value="form.maxConcurrency" :min="1" :max="10000" style="width:100%" />
            </NFormItem>
          </NGi>
        </NGrid>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showForm = false">取消</NButton>
          <NButton type="primary" :loading="saving" @click="submit">保存</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NSpace, NTag, useDialog, useMessage } from 'naive-ui'
import type { AiOrganization } from '~/types/admin-ai'
import { P } from '~/utils/permissions'

type ContractStatus = AiOrganization['contractStatus']
interface OrganizationForm {
  organizationId: string
  organizationName: string
  contactName: string
  contactEmail: string
  contractStatus: ContractStatus
  contractRange: [number, number] | null
  dailyUsageUnits: number
  requestsPerMinute: number
  maxConcurrency: number
  slaTier: string
}

const api = useAdminApi()
const { can } = usePermission()
const message = useMessage()
const dialog = useDialog()
const organizations = ref<AiOrganization[]>([])
const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const showForm = ref(false)
const editing = ref(false)

const statusOptions = [
  { label: '生效', value: 'active' },
  { label: '暂停', value: 'suspended' },
  { label: '已过期', value: 'expired' },
]
const statusFilterOptions = [{ label: '全部状态', value: '' }, ...statusOptions]
const slaOptions = [
  { label: '标准', value: 'standard' },
  { label: '高级', value: 'premium' },
  { label: '关键业务', value: 'mission-critical' },
]

const form = reactive<OrganizationForm>(emptyForm())

const filteredOrganizations = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return organizations.value.filter((item) => {
    if (statusFilter.value && item.contractStatus !== statusFilter.value) return false
    if (!query) return true
    return `${item.organizationId} ${item.organizationName} ${item.contactName ?? ''} ${item.contactEmail ?? ''}`
      .toLowerCase()
      .includes(query)
  })
})

const columns = [
  { title: '企业', key: 'organizationName', width: 210, fixed: 'left' as const },
  { title: '企业 ID', key: 'organizationId', width: 170 },
  {
    title: '合同',
    key: 'contractStatus',
    width: 100,
    render: (row: AiOrganization) => h(
      NTag,
      { size: 'small', type: statusTag(row.contractStatus) },
      { default: () => statusLabel(row.contractStatus) },
    ),
  },
  {
    title: '有效期',
    key: 'contractEndsAt',
    width: 190,
    render: (row: AiOrganization) => `${date(row.contractStartsAt)} - ${date(row.contractEndsAt)}`,
  },
  { title: '日额度', key: 'dailyUsageUnits', width: 110 },
  { title: 'RPM', key: 'requestsPerMinute', width: 90 },
  { title: '并发', key: 'maxConcurrency', width: 80 },
  { title: 'SLA', key: 'slaTier', width: 130 },
  {
    title: '联系人',
    key: 'contactName',
    width: 220,
    render: (row: AiOrganization) => row.contactName
      ? `${row.contactName}${row.contactEmail ? ` · ${row.contactEmail}` : ''}`
      : row.contactEmail || '—',
  },
  {
    title: '操作',
    key: 'actions',
    width: 230,
    fixed: 'right' as const,
    render: (row: AiOrganization) => can(P.aiOrganizationManage)
      ? h(NSpace, { size: 6 }, {
          default: () => [
            h(NButton, { size: 'small', onClick: () => openEdit(row) }, { default: () => '编辑' }),
            row.contractStatus === 'active'
              ? h(NButton, {
                  size: 'small',
                  type: 'warning',
                  secondary: true,
                  onClick: () => confirmStatus(row, 'suspended'),
                }, { default: () => '暂停' })
              : h(NButton, {
                  size: 'small',
                  type: 'success',
                  secondary: true,
                  onClick: () => confirmStatus(row, 'active'),
                }, { default: () => '恢复' }),
          ],
        })
      : '—',
  },
]

function emptyForm(): OrganizationForm {
  const now = new Date()
  const nextYear = new Date(now)
  nextYear.setFullYear(nextYear.getFullYear() + 1)
  return {
    organizationId: '',
    organizationName: '',
    contactName: '',
    contactEmail: '',
    contractStatus: 'active',
    contractRange: [now.getTime(), nextYear.getTime()],
    dailyUsageUnits: 10000,
    requestsPerMinute: 600,
    maxConcurrency: 20,
    slaTier: 'standard',
  }
}

async function load() {
  loading.value = true
  const result = await api.get<AiOrganization[]>('ai/organizations')
  loading.value = false
  if (result.code === 0) organizations.value = result.data ?? []
  else message.error(result.message || '企业列表加载失败')
}

function openCreate() {
  editing.value = false
  Object.assign(form, emptyForm())
  showForm.value = true
}

function openEdit(row: AiOrganization) {
  editing.value = true
  Object.assign(form, {
    organizationId: row.organizationId,
    organizationName: row.organizationName,
    contactName: row.contactName ?? '',
    contactEmail: row.contactEmail ?? '',
    contractStatus: row.contractStatus,
    contractRange: row.contractStartsAt && row.contractEndsAt
      ? [new Date(row.contractStartsAt).getTime(), new Date(row.contractEndsAt).getTime()]
      : null,
    dailyUsageUnits: row.dailyUsageUnits,
    requestsPerMinute: row.requestsPerMinute,
    maxConcurrency: row.maxConcurrency,
    slaTier: row.slaTier,
  })
  showForm.value = true
}

async function submit() {
  const id = form.organizationId.trim()
  if (!id || !form.organizationName.trim()) {
    message.warning('请填写企业 ID 和名称')
    return
  }
  saving.value = true
  const result = await api.put<AiOrganization>(`ai/organizations/${encodeURIComponent(id)}`, {
    organizationId: id,
    organizationName: form.organizationName.trim(),
    contactName: form.contactName.trim() || null,
    contactEmail: form.contactEmail.trim() || null,
    contractStatus: form.contractStatus,
    contractStartsAt: form.contractRange ? new Date(form.contractRange[0]).toISOString() : null,
    contractEndsAt: form.contractRange ? new Date(form.contractRange[1]).toISOString() : null,
    dailyUsageUnits: form.dailyUsageUnits,
    requestsPerMinute: form.requestsPerMinute,
    maxConcurrency: form.maxConcurrency,
    slaTier: form.slaTier,
  })
  saving.value = false
  if (result.code === 0) {
    showForm.value = false
    message.success(editing.value ? '企业合同已更新' : '企业已创建')
    await load()
  }
  else {
    message.error(result.message || '保存失败')
  }
}

function confirmStatus(row: AiOrganization, status: ContractStatus) {
  dialog.warning({
    title: status === 'active' ? '恢复企业合同' : '暂停企业合同',
    content: status === 'active'
      ? `确认恢复 ${row.organizationName} 的 AI 合同？`
      : `确认暂停 ${row.organizationName}？现有凭据将立即无法调用。`,
    positiveText: '确认',
    negativeText: '取消',
    onPositiveClick: async () => {
      const result = await api.put(`ai/organizations/${encodeURIComponent(row.organizationId)}/status`, { status })
      if (result.code === 0) {
        message.success(status === 'active' ? '合同已恢复' : '合同已暂停')
        await load()
      }
      else message.error(result.message || '状态更新失败')
    },
  })
}

function countOf(status: ContractStatus) {
  return organizations.value.filter(item => item.contractStatus === status).length
}
function statusLabel(status: ContractStatus) {
  return status === 'active' ? '生效' : status === 'suspended' ? '暂停' : '已过期'
}
function statusTag(status: ContractStatus) {
  return status === 'active' ? 'success' : status === 'suspended' ? 'warning' : 'error'
}
function date(value?: string | null) {
  return value ? value.substring(0, 10) : '—'
}

onMounted(load)
</script>
