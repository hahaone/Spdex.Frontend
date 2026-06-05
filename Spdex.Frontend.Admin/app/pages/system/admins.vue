<template>
  <div>
    <NSpace class="mb-4" justify="space-between">
      <h2 class="text-xl font-semibold">管理员</h2>
      <NButton type="primary" @click="openCreate">新建管理员</NButton>
    </NSpace>

    <NDataTable :columns="columns" :data="rows" :loading="loading" />

    <NModal v-model:show="showCreate" preset="card" title="新建管理员" style="width:460px">
      <NForm label-placement="left" label-width="80">
        <NFormItem label="用户名"><NInput v-model:value="cForm.userName" /></NFormItem>
        <NFormItem label="密码"><NInput v-model:value="cForm.password" type="password" show-password-on="click" placeholder="≥8 位" /></NFormItem>
        <NFormItem label="显示名"><NInput v-model:value="cForm.displayName" /></NFormItem>
        <NFormItem label="角色"><NSelect v-model:value="cForm.roleCode" :options="roleOptions" /></NFormItem>
        <NFormItem label="邮箱"><NInput v-model:value="cForm.email" /></NFormItem>
        <NFormItem label="手机"><NInput v-model:value="cForm.mobile" /></NFormItem>
      </NForm>
      <template #footer>
        <NButton type="primary" :loading="saving" @click="submitCreate">创建</NButton>
      </template>
    </NModal>

    <NModal v-model:show="showRole" preset="card" title="修改角色" style="width:360px">
      <NSelect v-model:value="rForm.roleCode" :options="roleOptions" />
      <template #footer>
        <NButton type="primary" :loading="saving" @click="submitRole">确定</NButton>
      </template>
    </NModal>

    <NModal v-model:show="showPwd" preset="card" title="重置密码" style="width:360px">
      <NInput v-model:value="pwdVal" type="password" show-password-on="click" placeholder="新密码（≥8 位）" />
      <template #footer>
        <NButton type="primary" :loading="saving" @click="submitPwd">确定</NButton>
      </template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NSpace, NTag, useMessage, useDialog } from 'naive-ui'

interface AdminItem {
  adminUserId: number
  userName: string
  displayName: string
  roleCode: string
  roleName: string
  email?: string | null
  mobile?: string | null
  status: number
  lastLoginAt?: string | null
}

const api = useAdminApi()
const message = useMessage()
const dialog = useDialog()

const rows = ref<AdminItem[]>([])
const loading = ref(false)
const saving = ref(false)

const roleOptions = [
  { label: '超级管理员', value: 'super' },
  { label: '运营', value: 'ops' },
  { label: '客服', value: 'support' },
  { label: '财务', value: 'finance' },
  { label: '审计', value: 'auditor' },
]

async function load() {
  loading.value = true
  const res = await api.get<AdminItem[]>('admins')
  loading.value = false
  rows.value = res.code === 0 && res.data ? res.data : []
}

const showCreate = ref(false)
const cForm = reactive({ userName: '', password: '', displayName: '', roleCode: 'support', email: '', mobile: '' })
function openCreate() {
  Object.assign(cForm, { userName: '', password: '', displayName: '', roleCode: 'support', email: '', mobile: '' })
  showCreate.value = true
}
async function submitCreate() {
  if (!cForm.userName || !cForm.password || !cForm.displayName) { message.warning('用户名/密码/显示名必填'); return }
  if (cForm.password.length < 8) { message.warning('密码至少 8 位'); return }
  saving.value = true
  const res = await api.post('admins', { ...cForm, email: cForm.email || null, mobile: cForm.mobile || null })
  saving.value = false
  if (res.code === 0) { message.success('已创建'); showCreate.value = false; load() }
  else { message.error(res.message) }
}

const showRole = ref(false)
const rForm = reactive({ id: 0, roleCode: 'support' })
function openRole(r: AdminItem) { rForm.id = r.adminUserId; rForm.roleCode = r.roleCode; showRole.value = true }
async function submitRole() {
  saving.value = true
  const res = await api.put(`admins/${rForm.id}/role`, { roleCode: rForm.roleCode })
  saving.value = false
  if (res.code === 0) { message.success('已更新角色'); showRole.value = false; load() }
  else { message.error(res.message) }
}

function toggle(r: AdminItem) {
  const target = r.status === 1 ? 0 : 1
  dialog.warning({
    title: target === 1 ? '启用' : '禁用',
    content: `确认${target === 1 ? '启用' : '禁用'}管理员 ${r.userName}？`,
    positiveText: '确定',
    negativeText: '取消',
    onPositiveClick: async () => {
      const res = await api.put(`admins/${r.adminUserId}/status`, { status: target })
      if (res.code === 0) { message.success('已更新'); load() }
      else { message.error(res.message) }
    },
  })
}

const showPwd = ref(false)
const pwdId = ref(0)
const pwdVal = ref('')
function openPwd(r: AdminItem) { pwdId.value = r.adminUserId; pwdVal.value = ''; showPwd.value = true }
async function submitPwd() {
  if (pwdVal.value.length < 8) { message.warning('密码至少 8 位'); return }
  saving.value = true
  const res = await api.put(`admins/${pwdId.value}/password`, { newPassword: pwdVal.value })
  saving.value = false
  if (res.code === 0) { message.success('已重置'); showPwd.value = false }
  else { message.error(res.message) }
}

function fmt(d?: string | null) { return d ? d.replace('T', ' ').substring(0, 19) : '—' }

const columns = [
  { title: '用户名', key: 'userName' },
  { title: '显示名', key: 'displayName' },
  { title: '角色', key: 'roleName', render: (r: AdminItem) => h(NTag, { size: 'small', type: 'info' }, { default: () => r.roleName }) },
  { title: '状态', key: 'status', render: (r: AdminItem) => h(NTag, { size: 'small', type: r.status === 1 ? 'success' : 'error' }, { default: () => (r.status === 1 ? '启用' : '禁用') }) },
  { title: '最后登录', key: 'lastLoginAt', width: 170, render: (r: AdminItem) => fmt(r.lastLoginAt) },
  {
    title: '操作',
    key: 'actions',
    width: 260,
    render: (r: AdminItem) => h(NSpace, { size: 'small' }, {
      default: () => [
        h(NButton, { size: 'small', onClick: () => openRole(r) }, { default: () => '改角色' }),
        h(NButton, { size: 'small', type: r.status === 1 ? 'error' : 'success', onClick: () => toggle(r) }, { default: () => (r.status === 1 ? '禁用' : '启用') }),
        h(NButton, { size: 'small', onClick: () => openPwd(r) }, { default: () => '重置密码' }),
      ],
    }),
  },
]

onMounted(load)
</script>
