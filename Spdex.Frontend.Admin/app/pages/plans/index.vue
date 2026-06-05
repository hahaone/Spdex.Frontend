<template>
  <div>
    <NSpace class="mb-4" justify="space-between">
      <h2 class="text-xl font-semibold">会员套餐定价</h2>
      <NSpace v-if="can(P.planEdit)">
        <NButton @click="importConfig">从配置导入</NButton>
        <NButton type="primary" @click="openPlan(null)">新建套餐</NButton>
      </NSpace>
    </NSpace>

    <NSpin :show="loading">
      <div v-if="plans.length === 0" class="py-8 text-center text-gray-400">
        暂无套餐。点「从配置导入」把现有 appsettings 套餐导入 DB，或「新建套餐」。
      </div>
      <NCard
        v-for="p in plans" :key="p.roleId" size="small" class="mb-3"
        :title="`${p.roleName}（RoleId ${p.roleId}）${p.enabled ? '' : ' [停用]'}`"
      >
        <template #header-extra>
          <NSpace v-if="can(P.planEdit)">
            <NButton size="small" @click="openStage(p.roleId, null)">+ 价格档</NButton>
            <NButton size="small" @click="openPlan(p)">编辑</NButton>
            <NButton size="small" type="error" @click="delPlan(p)">删除</NButton>
          </NSpace>
        </template>
        <div class="mb-2 text-xs text-gray-500">{{ p.roleDescription }} · 排序 {{ p.displayOrder }} {{ p.hot ? '· HOT' : '' }}</div>
        <NDataTable :columns="stageCols" :data="p.stages" size="small" :pagination="false" />
      </NCard>
    </NSpin>

    <NModal v-model:show="showPlan" preset="card" :title="planEditing ? '编辑套餐' : '新建套餐'" style="width:480px">
      <NForm label-placement="left" label-width="90">
        <NFormItem label="RoleId"><NInputNumber v-model:value="planForm.roleId" :disabled="planEditing" style="width:100%" /></NFormItem>
        <NFormItem label="名称"><NInput v-model:value="planForm.roleName" /></NFormItem>
        <NFormItem label="描述"><NInput v-model:value="planForm.roleDescription" /></NFormItem>
        <NFormItem label="折扣文案"><NInput v-model:value="planForm.discountDes" /></NFormItem>
        <NFormItem label="单位"><NInput v-model:value="planForm.unit" placeholder="元/月" /></NFormItem>
        <NFormItem label="排序"><NInputNumber v-model:value="planForm.displayOrder" style="width:100%" /></NFormItem>
        <NFormItem label="HOT"><NSwitch v-model:value="planForm.hotBool" /></NFormItem>
        <NFormItem label="启用"><NSwitch v-model:value="planForm.enabled" /></NFormItem>
      </NForm>
      <template #footer><NButton type="primary" :loading="saving" @click="savePlan">保存</NButton></template>
    </NModal>

    <NModal v-model:show="showStage" preset="card" :title="stageEditing ? '编辑价格档' : '新建价格档'" style="width:420px">
      <NForm label-placement="left" label-width="90">
        <NFormItem label="StageId"><NInputNumber v-model:value="stageForm.stageId" :disabled="stageEditing" style="width:100%" /></NFormItem>
        <NFormItem label="名称"><NInput v-model:value="stageForm.stageName" placeholder="1个月" /></NFormItem>
        <NFormItem label="价格"><NInputNumber v-model:value="stageForm.price" style="width:100%" /></NFormItem>
        <NFormItem label="月数"><NInputNumber v-model:value="stageForm.month" :step="0.5" style="width:100%" /></NFormItem>
        <NFormItem label="天数"><NInputNumber v-model:value="stageForm.days" style="width:100%" /></NFormItem>
        <NFormItem label="启用"><NSwitch v-model:value="stageForm.enabled" /></NFormItem>
      </NForm>
      <template #footer><NButton type="primary" :loading="saving" @click="saveStage">保存</NButton></template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, useMessage, useDialog } from 'naive-ui'
import { P } from '~/utils/permissions'
/* eslint-disable @typescript-eslint/no-explicit-any */

const api = useAdminApi()
const message = useMessage()
const dialog = useDialog()
const { can } = usePermission()

const plans = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)

async function load() {
  loading.value = true
  const res = await api.get<any[]>('plans')
  loading.value = false
  plans.value = res.code === 0 && res.data ? res.data : []
}

async function importConfig() {
  const res = await api.post<any>('plans/import-from-config')
  if (res.code === 0) { message.success(`已导入 ${res.data?.imported ?? 0} 个套餐`); load() }
  else message.error(res.message)
}

const showPlan = ref(false)
const planEditing = ref(false)
const planForm = reactive<any>({ roleId: null, roleName: '', roleDescription: '', discountDes: '', unit: '', displayOrder: 99, hotBool: false, enabled: true })
function openPlan(p: any) {
  planEditing.value = !!p
  if (p) Object.assign(planForm, { ...p, hotBool: p.hot === 1 })
  else Object.assign(planForm, { roleId: null, roleName: '', roleDescription: '', discountDes: '', unit: '', displayOrder: 99, hotBool: false, enabled: true })
  showPlan.value = true
}
async function savePlan() {
  if (!planForm.roleId || !planForm.roleName) { message.warning('RoleId 和名称必填'); return }
  saving.value = true
  const res = await api.post('plans', { ...planForm, hot: planForm.hotBool ? 1 : 0 })
  saving.value = false
  if (res.code === 0) { message.success('已保存'); showPlan.value = false; load() } else message.error(res.message)
}
function delPlan(p: any) {
  dialog.warning({
    title: '删除套餐', content: `删除「${p.roleName}」及其所有价格档？`, positiveText: '删除', negativeText: '取消',
    onPositiveClick: async () => { const res = await api.del(`plans/${p.roleId}`); if (res.code === 0) { message.success('已删除'); load() } else message.error(res.message) },
  })
}

const showStage = ref(false)
const stageEditing = ref(false)
const stageForm = reactive<any>({ stageId: null, roleId: 0, stageName: '', price: 0, month: 1, days: 31, enabled: true })
function openStage(roleId: number, s: any) {
  stageEditing.value = !!s
  if (s) Object.assign(stageForm, s)
  else Object.assign(stageForm, { stageId: null, roleId, stageName: '', price: 0, month: 1, days: 31, enabled: true })
  showStage.value = true
}
async function saveStage() {
  if (!stageForm.stageId) { message.warning('StageId 必填'); return }
  saving.value = true
  const res = await api.post('plans/stages', { ...stageForm })
  saving.value = false
  if (res.code === 0) { message.success('已保存'); showStage.value = false; load() } else message.error(res.message)
}
function delStage(s: any) {
  dialog.warning({
    title: '删除价格档', content: `删除「${s.stageName}」？`, positiveText: '删除', negativeText: '取消',
    onPositiveClick: async () => { const res = await api.del(`plans/stages/${s.stageId}`); if (res.code === 0) { message.success('已删除'); load() } else message.error(res.message) },
  })
}

const stageCols = [
  { title: 'StageId', key: 'stageId', width: 80 },
  { title: '名称', key: 'stageName' },
  { title: '价格', key: 'price', render: (r: any) => `¥${r.price}` },
  { title: '月数', key: 'month' },
  { title: '天数', key: 'days' },
  { title: '启用', key: 'enabled', render: (r: any) => (r.enabled ? '是' : '停用') },
  {
    title: '操作', key: 'a', width: 110,
    render: (r: any) => (can(P.planEdit)
      ? h('div', {}, [
          h(NButton, { size: 'tiny', onClick: () => openStage(r.roleId, r) }, { default: () => '编辑' }),
          h(NButton, { size: 'tiny', type: 'error', style: 'margin-left:4px', onClick: () => delStage(r) }, { default: () => '删' }),
        ])
      : ''),
  },
]

onMounted(load)
</script>
