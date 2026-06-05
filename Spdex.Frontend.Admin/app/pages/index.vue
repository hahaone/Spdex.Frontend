<template>
  <div>
    <h2 class="mb-4 text-xl font-semibold">工作台</h2>
    <NGrid :cols="3" :x-gap="16" :y-gap="16">
      <NGi>
        <NCard title="当前账号" size="small">
          <div class="text-base">{{ admin?.displayName }}</div>
          <div class="text-sm text-gray-500">{{ admin?.roleName }} · {{ admin?.userName }}</div>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="我的权限" size="small">
          <div class="text-sm text-gray-500">{{ admin?.permissions?.length || 0 }} 项权限点</div>
        </NCard>
      </NGi>
      <NGi>
        <NCard title="快捷入口" size="small">
          <NSpace>
            <NButton v-if="can(P.userView)" size="small" @click="navigateTo('/users')">用户管理</NButton>
            <NButton v-if="can(P.silkView)" size="small" @click="navigateTo('/silkbag')">锦囊账本</NButton>
          </NSpace>
        </NCard>
      </NGi>
    </NGrid>

    <NAlert type="info" class="mt-6" title="第一版范围">
      用户会籍 + 锦囊账本 + 审计日志。订单/退款、套餐与信号去配置化在后续迭代上线。
    </NAlert>
  </div>
</template>

<script setup lang="ts">
import { P } from '~/utils/permissions'

const { admin } = useAuth()
const { can } = usePermission()
</script>
