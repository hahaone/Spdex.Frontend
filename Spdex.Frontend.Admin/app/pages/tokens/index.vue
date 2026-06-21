<template>
  <div>
    <h2 class="mb-4 text-xl font-semibold">用户令牌</h2>
    <p class="mb-4 text-xs text-gray-400">
      FJCX 竞彩工作室授权令牌：用户在激活页输入令牌码后绑定到账号，决定其访问范围（竞彩 / 全部）。
      更改类型或撤销绑定会立即使该用户的登录会话失效，需重新登录。
    </p>

    <NSpace class="mb-3" align="center">
      <NTag type="default" :bordered="false">总数 {{ tokens.length }}</NTag>
      <NTag type="warning" :bordered="false">未绑定 {{ unboundCount }}</NTag>
      <NTag type="success" :bordered="false">已绑定 {{ boundCount }}</NTag>
      <NTag type="info" :bordered="false">竞彩 {{ jcCount }}</NTag>
      <NTag type="primary" :bordered="false">全部 {{ fullCount }}</NTag>
    </NSpace>

    <NTabs type="line" animated>
      <!-- ───────── 令牌列表 ───────── -->
      <NTabPane name="tokens" tab="令牌列表">
        <NSpace class="mb-3" align="center">
          <NInput
            v-model:value="keyword"
            placeholder="令牌码 / 绑定用户名 / UserId"
            style="width:240px"
            clearable
          />
          <NSelect v-model:value="typeFilter" :options="typeFilterOptions" style="width:130px" />
          <NSelect v-model:value="bindFilter" :options="bindFilterOptions" style="width:130px" />
          <NButton @click="load">刷新</NButton>
          <template v-if="can(P.tokenManage)">
            <NButton type="primary" @click="openAdd">新增令牌</NButton>
            <NButton type="primary" secondary @click="openGenerate">批量生成</NButton>
          </template>
        </NSpace>

        <NDataTable
          :columns="tokenColumns"
          :data="filteredTokens"
          :loading="loading"
          :pagination="{ pageSize: 20 }"
          :row-key="(r: TokenRow) => r.code"
        />
      </NTabPane>

      <!-- ───────── 绑定关系 ───────── -->
      <NTabPane name="bindings" tab="绑定关系">
        <NSpace class="mb-3" align="center">
          <NInput
            v-model:value="bindKeyword"
            placeholder="用户名 / UserId / 令牌码"
            style="width:240px"
            clearable
          />
          <NButton @click="load">刷新</NButton>
        </NSpace>
        <NDataTable
          :columns="bindingColumns"
          :data="filteredBindings"
          :loading="loading"
          :pagination="{ pageSize: 20 }"
          :row-key="(r: BindingRow) => r.userId"
        />
      </NTabPane>
    </NTabs>

    <!-- 新增令牌 -->
    <NModal v-model:show="showAdd" preset="card" title="新增令牌" style="width:400px">
      <NForm label-placement="left" label-width="80">
        <NFormItem label="令牌码">
          <NInput v-model:value="addForm.code" placeholder="唯一令牌码（区分大小写）" />
        </NFormItem>
        <NFormItem label="类型">
          <NSelect v-model:value="addForm.type" :options="typeOptions" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NButton type="primary" :loading="saving" @click="submitAdd">确定</NButton>
      </template>
    </NModal>

    <!-- 批量生成 -->
    <NModal v-model:show="showGenerate" preset="card" title="批量生成令牌" style="width:400px">
      <NForm label-placement="left" label-width="80">
        <NFormItem label="数量">
          <NInputNumber v-model:value="genForm.count" :min="1" :max="100" style="width:100%" />
        </NFormItem>
        <NFormItem label="类型">
          <NSelect v-model:value="genForm.type" :options="typeOptions" />
        </NFormItem>
        <div class="text-xs text-gray-400">随机生成 9 位令牌码（每次最多 100 个）。</div>
      </NForm>
      <template #footer>
        <NButton type="primary" :loading="saving" @click="submitGenerate">生成</NButton>
      </template>
    </NModal>

    <!-- 生成结果 -->
    <NModal v-model:show="showGenResult" preset="card" title="已生成令牌" style="width:440px">
      <p class="mb-2 text-sm text-gray-500">共 {{ genResult.length }} 个，请复制保存：</p>
      <NInput type="textarea" :value="genResultText" readonly :autosize="{ minRows: 4, maxRows: 12 }" />
      <template #footer>
        <NButton type="primary" @click="copyGenResult">复制</NButton>
      </template>
    </NModal>

    <!-- 改类型 -->
    <NModal v-model:show="showType" preset="card" title="更改令牌类型" style="width:400px">
      <NForm label-placement="left" label-width="80">
        <NFormItem label="令牌码">
          <NInput :value="typeForm.code" readonly />
        </NFormItem>
        <NFormItem label="新类型">
          <NSelect v-model:value="typeForm.type" :options="typeOptions" />
        </NFormItem>
        <div v-if="typeForm.boundUserId" class="text-xs text-orange-500">
          该令牌已绑定用户（ID:{{ typeForm.boundUserId }}），更改后其会话将立即失效，需重新登录。
        </div>
      </NForm>
      <template #footer>
        <NButton type="primary" :loading="saving" @click="submitType">确定</NButton>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NSpace, NTag, useMessage, useDialog } from 'naive-ui'
import { P } from '~/utils/permissions'

interface BoundUser { userId: number, userName: string, activatedAt: string }
interface TokenRow { code: string, type: string, boundTo: BoundUser | null }
interface BindingRow { userId: number, userName: string, code: string, type: string, activatedAt: string }

const api = useAdminApi()
const message = useMessage()
const dialog = useDialog()
const { can } = usePermission()

const tokens = ref<TokenRow[]>([])
const loading = ref(false)
const saving = ref(false)

const typeOptions = [
  { label: '竞彩 (jc)', value: 'jc' },
  { label: '全部 (full)', value: 'full' },
]
const typeFilterOptions = [{ label: '全部类型', value: '' }, ...typeOptions]
const bindFilterOptions = [
  { label: '全部', value: '' },
  { label: '已绑定', value: 'bound' },
  { label: '未绑定', value: 'unbound' },
]

const keyword = ref('')
const typeFilter = ref('')
const bindFilter = ref('')
const bindKeyword = ref('')

async function load() {
  loading.value = true
  const res = await api.get<TokenRow[]>('license-tokens')
  loading.value = false
  if (res.code === 0 && res.data) tokens.value = res.data
  else message.error(res.message)
}

const unboundCount = computed(() => tokens.value.filter(t => !t.boundTo).length)
const boundCount = computed(() => tokens.value.filter(t => t.boundTo).length)
const jcCount = computed(() => tokens.value.filter(t => t.type === 'jc').length)
const fullCount = computed(() => tokens.value.filter(t => t.type === 'full').length)

const filteredTokens = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  return tokens.value.filter((t) => {
    if (typeFilter.value && t.type !== typeFilter.value) return false
    if (bindFilter.value === 'bound' && !t.boundTo) return false
    if (bindFilter.value === 'unbound' && t.boundTo) return false
    if (kw) {
      const hay = `${t.code} ${t.boundTo?.userName ?? ''} ${t.boundTo?.userId ?? ''}`.toLowerCase()
      if (!hay.includes(kw)) return false
    }
    return true
  })
})

const bindings = computed<BindingRow[]>(() =>
  tokens.value
    .filter(t => t.boundTo)
    .map(t => ({
      userId: t.boundTo!.userId,
      userName: t.boundTo!.userName,
      code: t.code,
      type: t.type,
      activatedAt: t.boundTo!.activatedAt,
    })))

const filteredBindings = computed(() => {
  const kw = bindKeyword.value.trim().toLowerCase()
  if (!kw) return bindings.value
  return bindings.value.filter(b =>
    `${b.userName} ${b.userId} ${b.code}`.toLowerCase().includes(kw))
})

function typeTag(type: string) {
  return type === 'jc'
    ? h(NTag, { type: 'info', size: 'small' }, { default: () => '竞彩 (jc)' })
    : h(NTag, { type: 'success', size: 'small' }, { default: () => '全部 (full)' })
}
function fmtDateTime(d?: string | null) { return d ? d.substring(0, 19).replace('T', ' ') : '—' }

// ── 新增 ──
const showAdd = ref(false)
const addForm = reactive({ code: '', type: 'jc' })
function openAdd() { addForm.code = ''; addForm.type = 'jc'; showAdd.value = true }
async function submitAdd() {
  if (!addForm.code.trim()) { message.warning('请输入令牌码'); return }
  saving.value = true
  const res = await api.post('license-tokens', { code: addForm.code.trim(), type: addForm.type })
  saving.value = false
  if (res.code === 0) { message.success('已添加'); showAdd.value = false; load() }
  else message.error(res.message)
}

// ── 批量生成 ──
const showGenerate = ref(false)
const genForm = reactive<{ count: number, type: string }>({ count: 10, type: 'jc' })
const showGenResult = ref(false)
const genResult = ref<{ code: string, type: string }[]>([])
const genResultText = computed(() => genResult.value.map(t => t.code).join('\n'))
function openGenerate() { genForm.count = 10; genForm.type = 'jc'; showGenerate.value = true }
async function submitGenerate() {
  if (!genForm.count || genForm.count < 1 || genForm.count > 100) { message.warning('数量需在 1-100'); return }
  saving.value = true
  const res = await api.post<{ tokens: { code: string, type: string }[], generatedCount: number }>(
    'license-tokens/generate', { count: genForm.count, type: genForm.type })
  saving.value = false
  if (res.code === 0 && res.data) {
    genResult.value = res.data.tokens
    showGenerate.value = false
    showGenResult.value = true
    load()
  }
  else message.error(res.message)
}
async function copyGenResult() {
  try { await navigator.clipboard.writeText(genResultText.value); message.success('已复制') }
  catch { message.warning('复制失败，请手动选择文本复制') }
}

// ── 改类型 ──
const showType = ref(false)
const typeForm = reactive<{ code: string, type: string, boundUserId: number | null }>({ code: '', type: 'jc', boundUserId: null })
function openType(row: TokenRow) {
  typeForm.code = row.code
  typeForm.type = row.type
  typeForm.boundUserId = row.boundTo?.userId ?? null
  showType.value = true
}
async function submitType() {
  saving.value = true
  const res = await api.put(`license-tokens/${encodeURIComponent(typeForm.code)}/type`, { type: typeForm.type })
  saving.value = false
  if (res.code === 0) { message.success(res.message || '已更改'); showType.value = false; load() }
  else message.error(res.message)
}

// ── 删除 ──
function removeToken(row: TokenRow) {
  dialog.warning({
    title: '删除令牌',
    content: `确认删除令牌 ${row.code}？仅未绑定的令牌可删除。`,
    positiveText: '删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const res = await api.del(`license-tokens/${encodeURIComponent(row.code)}`)
      if (res.code === 0) { message.success('已删除'); load() }
      else message.error(res.message)
    },
  })
}

// ── 撤销绑定 ──
function revokeBinding(row: BindingRow) {
  dialog.warning({
    title: '撤销绑定',
    content: `确认撤销用户 ${row.userName}（UserId ${row.userId}）的令牌 ${row.code}？该用户会话将立即失效，令牌可重新分配。`,
    positiveText: '撤销',
    negativeText: '取消',
    onPositiveClick: async () => {
      const res = await api.del(`license-tokens/bindings/${row.userId}`)
      if (res.code === 0) { message.success('已撤销'); load() }
      else message.error(res.message)
    },
  })
}

// ── 撤销绑定并删除令牌（彻底作废）──
function confirmForceRemove(code: string, boundUser?: { userName: string, userId: number } | null) {
  dialog.warning({
    title: '撤销绑定并删除令牌',
    content: boundUser
      ? `令牌 ${code} 已绑定用户 ${boundUser.userName}（UserId ${boundUser.userId}）。确认撤销其绑定并彻底删除该令牌？该用户会话将立即失效，令牌不可恢复。`
      : `确认彻底删除令牌 ${code}？不可恢复。`,
    positiveText: '撤销并删除',
    negativeText: '取消',
    onPositiveClick: async () => {
      const res = await api.del(`license-tokens/${encodeURIComponent(code)}/force`)
      if (res.code === 0) { message.success(res.message || '已撤销并删除'); load() }
      else message.error(res.message)
    },
  })
}

const tokenColumns = [
  { title: '令牌码', key: 'code', width: 160 },
  { title: '类型', key: 'type', width: 120, render: (r: TokenRow) => typeTag(r.type) },
  {
    title: '绑定用户',
    key: 'boundTo',
    render: (r: TokenRow) => r.boundTo
      ? h(NTag, { type: 'success', size: 'small' }, { default: () => `${r.boundTo!.userName} (#${r.boundTo!.userId})` })
      : h(NTag, { type: 'warning', size: 'small' }, { default: () => '未绑定' }),
  },
  { title: '激活时间', key: 'activatedAt', width: 180, render: (r: TokenRow) => fmtDateTime(r.boundTo?.activatedAt) },
  {
    title: '操作',
    key: 'actions',
    width: 200,
    render: (r: TokenRow) => h(NSpace, { size: 'small' }, {
      default: () => [
        can(P.tokenManage) ? h(NButton, { size: 'small', onClick: () => openType(r) }, { default: () => '改类型' }) : null,
        can(P.tokenManage)
          ? (r.boundTo
              ? h(NButton, { size: 'small', type: 'error', onClick: () => confirmForceRemove(r.code, r.boundTo) }, { default: () => '撤销并删除' })
              : h(NButton, { size: 'small', type: 'error', onClick: () => removeToken(r) }, { default: () => '删除' }))
          : null,
      ].filter(Boolean),
    }),
  },
]

const bindingColumns = [
  { title: 'UserId', key: 'userId', width: 100 },
  { title: '用户名', key: 'userName' },
  { title: '令牌码', key: 'code', width: 160 },
  { title: '类型', key: 'type', width: 120, render: (r: BindingRow) => typeTag(r.type) },
  { title: '激活时间', key: 'activatedAt', width: 180, render: (r: BindingRow) => fmtDateTime(r.activatedAt) },
  {
    title: '操作',
    key: 'actions',
    width: 220,
    render: (r: BindingRow) => can(P.tokenManage)
      ? h(NSpace, { size: 'small' }, {
          default: () => [
            h(NButton, { size: 'small', onClick: () => revokeBinding(r) }, { default: () => '撤销绑定' }),
            h(NButton, { size: 'small', type: 'error', onClick: () => confirmForceRemove(r.code, { userName: r.userName, userId: r.userId }) }, { default: () => '撤销并删除' }),
          ],
        })
      : null,
  },
]

onMounted(load)
</script>
