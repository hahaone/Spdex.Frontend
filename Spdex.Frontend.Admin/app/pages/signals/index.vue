<template>
  <div>
    <h2 class="mb-4 text-xl font-semibold">信号引擎</h2>
    <NTabs type="line" default-value="rules" @update:value="onTab">
      <NTabPane name="rules" tab="规则配置">
        <NSpace v-if="can(P.signalConfig)" class="mb-3">
          <NButton @click="importConfig">从配置导入</NButton>
          <NButton type="primary" @click="openRule(null)">新建规则</NButton>
        </NSpace>
        <NDataTable :columns="ruleCols" :data="rules" :loading="loading" size="small" />
      </NTabPane>
      <NTabPane name="records" tab="信号记录">
        <NDataTable :columns="recordCols" :data="records" :loading="loading" size="small" :pagination="{ pageSize: 15 }" />
      </NTabPane>
      <NTabPane name="stats" tab="统计">
        <NDataTable :columns="statCols" :data="stats" :loading="loading" size="small" />
      </NTabPane>
    </NTabs>

    <NModal v-model:show="showRule" preset="card" :title="ruleEditing ? '编辑规则' : '新建规则'" style="width:680px">
      <NForm label-placement="left" label-width="80">
        <NFormItem label="RuleId"><NInput v-model:value="ruleForm.ruleId" :disabled="ruleEditing" placeholder="first-half-goal" /></NFormItem>
        <NFormItem label="名称"><NInput v-model:value="ruleForm.modelName" /></NFormItem>
        <NFormItem label="启用"><NSwitch v-model:value="ruleForm.enabled" /></NFormItem>
        <NFormItem label="规则 JSON"><NInput v-model:value="ruleForm.configJson" type="textarea" :rows="14" /></NFormItem>
        <div class="text-xs text-gray-400">须为合法 SignalModelConfig（含 Conditions/WaitCondition/ReversalCheck）。保存后 ≤60s 热加载生效，无需重启。</div>
      </NForm>
      <template #footer><NButton type="primary" :loading="saving" @click="saveRule">保存</NButton></template>
    </NModal>
  </div>
</template>

<script setup lang="ts">
import { h } from 'vue'
import { NButton, NSpace, useMessage, useDialog } from 'naive-ui'
import { P } from '~/utils/permissions'
/* eslint-disable @typescript-eslint/no-explicit-any */

const api = useAdminApi()
const message = useMessage()
const dialog = useDialog()
const { can } = usePermission()

const rules = ref<any[]>([])
const records = ref<any[]>([])
const stats = ref<any[]>([])
const loading = ref(false)
const saving = ref(false)

async function loadRules() { loading.value = true; const r = await api.get<any[]>('signals/rules'); loading.value = false; rules.value = r.code === 0 && r.data ? r.data : [] }
async function loadRecords() { loading.value = true; const r = await api.get<any>('signals/records', { pageSize: 50 }); loading.value = false; records.value = r.code === 0 && r.data ? r.data.items : [] }
async function loadStats() { loading.value = true; const r = await api.get<any[]>('signals/stats'); loading.value = false; stats.value = r.code === 0 && r.data ? r.data : [] }
function onTab(name: string) { if (name === 'records') loadRecords(); else if (name === 'stats') loadStats() }

async function importConfig() {
  const r = await api.post<any>('signals/rules/import-from-config')
  if (r.code === 0) { message.success(`已导入 ${r.data?.imported ?? 0} 条`); loadRules() } else message.error(r.message)
}

const showRule = ref(false)
const ruleEditing = ref(false)
const ruleForm = reactive<any>({ ruleId: '', modelName: '', enabled: true, configJson: '' })
function openRule(r: any) {
  ruleEditing.value = !!r
  if (r) Object.assign(ruleForm, r)
  else Object.assign(ruleForm, { ruleId: '', modelName: '', enabled: true, configJson: '{\n  "Id": "",\n  "Name": "",\n  "Enabled": true,\n  "MarketIdField": "MarketId6",\n  "Factor": "Over",\n  "ExcludeHandicaps": [],\n  "Conditions": []\n}' })
  showRule.value = true
}
async function saveRule() {
  if (!ruleForm.ruleId || !ruleForm.configJson) { message.warning('RuleId 和 JSON 必填'); return }
  saving.value = true
  const r = await api.post('signals/rules', { ...ruleForm })
  saving.value = false
  if (r.code === 0) { message.success('已保存，≤60s 生效'); showRule.value = false; loadRules() } else message.error(r.message)
}
function toggleRule(r: any) {
  api.put(`signals/rules/${r.ruleId}/enabled`, { enabled: !r.enabled }).then((res) => {
    if (res.code === 0) { message.success('已更新'); loadRules() } else message.error(res.message)
  })
}
function delRule(r: any) {
  dialog.warning({
    title: '删除规则', content: `删除「${r.modelName}」？`, positiveText: '删除', negativeText: '取消',
    onPositiveClick: async () => { const res = await api.del(`signals/rules/${r.ruleId}`); if (res.code === 0) { message.success('已删除'); loadRules() } else message.error(res.message) },
  })
}

function fmt(d?: string) { return d ? d.replace('T', ' ').substring(0, 19) : '—' }

const ruleCols = [
  { title: 'RuleId', key: 'ruleId' },
  { title: '名称', key: 'modelName' },
  { title: '启用', key: 'enabled', render: (r: any) => (r.enabled ? '✓' : '停用') },
  { title: '更新', key: 'updatedAt', width: 160, render: (r: any) => fmt(r.updatedAt) },
  {
    title: '操作', key: 'a', width: 200,
    render: (r: any) => (can(P.signalConfig)
      ? h(NSpace, { size: 'small' }, {
          default: () => [
            h(NButton, { size: 'small', onClick: () => openRule(r) }, { default: () => '编辑' }),
            h(NButton, { size: 'small', onClick: () => toggleRule(r) }, { default: () => (r.enabled ? '停用' : '启用') }),
            h(NButton, { size: 'small', type: 'error', onClick: () => delRule(r) }, { default: () => '删' }),
          ],
        })
      : ''),
  },
]
const recordCols = [
  { title: '信号', key: 'signalId', ellipsis: { tooltip: true }, width: 120 },
  { title: '模型', key: 'modelName' },
  { title: '赛事', key: 'eventId', width: 90 },
  { title: '主队', key: 'homeTeam' },
  { title: '客队', key: 'guestTeam' },
  { title: '状态', key: 'status', width: 100 },
  { title: '触发', key: 'triggeredAt', width: 150, render: (r: any) => fmt(r.triggeredAt) },
]
const statCols = [
  { title: '模型', key: 'modelName' },
  { title: '触发场次', key: 'totalTriggered' },
  { title: '已执行', key: 'totalExecuted' },
  { title: '执行率', key: 'executionRate', render: (r: any) => `${r.executionRate}%` },
  { title: '活跃', key: 'totalActive' },
  { title: '过期', key: 'totalExpired' },
]

onMounted(loadRules)
</script>
