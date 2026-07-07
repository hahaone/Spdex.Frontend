<template>
  <div>
    <h2 class="mb-4 text-xl font-semibold">工作台</h2>

    <NGrid :cols="5" :x-gap="16" :y-gap="16" item-responsive>
      <NGi span="5 600:1">
        <NCard size="small"><NStatistic label="今日新增用户" :value="ov?.newUsersToday ?? '—'" /></NCard>
      </NGi>
      <NGi span="5 600:1">
        <NCard size="small"><NStatistic label="今日付费笔数" :value="ov?.paidOrdersToday ?? '—'" /></NCard>
      </NGi>
      <NGi span="5 600:1">
        <NCard size="small">
          <NStatistic label="今日付费金额" :value="ov?.paidAmountToday ?? '—'">
            <template #prefix>¥</template>
          </NStatistic>
        </NCard>
      </NGi>
      <NGi span="5 600:1">
        <NCard size="small"><NStatistic label="待处理退款" :value="ov?.pendingRefunds ?? '—'" /></NCard>
      </NGi>
      <NGi span="5 600:1">
        <NCard size="small"><NStatistic label="用户总数" :value="ov?.totalUsers ?? '—'" /></NCard>
      </NGi>
    </NGrid>

    <NCard title="快捷入口" size="small" class="mt-4">
      <NSpace>
        <NButton v-if="can(P.userView)" size="small" @click="navigateTo('/users')">用户管理</NButton>
        <NButton v-if="can(P.membershipCorrectionView)" size="small" @click="navigateTo('/membership-corrections')">会籍纠偏</NButton>
        <NButton v-if="can(P.orderView)" size="small" @click="navigateTo('/orders')">订单管理</NButton>
        <NButton v-if="can(P.orderView)" size="small" @click="navigateTo('/refunds')">退款工单</NButton>
        <NButton v-if="can(P.silkView)" size="small" @click="navigateTo('/silkbag')">锦囊账本</NButton>
      </NSpace>
    </NCard>

    <div class="mt-3 text-sm text-gray-500">
      当前：{{ admin?.displayName }}（{{ admin?.roleName }}） · {{ admin?.permissions?.length || 0 }} 项权限
    </div>
  </div>
</template>

<script setup lang="ts">
import { P } from '~/utils/permissions'
/* eslint-disable @typescript-eslint/no-explicit-any */

const api = useAdminApi()
const { admin } = useAuth()
const { can } = usePermission()
const ov = ref<any>(null)

onMounted(async () => {
  const res = await api.get<any>('dashboard/overview')
  if (res.code === 0) ov.value = res.data
})
</script>
