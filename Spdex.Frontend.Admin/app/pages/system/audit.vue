<template>
  <div>
    <h2 class="mb-4 text-xl font-semibold">审计日志</h2>

    <NSpace class="mb-4" align="center">
      <NSelect v-model:value="moduleFilter" :options="moduleOptions" clearable placeholder="模块" style="width:160px" />
      <NDatePicker v-model:value="range" type="daterange" clearable />
      <NButton type="primary" @click="reload">查询</NButton>
    </NSpace>

    <NDataTable
      remote
      :columns="columns"
      :data="rows"
      :loading="loading"
      :pagination="pagination"
      @update:page="onPage"
    />
  </div>
</template>

<script setup lang="ts">
interface AuditLog {
  id: number
  adminName: string
  module: string
  action: string
  targetType?: string | null
  targetId?: string | null
  summary?: string | null
  createdAt: string
}

const api = useAdminApi()
const moduleFilter = ref<string | null>(null)
const range = ref<[number, number] | null>(null)
const rows = ref<AuditLog[]>([])
const loading = ref(false)
const pagination = reactive({ page: 1, pageSize: 30, itemCount: 0 })

const moduleOptions = [
  { label: 'user', value: 'user' },
  { label: 'silk', value: 'silk' },
  { label: 'system', value: 'system' },
]

async function load() {
  loading.value = true
  const query: Record<string, unknown> = { page: pagination.page, pageSize: pagination.pageSize }
  if (moduleFilter.value) query.module = moduleFilter.value
  if (range.value) {
    query.begin = new Date(range.value[0]).toISOString()
    query.end = new Date(range.value[1]).toISOString()
  }
  const res = await api.get<AuditLog[]>('audit-logs', query)
  loading.value = false
  rows.value = res.code === 0 && res.data ? res.data : []
  // 后端返回 list（无 total）：满页则放开下一页
  const base = (pagination.page - 1) * pagination.pageSize + rows.value.length
  pagination.itemCount = rows.value.length >= pagination.pageSize ? base + pagination.pageSize : base
}

function reload() { pagination.page = 1; load() }
function onPage(p: number) { pagination.page = p; load() }
function fmt(d?: string) { return d ? d.replace('T', ' ').substring(0, 19) : '—' }

const columns = [
  { title: '时间', key: 'createdAt', width: 170, render: (r: AuditLog) => fmt(r.createdAt) },
  { title: '操作人', key: 'adminName', width: 120 },
  { title: '模块', key: 'module', width: 80 },
  { title: '动作', key: 'action', width: 170 },
  { title: '对象', key: 'target', width: 140, render: (r: AuditLog) => [r.targetType, r.targetId].filter(Boolean).join(' #') || '—' },
  { title: '摘要', key: 'summary', render: (r: AuditLog) => r.summary || '—' },
]

onMounted(load)
</script>
