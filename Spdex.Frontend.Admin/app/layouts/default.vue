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
  </NLayout>
</template>

<script setup lang="ts">
import { P } from '~/utils/permissions'

const route = useRoute()
const { admin, logout } = useAuth()
const { can } = usePermission()

const activeKey = computed(() => route.path)

const menuOptions = computed(() => {
  const items: { label: string, key: string }[] = [{ label: '工作台', key: '/' }]
  if (can(P.userView)) items.push({ label: '用户管理', key: '/users' })
  if (can(P.silkView)) items.push({ label: '锦囊账本', key: '/silkbag' })
  if (can(P.systemAuditView)) items.push({ label: '审计日志', key: '/system/audit' })
  if (can(P.systemAdminManage)) items.push({ label: '管理员', key: '/system/admins' })
  return items
})

const userMenu = [{ label: '退出登录', key: 'logout' }]

async function onUserMenu(key: string) {
  if (key === 'logout') await logout()
}
</script>
