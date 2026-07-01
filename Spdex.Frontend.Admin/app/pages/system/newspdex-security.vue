<template>
  <div>
    <NSpace class="mb-4" justify="space-between" align="center">
      <div>
        <h2 class="text-xl font-semibold">NewSpdex 防刷</h2>
        <p class="mt-1 text-xs text-gray-400">查看防刷命中状态，调整热更新参数，添加或解除用户/IP 运行时封禁。</p>
      </div>
      <NSpace>
        <NButton :loading="loading" @click="load">刷新</NButton>
        <NButton type="primary" @click="() => openBlock()">新增封禁</NButton>
      </NSpace>
    </NSpace>

    <NGrid :cols="4" :x-gap="12" responsive="screen" class="mb-4">
      <NGi>
        <NCard size="small">
          <NStatistic label="最近触发用户/IP" :value="recentActors.length" />
        </NCard>
      </NGi>
      <NGi>
        <NCard size="small">
          <NStatistic label="运行时封禁" :value="runtimeBlocks.length" />
        </NCard>
      </NGi>
      <NGi>
        <NCard size="small">
          <NStatistic label="配置封禁" :value="staticBlocks.length" />
        </NCard>
      </NGi>
      <NGi>
        <NCard size="small">
          <NStatistic label="冷却中" :value="cooldownCount" />
        </NCard>
      </NGi>
    </NGrid>

    <NCard size="small" title="防刷参数" class="mb-4">
      <template #header-extra>
        <NSpace>
          <NTag size="small" :type="hasRuntimeConfig ? 'warning' : 'success'">
            {{ hasRuntimeConfig ? '运行时覆盖' : 'appsettings' }}
          </NTag>
          <NTag size="small" :type="configSnapshot?.redisAvailable ? 'success' : 'default'">
            Redis {{ configSnapshot?.redisAvailable ? '可用' : '不可用' }}
          </NTag>
          <NButton size="small" :loading="configLoading" @click="loadConfig">刷新参数</NButton>
          <NButton v-if="hasRuntimeConfig" size="small" tertiary type="warning" :loading="savingConfig" @click="resetConfig">恢复默认</NButton>
          <NButton size="small" type="primary" :loading="savingConfig" @click="saveConfig">保存并热更新</NButton>
        </NSpace>
      </template>

      <NForm label-placement="top" size="small">
        <NGrid :cols="4" :x-gap="12" responsive="screen">
          <NGi>
            <NFormItem label="防刷开关">
              <NSwitch v-model:value="configForm.enabled" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="统计窗口">
              <NInputNumber v-model:value="configForm.windowSeconds" :min="10" :max="3600" style="width:100%">
                <template #suffix>秒</template>
              </NInputNumber>
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="重接口请求阈值">
              <NInputNumber v-model:value="configForm.maxHeavyRequestsPerWindow" :min="10" :max="10000" style="width:100%" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="不同赛事阈值">
              <NInputNumber v-model:value="configForm.maxDistinctEventsPerWindow" :min="3" :max="10000" style="width:100%" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="订单明细页阈值">
              <NInputNumber v-model:value="configForm.maxDistinctOrderPagesPerWindow" :min="3" :max="10000" style="width:100%" />
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="冷却时长">
              <NInputNumber v-model:value="configForm.cooldownMinutes" :min="1" :max="1440" style="width:100%">
                <template #suffix>分钟</template>
              </NInputNumber>
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="状态保留">
              <NInputNumber v-model:value="configForm.stateTtlMinutes" :min="5" :max="1440" style="width:100%">
                <template #suffix>分钟</template>
              </NInputNumber>
            </NFormItem>
          </NGi>
          <NGi>
            <NFormItem label="最后更新">
              <NText depth="3">{{ configSnapshot?.runtimeUpdatedAt ? `${fmt(configSnapshot.runtimeUpdatedAt)} ${configSnapshot.runtimeUpdatedBy || ''}` : '—' }}</NText>
            </NFormItem>
          </NGi>
        </NGrid>

        <NFormItem label="重接口路径前缀">
          <NDynamicTags v-model:value="configForm.heavyPathPrefixes" />
        </NFormItem>
      </NForm>
    </NCard>

    <NGrid :cols="2" :x-gap="12" responsive="screen" class="mb-4">
      <NGi>
        <NCard size="small" title="运行时封禁">
          <template #header-extra>
            <NButton v-if="runtimeBlocks.length" size="small" tertiary type="error" @click="clearRuntime">清空运行时封禁</NButton>
          </template>
          <NDataTable
            :columns="runtimeColumns"
            :data="runtimeBlocks"
            :loading="loading"
            :pagination="{ pageSize: 10 }"
            :row-key="blockKey"
          />
        </NCard>
      </NGi>

      <NGi>
        <NCard size="small" title="配置封禁">
          <NDataTable
            :columns="staticColumns"
            :data="staticBlocks"
            :loading="loading"
            :pagination="{ pageSize: 10 }"
            :row-key="blockKey"
          />
          <p class="mt-2 text-xs text-gray-400">配置封禁来自后端环境变量或 appsettings，不能在页面中删除。</p>
        </NCard>
      </NGi>
    </NGrid>

    <NCard size="small" title="最近触发用户 / IP">
      <NDataTable
        :columns="actorColumns"
        :data="recentActors"
        :loading="loading"
        :pagination="{ pageSize: 20 }"
        :row-key="(r: ActorSnapshot) => r.actorKey"
        :scroll-x="1840"
        :single-line="false"
      />
    </NCard>

    <NModal v-model:show="showBlock" preset="card" title="新增运行时封禁" style="width:460px">
      <NForm label-placement="left" label-width="90">
        <NFormItem label="类型">
          <NSelect v-model:value="blockForm.targetType" :options="targetOptions" />
        </NFormItem>
        <NFormItem label="目标">
          <NInput v-model:value="blockForm.target" :placeholder="targetPlaceholder" />
        </NFormItem>
        <NFormItem label="时长">
          <NInputNumber
            v-model:value="blockForm.durationMinutes"
            :min="1"
            :max="43200"
            clearable
            style="width:100%"
            placeholder="留空表示直到服务重启或手动解除"
          >
            <template #suffix>分钟</template>
          </NInputNumber>
        </NFormItem>
        <NFormItem label="原因">
          <NInput v-model:value="blockForm.reason" type="textarea" :autosize="{ minRows: 2, maxRows: 4 }" placeholder="可选" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="showBlock = false">取消</NButton>
          <NButton type="primary" :loading="saving" @click="submitBlock">确定</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NSpace, NTag, useDialog, useMessage } from 'naive-ui'

interface BlockEntry {
  targetType: string
  target: string
  reason?: string | null
  createdAt: string
  expiresAt?: string | null
}

interface ActorSnapshot {
  actorKey: string
  userId?: string | null
  userName?: string | null
  ip: string
  requestCount: number
  distinctEvents: number
  distinctOrderPages: number
  cooldownUntil?: string | null
  cooldownReason?: string | null
  cooldownRequestCount?: number | null
  cooldownElapsedSeconds?: number | null
  cooldownRequestsPerSecond?: number | null
  lastSeen: string
}

interface SecurityBlocksResult {
  staticBlocks: BlockEntry[]
  runtimeBlocks: BlockEntry[]
  recentActors: ActorSnapshot[]
}

interface RuntimeConfig {
  enabled: boolean
  heavyPathPrefixes: string[]
  windowSeconds: number
  maxHeavyRequestsPerWindow: number
  maxDistinctEventsPerWindow: number
  maxDistinctOrderPagesPerWindow: number
  cooldownMinutes: number
  stateTtlMinutes: number
}

interface ConfigSnapshot {
  appSettings: RuntimeConfig
  effective: RuntimeConfig
  runtimeOverride?: RuntimeConfig | null
  runtimeUpdatedAt?: string | null
  runtimeUpdatedBy?: string | null
  redisAvailable: boolean
}

const api = useAdminApi()
const message = useMessage()
const dialog = useDialog()

const loading = ref(false)
const configLoading = ref(false)
const saving = ref(false)
const savingConfig = ref(false)
const staticBlocks = ref<BlockEntry[]>([])
const runtimeBlocks = ref<BlockEntry[]>([])
const recentActors = ref<ActorSnapshot[]>([])
const configSnapshot = ref<ConfigSnapshot | null>(null)

const defaultConfig = (): RuntimeConfig => ({
  enabled: true,
  heavyPathPrefixes: [
    '/api/newspdex/charts',
    '/api/newspdex/order-detail',
    '/api/newspdex/big-trades',
    '/api/newspdex/trades',
    '/api/newspdex/ladder',
    '/api/newspdex/correct-score',
    '/api/newspdex/inner-outer',
  ],
  windowSeconds: 60,
  maxHeavyRequestsPerWindow: 80,
  maxDistinctEventsPerWindow: 20,
  maxDistinctOrderPagesPerWindow: 25,
  cooldownMinutes: 10,
  stateTtlMinutes: 30,
})

const configForm = reactive<RuntimeConfig>(defaultConfig())

const cooldownCount = computed(() => recentActors.value.filter(a => isFuture(a.cooldownUntil)).length)
const hasRuntimeConfig = computed(() => !!configSnapshot.value?.runtimeOverride)

const targetOptions = [
  { label: '用户名', value: 'user' },
  { label: '用户 ID', value: 'userId' },
  { label: 'IP', value: 'ip' },
]

const showBlock = ref(false)
const blockForm = reactive({
  targetType: 'user',
  target: '',
  durationMinutes: 1440 as number | null,
  reason: '',
})

const targetPlaceholder = computed(() => {
  if (blockForm.targetType === 'ip') return '例如 115.227.156.106'
  if (blockForm.targetType === 'userId') return '例如 12345'
  return '例如 jingjiahao'
})

async function load() {
  await Promise.all([loadBlocks(), loadConfig()])
}

async function loadBlocks() {
  loading.value = true
  const res = await api.get<SecurityBlocksResult>('newspdex/security/blocks')
  loading.value = false
  if (res.code !== 0 || !res.data) {
    message.error(res.message || '加载失败')
    return
  }

  staticBlocks.value = res.data.staticBlocks ?? []
  runtimeBlocks.value = res.data.runtimeBlocks ?? []
  recentActors.value = res.data.recentActors ?? []
}

async function loadConfig() {
  configLoading.value = true
  const res = await api.get<ConfigSnapshot>('newspdex/security/config')
  configLoading.value = false
  if (res.code !== 0 || !res.data) {
    message.error(res.message || '参数加载失败')
    return
  }

  configSnapshot.value = res.data
  applyConfig(res.data.effective)
}

function applyConfig(config: RuntimeConfig) {
  Object.assign(configForm, {
    enabled: config.enabled,
    heavyPathPrefixes: [...(config.heavyPathPrefixes ?? [])],
    windowSeconds: config.windowSeconds,
    maxHeavyRequestsPerWindow: config.maxHeavyRequestsPerWindow,
    maxDistinctEventsPerWindow: config.maxDistinctEventsPerWindow,
    maxDistinctOrderPagesPerWindow: config.maxDistinctOrderPagesPerWindow,
    cooldownMinutes: config.cooldownMinutes,
    stateTtlMinutes: config.stateTtlMinutes,
  })
}

function normalizeConfigForm(): RuntimeConfig {
  return {
    enabled: !!configForm.enabled,
    heavyPathPrefixes: [...new Set((configForm.heavyPathPrefixes ?? [])
      .map(x => x.trim())
      .filter(Boolean)
      .map(x => x.startsWith('/') ? x : `/${x}`))],
    windowSeconds: Number(configForm.windowSeconds) || 60,
    maxHeavyRequestsPerWindow: Number(configForm.maxHeavyRequestsPerWindow) || 80,
    maxDistinctEventsPerWindow: Number(configForm.maxDistinctEventsPerWindow) || 20,
    maxDistinctOrderPagesPerWindow: Number(configForm.maxDistinctOrderPagesPerWindow) || 25,
    cooldownMinutes: Number(configForm.cooldownMinutes) || 10,
    stateTtlMinutes: Number(configForm.stateTtlMinutes) || 30,
  }
}

async function saveConfig() {
  const payload = normalizeConfigForm()
  if (payload.enabled && payload.heavyPathPrefixes.length === 0) {
    message.warning('请至少保留一个重接口路径前缀')
    return
  }

  savingConfig.value = true
  const res = await api.put<ConfigSnapshot>('newspdex/security/config', payload)
  savingConfig.value = false
  if (res.code === 0 && res.data) {
    configSnapshot.value = res.data
    applyConfig(res.data.effective)
    message.success('参数已热更新')
  }
  else {
    message.error(res.message || '保存失败')
  }
}

function resetConfig() {
  dialog.warning({
    title: '恢复默认参数',
    content: '确认恢复为后端 appsettings 中的防刷参数？',
    positiveText: '恢复',
    negativeText: '取消',
    onPositiveClick: async () => {
      savingConfig.value = true
      const res = await api.del<ConfigSnapshot>('newspdex/security/config/runtime')
      savingConfig.value = false
      if (res.code === 0 && res.data) {
        configSnapshot.value = res.data
        applyConfig(res.data.effective)
        message.success('已恢复默认参数')
      }
      else {
        message.error(res.message || '恢复失败')
      }
    },
  })
}

function openBlock(targetType = 'user', target = '') {
  Object.assign(blockForm, {
    targetType,
    target,
    durationMinutes: 1440,
    reason: '',
  })
  showBlock.value = true
}

async function submitBlock() {
  if (!blockForm.target.trim()) {
    message.warning('请输入封禁目标')
    return
  }

  saving.value = true
  const res = await api.post('newspdex/security/blocks', {
    targetType: blockForm.targetType,
    target: blockForm.target.trim(),
    durationMinutes: blockForm.durationMinutes,
    reason: blockForm.reason.trim() || null,
  })
  saving.value = false

  if (res.code === 0) {
    message.success('已添加封禁')
    showBlock.value = false
    load()
  }
  else {
    message.error(res.message || '添加失败')
  }
}

function removeBlock(row: BlockEntry) {
  dialog.warning({
    title: '解除封禁',
    content: `确认解除 ${typeLabel(row.targetType)} ${row.target}？`,
    positiveText: '解除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const res = await api.del('newspdex/security/blocks', {
        targetType: row.targetType,
        target: row.target,
      })
      if (res.code === 0) {
        message.success('已解除')
        load()
      }
      else {
        message.error(res.message || '解除失败')
      }
    },
  })
}

function clearRuntime() {
  dialog.warning({
    title: '清空运行时封禁',
    content: '确认清空所有运行时封禁？配置封禁不会受影响。',
    positiveText: '清空',
    negativeText: '取消',
    onPositiveClick: async () => {
      const res = await api.del('newspdex/security/blocks/runtime')
      if (res.code === 0) {
        message.success('已清空')
        load()
      }
      else {
        message.error(res.message || '清空失败')
      }
    },
  })
}

function blockKey(row: BlockEntry) {
  return `${row.targetType}:${row.target}:${row.createdAt}`
}

function typeLabel(type: string) {
  if (type === 'ip') return 'IP'
  if (type === 'userId') return '用户 ID'
  return '用户名'
}

function typeTag(type: string) {
  const tagType = type === 'ip' ? 'warning' : type === 'userId' ? 'info' : 'success'
  return h(NTag, { size: 'small', type: tagType }, { default: () => typeLabel(type) })
}

function fmt(d?: string | null) {
  if (!d || d.startsWith('0001-')) return '—'
  return d.replace('T', ' ').substring(0, 19)
}

function isFuture(d?: string | null) {
  return !!d && new Date(d).getTime() > Date.now()
}

function actorUser(row: ActorSnapshot) {
  if (row.userName && row.userId) return `${row.userName} #${row.userId}`
  return row.userName || row.userId || '匿名'
}

function cooldownReason(row: ActorSnapshot) {
  const reason = row.cooldownReason || ''
  if (!reason) return '—'
  const legacy = reason.match(/^(heavy-requests|distinct-events|order-pages)>(\d+)$/)
  if (!legacy) return reason

  const metric = legacy[1] || ''
  const limit = legacy[2] || ''
  const labels: Record<string, string> = {
    'heavy-requests': '重接口请求',
    'distinct-events': '不同赛事',
    'order-pages': '明细页',
  }
  return `${labels[metric] || metric} > ${limit}（旧记录未保存实际值）`
}

function trimNumber(value: number, digits = 2) {
  return value.toFixed(digits).replace(/\.?0+$/, '')
}

function triggerRate(row: ActorSnapshot) {
  const rate = row.cooldownRequestsPerSecond
  return typeof rate === 'number' && Number.isFinite(rate) ? rate : null
}

function triggerRateText(row: ActorSnapshot) {
  const rate = triggerRate(row)
  if (rate === null) return '—'
  return `${trimNumber(rate, rate >= 10 ? 1 : 2)} 次/秒`
}

function triggerRateTag(row: ActorSnapshot) {
  const rate = triggerRate(row)
  if (rate === null) return '—'

  const tagType = rate >= 5 ? 'error' : rate >= 2 ? 'warning' : 'info'
  const elapsed = typeof row.cooldownElapsedSeconds === 'number'
    ? `${trimNumber(row.cooldownElapsedSeconds, row.cooldownElapsedSeconds >= 10 ? 0 : 1)} 秒`
    : '触发窗口'
  const count = typeof row.cooldownRequestCount === 'number' ? row.cooldownRequestCount : null
  const title = count ? `${elapsed}内 ${count} 次` : elapsed
  return h(NTag, { size: 'small', type: tagType, title }, { default: () => triggerRateText(row) })
}

const runtimeColumns = [
  { title: '类型', key: 'targetType', width: 90, render: (r: BlockEntry) => typeTag(r.targetType) },
  { title: '目标', key: 'target' },
  { title: '原因', key: 'reason', minWidth: 180, ellipsis: { tooltip: true }, render: (r: BlockEntry) => r.reason || '—' },
  { title: '到期', key: 'expiresAt', width: 170, render: (r: BlockEntry) => fmt(r.expiresAt) },
  {
    title: '操作',
    key: 'actions',
    width: 90,
    render: (r: BlockEntry) => h(NButton, { size: 'small', type: 'error', tertiary: true, onClick: () => removeBlock(r) }, { default: () => '解除' }),
  },
]

const staticColumns = [
  { title: '类型', key: 'targetType', width: 90, render: (r: BlockEntry) => typeTag(r.targetType) },
  { title: '目标', key: 'target' },
  { title: '原因', key: 'reason', minWidth: 180, ellipsis: { tooltip: true }, render: (r: BlockEntry) => r.reason || 'configured' },
]

const actorColumns = [
  { title: '用户', key: 'user', width: 230, render: (r: ActorSnapshot) => actorUser(r) },
  { title: 'IP', key: 'ip', width: 150 },
  { title: '重接口请求', key: 'requestCount', width: 110 },
  { title: '不同赛事', key: 'distinctEvents', width: 100 },
  { title: '明细页', key: 'distinctOrderPages', width: 90 },
  {
    title: '触发频率',
    key: 'cooldownRequestsPerSecond',
    width: 150,
    sorter: (a: ActorSnapshot, b: ActorSnapshot) => (a.cooldownRequestsPerSecond ?? -1) - (b.cooldownRequestsPerSecond ?? -1),
    render: (r: ActorSnapshot) => triggerRateTag(r),
  },
  {
    title: '状态',
    key: 'cooldownUntil',
    width: 230,
    render: (r: ActorSnapshot) => isFuture(r.cooldownUntil)
      ? h(NTag, { size: 'small', type: 'error' }, { default: () => `冷却至 ${fmt(r.cooldownUntil)}` })
      : h(NTag, { size: 'small' }, { default: () => '正常' }),
  },
  { title: '原因', key: 'cooldownReason', width: 420, ellipsis: { tooltip: true }, render: (r: ActorSnapshot) => cooldownReason(r) },
  { title: '最后触发', key: 'lastSeen', width: 170, render: (r: ActorSnapshot) => fmt(r.lastSeen) },
  {
    title: '操作',
    key: 'actions',
    width: 190,
    render: (r: ActorSnapshot) => h(NSpace, { size: 'small' }, {
      default: () => [
        r.userName
          ? h(NButton, { size: 'small', onClick: () => openBlock('user', r.userName || '') }, { default: () => '封用户名' })
          : null,
        h(NButton, { size: 'small', onClick: () => openBlock('ip', r.ip) }, { default: () => '封 IP' }),
      ].filter(Boolean),
    }),
  },
]

onMounted(load)
</script>
