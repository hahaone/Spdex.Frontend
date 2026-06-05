<template>
  <NLayout has-sider position="absolute">
    <NLayoutSider bordered :width="220" :native-scrollbar="false">
      <div class="px-4 py-4 text-lg font-bold" style="color:#7c5cfa">SPdex 后台</div>
      <NMenu :value="activeKey" :options="menuOptions" @update:value="(k: string) => navigateTo(k)" />
    </NLayoutSider>
    <NLayout>
      <NLayoutHeader
        bordered
        style="height:56px;display:flex;align-items:center;justify-content:space-between;padding:0 24px"
      >
        <span class="text-gray-500">管理后台</span>
        <NDropdown trigger="click" :options="userMenu" @select="onUserMenu">
          <NButton text>{{ admin?.displayName }}（{{ admin?.roleName }}） ▾</NButton>
        </NDropdown>
      </NLayoutHeader>
      <NLayoutContent style="padding:24px" :native-scrollbar="false">
        <slot />
      </NLayoutContent>
    </NLayout>

    <NModal v-model:show="showPwd" preset="card" title="修改密码" style="width:400px">
      <NForm label-placement="left" label-width="80">
        <NFormItem label="原密码">
          <NInput v-model:value="pwdForm.oldPassword" type="password" show-password-on="click" placeholder="当前密码" />
        </NFormItem>
        <NFormItem label="新密码">
          <NInput v-model:value="pwdForm.newPassword" type="password" show-password-on="click" placeholder="至少 8 位" />
        </NFormItem>
        <NFormItem label="确认">
          <NInput v-model:value="pwdForm.confirm" type="password" show-password-on="click" placeholder="再输一次新密码" @keyup.enter="submitPwd" />
        </NFormItem>
      </NForm>
      <template #footer>
        <NButton type="primary" :loading="saving" @click="submitPwd">确定</NButton>
      </template>
    </NModal>
  </NLayout>
</template>

<script setup lang="ts">
import { useMessage } from 'naive-ui'
import { P } from '~/utils/permissions'

const route = useRoute()
const { admin, logout } = useAuth()
const { can } = usePermission()
const api = useAdminApi()
const message = useMessage()

const activeKey = computed(() => route.path)

const menuOptions = computed(() => {
  const items: { label: string, key: string }[] = [{ label: '工作台', key: '/' }]
  if (can(P.userView)) items.push({ label: '用户管理', key: '/users' })
  if (can(P.silkView)) items.push({ label: '锦囊账本', key: '/silkbag' })
  if (can(P.orderView)) items.push({ label: '订单管理', key: '/orders' })
  if (can(P.systemAuditView)) items.push({ label: '审计日志', key: '/system/audit' })
  if (can(P.systemAdminManage)) items.push({ label: '管理员', key: '/system/admins' })
  return items
})

const userMenu = [
  { label: '修改密码', key: 'password' },
  { label: '退出登录', key: 'logout' },
]

const showPwd = ref(false)
const saving = ref(false)
const pwdForm = reactive({ oldPassword: '', newPassword: '', confirm: '' })

async function onUserMenu(key: string) {
  if (key === 'logout') {
    await logout()
  }
  else if (key === 'password') {
    Object.assign(pwdForm, { oldPassword: '', newPassword: '', confirm: '' })
    showPwd.value = true
  }
}

async function submitPwd() {
  if (pwdForm.newPassword.length < 8) { message.warning('新密码至少 8 位'); return }
  if (pwdForm.newPassword !== pwdForm.confirm) { message.warning('两次新密码不一致'); return }
  saving.value = true
  const res = await api.put('admins/me/password', {
    oldPassword: pwdForm.oldPassword,
    newPassword: pwdForm.newPassword,
  })
  saving.value = false
  if (res.code === 0) {
    showPwd.value = false
    message.success('密码已修改，请用新密码重新登录')
    setTimeout(() => { logout() }, 1200) // 后端已失效当前会话，引导重新登录
  }
  else {
    message.error(res.message || '修改失败')
  }
}
</script>
