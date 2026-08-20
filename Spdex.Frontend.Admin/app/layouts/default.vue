<template>
  <NLayout has-sider position="absolute">
    <NLayoutSider class="desktop-sider" bordered :width="220" :native-scrollbar="false">
      <div class="px-4 py-4 text-lg font-bold" style="color:#7c5cfa">SPdex 后台</div>
      <NMenu :value="activeKey" :options="menuOptions" @update:value="(k: string) => navigateTo(k)" />
    </NLayoutSider>
    <NLayout>
      <NLayoutHeader
        class="admin-header"
        bordered
      >
        <div class="flex items-center gap-2">
          <NTooltip>
            <template #trigger>
              <NButton class="mobile-menu-button" quaternary circle @click="showMobileMenu = true">
                <template #icon><NIcon><MenuIcon /></NIcon></template>
              </NButton>
            </template>
            打开导航
          </NTooltip>
          <span class="text-gray-500">管理后台</span>
        </div>
        <NDropdown trigger="click" :options="userMenu" @select="onUserMenu">
          <NButton text>
            <span>{{ admin?.displayName }}</span>
            <span class="admin-role">（{{ admin?.roleName }}）</span>
            <span> ▾</span>
          </NButton>
        </NDropdown>
      </NLayoutHeader>
      <NLayoutContent class="admin-content" :native-scrollbar="false">
        <slot />
      </NLayoutContent>
    </NLayout>

    <NDrawer v-model:show="showMobileMenu" placement="left" :width="260">
      <NDrawerContent body-content-style="padding:0">
        <div class="px-4 py-4 text-lg font-bold" style="color:#7c5cfa">SPdex 后台</div>
        <NMenu :value="activeKey" :options="menuOptions" @update:value="onMobileNavigate" />
      </NDrawerContent>
    </NDrawer>

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
import { h } from 'vue'
import { BookOpenCheck, Bot, Building2, ChartNoAxesCombined, KeyRound, Menu as MenuIcon, Workflow } from '@lucide/vue'
import { NIcon, useMessage, type MenuOption } from 'naive-ui'
import { P } from '~/utils/permissions'

const route = useRoute()
const { admin, logout } = useAuth()
const { can, canAny } = usePermission()
const api = useAdminApi()
const message = useMessage()

const activeKey = computed(() => route.path)
const showMobileMenu = ref(false)

function icon(component: typeof Bot) {
  return () => h(NIcon, null, { default: () => h(component) })
}

const menuOptions = computed(() => {
  const items: MenuOption[] = [{ label: '工作台', key: '/' }]
  if (can(P.userView)) items.push({ label: '用户管理', key: '/users' })
  if (can(P.membershipCorrectionView)) items.push({ label: '会籍纠偏', key: '/membership-corrections' })
  if (can(P.tokenView)) items.push({ label: '用户令牌', key: '/tokens' })
  if (can(P.silkView)) items.push({ label: '锦囊账本', key: '/silkbag' })
  if (can(P.orderView)) items.push({ label: '订单管理', key: '/orders' })
  if (can(P.orderView)) items.push({ label: '退款工单', key: '/refunds' })
  if (can(P.orderReconcile)) items.push({ label: '对账', key: '/reconcile' })
  if (can(P.planView)) items.push({ label: '套餐定价', key: '/plans' })
  if (can(P.signalView)) items.push({ label: '信号引擎', key: '/signals' })
  if (can(P.analyticsView)) items.push({ label: '访问统计', key: '/analytics' })
  const aiChildren: MenuOption[] = []
  if (can(P.aiOpsView)) aiChildren.push({ label: '运行总览', key: '/ai', icon: icon(Bot) })
  if (can(P.aiOpsView)) aiChildren.push({ label: '业务意图字典', key: '/ai/intents', icon: icon(BookOpenCheck) })
  if (can(P.aiAuditView)) aiChildren.push({ label: 'Agent 自动化', key: '/ai/automation', icon: icon(Workflow) })
  if (can(P.aiOrganizationView)) aiChildren.push({ label: '企业与合同', key: '/ai/organizations', icon: icon(Building2) })
  if (can(P.aiCredentialView)) aiChildren.push({ label: '接入凭据', key: '/ai/credentials', icon: icon(KeyRound) })
  if (canAny(P.aiUsageView, P.aiAuditView)) {
    aiChildren.push({ label: '用量与审计', key: '/ai/usage', icon: icon(ChartNoAxesCombined) })
  }
  if (aiChildren.length) {
    items.push({
      label: 'SPdex AI / MCP',
      key: 'ai-mcp',
      type: 'group',
      children: aiChildren,
    })
  }
  if (can(P.systemAdminManage)) items.push({ label: 'NewSpdex 防刷', key: '/system/newspdex-security' })
  if (can(P.systemAuditView)) items.push({ label: '审计日志', key: '/system/audit' })
  if (can(P.systemAdminManage)) items.push({ label: '管理员', key: '/system/admins' })
  return items
})

const userMenu = [
  { label: '修改密码', key: 'password' },
  { label: '退出登录', key: 'logout' },
]

function onMobileNavigate(path: string) {
  showMobileMenu.value = false
  navigateTo(path)
}

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

<style scoped>
.admin-header {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
}

.admin-content {
  padding: 24px;
}

.mobile-menu-button {
  display: none;
}

@media (max-width: 760px) {
  .desktop-sider {
    display: none;
  }

  .admin-header {
    padding: 0 12px;
  }

  .admin-content {
    padding: 16px 12px;
  }

  .mobile-menu-button {
    display: inline-flex;
  }

  .admin-role {
    display: none;
  }
}
</style>
