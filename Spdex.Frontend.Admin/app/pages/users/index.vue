<template>
  <div>
    <h2 class="mb-4 text-xl font-semibold">用户管理</h2>

    <NSpace class="mb-4">
      <NInput
        v-model:value="keyword"
        placeholder="用户名 / 手机 / 邮箱 / UserId"
        style="width:260px"
        clearable
        @keyup.enter="reload"
      />
      <NButton type="primary" @click="reload">搜索</NButton>
    </NSpace>

    <NDataTable
      remote
      :columns="columns"
      :data="rows"
      :loading="loading"
      :pagination="pagination"
      @update:page="onPage"
    />

    <NModal v-model:show="showMembership" preset="card" title="修改会籍" style="width:440px">
      <NForm label-placement="left" label-width="96">
        <NFormItem label="目标会籍">
          <NSelect v-model:value="mForm.roleId" :options="roleOptions" />
        </NFormItem>
        <NFormItem label="开通天数">
          <NInputNumber v-model:value="mForm.days" :min="1" style="width:100%" placeholder="按天数走折算算法" />
        </NFormItem>
        <NFormItem label="或设到期日">
          <NDatePicker v-model:value="mForm.endDate" type="date" clearable style="width:100%" />
        </NFormItem>
        <div class="text-xs text-gray-400">填到期日则直接覆盖；否则按天数走与支付链路一致的折算算法。</div>
      </NForm>
      <template #footer>
        <NButton type="primary" :loading="saving" @click="submitMembership">确定</NButton>
      </template>
    </NModal>

    <NModal v-model:show="showPwd" preset="card" title="重置密码" style="width:380px">
      <NInput v-model:value="pwdValue" type="password" show-password-on="click" placeholder="新密码（≥6 位）" />
      <template #footer>
        <NButton type="primary" :loading="saving" @click="submitPwd">确定</NButton>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NSpace, NTag, useMessage, useDialog } from 'naive-ui'
import { P } from '~/utils/permissions'

interface MemberItem {
  userId: number
  userName: string
  roleId: number
  roleName: string
  tier: string
  endDate?: string | null
  enabled: boolean
  mobile?: string | null
  lastActivityDate?: string | null
  registerDate?: string | null
}

const api = useAdminApi()
const message = useMessage()
const dialog = useDialog()
const { can } = usePermission()

// 记住翻页/搜索状态:点「详情」(navigateTo('/users/:id'))再返回('/users')后仍回到原页与搜索词。
// useState 跨客户端导航存活(Admin 为 SPA,客户端状态不丢)。
const keyword = useState('admin-users-keyword', () => '')
const savedPage = useState('admin-users-page', () => 1)
const rows = ref<MemberItem[]>([])
const loading = ref(false)
const saving = ref(false)
const pagination = reactive({ page: savedPage.value, pageSize: 20, itemCount: 0 })

const roleOptions = [
  { label: '免费 (2)', value: 2 },
  { label: '专家 (4)', value: 4 },
  { label: '黄金 (10)', value: 10 },
  { label: '翡翠 (11)', value: 11 },
  { label: '红宝石 (12)', value: 12 },
  { label: '白金 (5)', value: 5 },
]

async function load() {
  loading.value = true
  const res = await api.get<{ items: MemberItem[], total: number }>('users', {
    keyword: keyword.value || undefined,
    page: pagination.page,
    pageSize: pagination.pageSize,
  })
  loading.value = false
  if (res.code === 0 && res.data) {
    rows.value = res.data.items
    pagination.itemCount = res.data.total
  }
  else { message.error(res.message) }
}

function reload() { pagination.page = 1; savedPage.value = 1; load() }
function onPage(p: number) { pagination.page = p; savedPage.value = p; load() }

const showMembership = ref(false)
const mForm = reactive<{ userId: number, roleId: number, days: number | null, endDate: number | null }>({
  userId: 0, roleId: 4, days: 31, endDate: null,
})
function openMembership(row: MemberItem) {
  mForm.userId = row.userId
  mForm.roleId = row.roleId || 4
  mForm.days = 31
  mForm.endDate = null
  showMembership.value = true
}
async function submitMembership() {
  saving.value = true
  const body: Record<string, unknown> = { roleId: mForm.roleId }
  if (mForm.endDate) body.endDate = new Date(mForm.endDate).toISOString()
  else body.days = mForm.days
  const res = await api.put(`users/${mForm.userId}/membership`, body)
  saving.value = false
  if (res.code === 0) { message.success('已更新会籍'); showMembership.value = false; load() }
  else { message.error(res.message) }
}

function toggleStatus(row: MemberItem) {
  const target = !row.enabled
  dialog.warning({
    title: target ? '启用账号' : '禁用账号',
    content: `确认${target ? '启用' : '禁用'}用户 ${row.userName}（UserId ${row.userId}）？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      const res = await api.put(`users/${row.userId}/status`, { enabled: target })
      if (res.code === 0) { message.success('已更新'); load() }
      else { message.error(res.message) }
    },
  })
}

const showPwd = ref(false)
const pwdValue = ref('')
const pwdUserId = ref(0)
function openPwd(row: MemberItem) { pwdUserId.value = row.userId; pwdValue.value = ''; showPwd.value = true }
async function submitPwd() {
  if (pwdValue.value.length < 6) { message.warning('密码至少 6 位'); return }
  saving.value = true
  const res = await api.post(`users/${pwdUserId.value}/reset-password`, { newPassword: pwdValue.value })
  saving.value = false
  if (res.code === 0) { message.success('已重置（该用户当前会话已失效）'); showPwd.value = false }
  else { message.error(res.message) }
}

function fmtDate(d?: string | null) { return d ? d.substring(0, 10) : '—' }
function fmtDateTime(d?: string | null) { return d ? d.substring(0, 16).replace('T', ' ') : '—' }

const columns = [
  { title: 'UserId', key: 'userId', width: 90 },
  { title: '用户名', key: 'userName' },
  {
    title: '会籍',
    key: 'tier',
    render: (r: MemberItem) => h(NTag, { type: 'info', size: 'small' }, { default: () => `${r.tier} (${r.roleId})` }),
  },
  { title: '到期', key: 'endDate', render: (r: MemberItem) => fmtDate(r.endDate) },
  { title: '注册时间', key: 'registerDate', width: 150, render: (r: MemberItem) => fmtDateTime(r.registerDate) },
  {
    title: '状态',
    key: 'enabled',
    render: (r: MemberItem) => h(NTag, { type: r.enabled ? 'success' : 'error', size: 'small' }, { default: () => (r.enabled ? '启用' : '禁用') }),
  },
  { title: '手机', key: 'mobile', render: (r: MemberItem) => r.mobile || '—' },
  {
    title: '操作',
    key: 'actions',
    width: 280,
    render: (r: MemberItem) => h(NSpace, { size: 'small' }, {
      default: () => [
        h(NButton, { size: 'small', onClick: () => navigateTo(`/users/${r.userId}`) }, { default: () => '详情' }),
        can(P.userMembershipEdit) ? h(NButton, { size: 'small', onClick: () => openMembership(r) }, { default: () => '改会籍' }) : null,
        can(P.userStatusEdit) ? h(NButton, { size: 'small', type: r.enabled ? 'error' : 'success', onClick: () => toggleStatus(r) }, { default: () => (r.enabled ? '禁用' : '启用') }) : null,
        can(P.userPasswordReset) ? h(NButton, { size: 'small', onClick: () => openPwd(r) }, { default: () => '重置密码' }) : null,
      ].filter(Boolean),
    }),
  },
]

onMounted(load)
</script>
