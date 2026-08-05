<script setup lang="ts">
import { Check, ChevronLeft, CircleHelp, Clipboard, KeyRound, Link2, Plus, RefreshCw, ShieldAlert, ShieldCheck, Trash2, X } from '@lucide/vue'

interface AiCredential {
  id: string
  name: string
  scopes: string[]
  tokenPrefix: string
  status: string
  createdAt: string
  expiresAt: string
  lastUsedAt?: string | null
  lastSourceIp?: string | null
  callCount: number
}

interface AiCredentialIssue {
  credential: AiCredential
  accessToken: string
  tokenType: string
}

interface OAuthGrant {
  id: string
  clientId: string
  clientName: string
  scopes: string[]
  status: string
  createdAt: string
  updatedAt: string
  lastUsedAt?: string | null
}

const scopeOptions = [
  { value: 'matches.search', label: '赛事搜索' },
  { value: 'matches.snapshot', label: '单场快照' },
  { value: 'markets.series', label: '盘口走势' },
  { value: 'markets.anomalies', label: '异常检测' },
  { value: 'metrics.explain', label: '指标解释' },
]

const connections = ref<AiCredential[]>([])
const grants = ref<OAuthGrant[]>([])
const config = useRuntimeConfig()
const helpCenterUrl = computed(() => String(config.public.helpCenterUrl || 'https://help-test.spdex.com').replace(/\/$/, ''))
const mcpHelpUrl = computed(() => `${helpCenterUrl.value}/ai/mcp-quickstart`)
const usageHelpUrl = computed(() => `${helpCenterUrl.value}/ai/ai-mcp-usage-quota`)
const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const copied = ref(false)
const issuedToken = ref('')
const issuedName = ref('')
const showCreate = ref(false)
const form = reactive({
  name: 'WorkBuddy',
  ttlDays: 30,
  scopes: scopeOptions.map(item => item.value),
})

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const [credentialData, grantData] = await Promise.all([
      $apiFetch<AiCredential[]>('/api/newspdex/ai/mcp/connections'),
      $apiFetch<OAuthGrant[]>('/api/newspdex/ai/oauth/grants'),
    ])
    connections.value = credentialData
    grants.value = grantData
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string, error_description?: string } }
    errorMessage.value = fetchError.data?.message || fetchError.data?.error_description || 'AI 连接信息加载失败'
  }
  finally {
    loading.value = false
  }
}

async function createConnection() {
  if (!form.name.trim() || !form.scopes.length) return
  saving.value = true
  errorMessage.value = ''
  try {
    const issue = await $apiFetch<AiCredentialIssue>('/api/newspdex/ai/mcp/connections', {
      method: 'POST',
      body: {
        name: form.name.trim(),
        ttlDays: form.ttlDays,
        scopes: form.scopes,
      },
    })
    showIssued(issue)
    showCreate.value = false
    await load()
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string } }
    errorMessage.value = fetchError.data?.message || '创建连接失败'
  }
  finally {
    saving.value = false
  }
}

async function rotateConnection(connection: AiCredential) {
  if (!confirm(`轮换“${connection.name}”后，旧 token 会立即失效。继续吗？`)) return
  try {
    const issue = await $apiFetch<AiCredentialIssue>(`/api/newspdex/ai/mcp/connections/${connection.id}/rotate`, {
      method: 'POST',
      body: { ttlDays: 30 },
    })
    showIssued(issue)
    await load()
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string } }
    errorMessage.value = fetchError.data?.message || '轮换连接失败'
  }
}

async function revokeConnection(connection: AiCredential) {
  if (!confirm(`撤销“${connection.name}”？此操作会立即断开对应客户端。`)) return
  await $apiFetch(`/api/newspdex/ai/mcp/connections/${connection.id}`, { method: 'DELETE' })
  await load()
}

async function revokeGrant(grant: OAuthGrant) {
  if (!confirm(`撤销 ${grant.clientName} 的 OAuth 授权？`)) return
  await $apiFetch(`/api/newspdex/ai/oauth/grants/${grant.id}`, { method: 'DELETE' })
  await load()
}

function showIssued(issue: AiCredentialIssue) {
  issuedToken.value = issue.accessToken
  issuedName.value = issue.credential.name
  copied.value = false
}

async function copyToken() {
  await navigator.clipboard.writeText(issuedToken.value)
  copied.value = true
}

function formatTime(value?: string | null) {
  if (!value) return '从未使用'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN', { hour12: false })
}

function scopeLabel(scope: string) {
  return scopeOptions.find(item => item.value === scope)?.label || scope
}

onMounted(load)
</script>

<template>
  <section class="mcp-page">
    <header class="page-head">
      <NuxtLink to="/account" class="icon-button focus-ring" aria-label="返回会员中心">
        <ChevronLeft :size="18" />
      </NuxtLink>
      <div>
        <h1>AI 与 MCP 连接</h1>
        <p>管理外部 Agent 和 OAuth 客户端</p>
      </div>
      <div class="head-actions">
        <a class="icon-button focus-ring" :href="mcpHelpUrl" target="_blank" rel="noopener noreferrer" aria-label="打开 MCP 接入帮助">
          <CircleHelp :size="17" />
        </a>
        <button class="icon-button focus-ring" type="button" aria-label="刷新" @click="load">
          <RefreshCw :size="17" />
        </button>
      </div>
    </header>

    <div v-if="errorMessage" class="error-band">{{ errorMessage }}</div>

    <section class="notice-band" aria-label="MCP 使用边界">
      <ShieldAlert :size="16" />
      <div>
        <b>MCP token 只用于授权 SPdex 数据工具。</b>
        <span>不要把 token、Authorization header 或本地配置文件发给聊天模型；外部 Agent 的模型费用由对应平台或你的模型 Key 承担。</span>
      </div>
      <a :href="usageHelpUrl" target="_blank" rel="noopener noreferrer">查看用量与安全边界</a>
    </section>

    <section class="content-band">
      <div class="band-head">
        <span><KeyRound :size="16" /><b>我的 MCP 连接</b></span>
        <button class="primary-action focus-ring" type="button" @click="showCreate = !showCreate">
          <X v-if="showCreate" :size="15" />
          <Plus v-else :size="15" />
          <span>{{ showCreate ? '取消' : '新建' }}</span>
        </button>
      </div>

      <form v-if="showCreate" class="create-form" @submit.prevent="createConnection">
        <label>
          <span>连接名称</span>
          <input v-model="form.name" maxlength="80" autocomplete="off">
        </label>
        <fieldset>
          <legend>有效期</legend>
          <div class="segmented">
            <button type="button" :class="{ active: form.ttlDays === 30 }" @click="form.ttlDays = 30">30 天</button>
            <button type="button" :class="{ active: form.ttlDays === 90 }" @click="form.ttlDays = 90">90 天</button>
          </div>
        </fieldset>
        <fieldset>
          <legend>访问范围</legend>
          <div class="scope-grid">
            <label v-for="scope in scopeOptions" :key="scope.value" class="scope-option">
              <input v-model="form.scopes" type="checkbox" :value="scope.value">
              <span>{{ scope.label }}</span>
            </label>
          </div>
        </fieldset>
        <button class="submit-button focus-ring" type="submit" :disabled="saving || !form.scopes.length">
          <ShieldCheck :size="16" />
          <span>{{ saving ? '创建中' : '创建连接' }}</span>
        </button>
        <p class="form-note">创建后完整 token 只显示一次；建议按客户端单独创建、定期轮换，并在设备丢失或人员变更后立即撤销。</p>
      </form>

      <div v-if="loading" class="empty-state">正在读取连接</div>
      <div v-else-if="connections.length" class="connection-list">
        <article v-for="connection in connections" :key="connection.id" class="connection-row">
          <div class="connection-main">
            <div class="connection-title">
              <b>{{ connection.name }}</b>
              <span :class="['status', connection.status]">{{ connection.status === 'active' ? '有效' : '已停用' }}</span>
            </div>
            <code>{{ connection.tokenPrefix }}</code>
            <div class="scope-list">
              <span v-for="scope in connection.scopes" :key="scope">{{ scopeLabel(scope) }}</span>
            </div>
            <p>
              最近使用：{{ formatTime(connection.lastUsedAt) }}
              <template v-if="connection.lastSourceIp"> · {{ connection.lastSourceIp }}</template>
              · {{ connection.callCount }} 次
            </p>
          </div>
          <div v-if="connection.status === 'active'" class="row-actions">
            <button type="button" class="icon-button focus-ring" aria-label="轮换 token" @click="rotateConnection(connection)">
              <RefreshCw :size="15" />
            </button>
            <button type="button" class="icon-button danger focus-ring" aria-label="撤销连接" @click="revokeConnection(connection)">
              <Trash2 :size="15" />
            </button>
          </div>
        </article>
      </div>
      <div v-else class="empty-state">暂无 MCP 连接</div>
    </section>

    <section class="content-band">
      <div class="band-head">
        <span><Link2 :size="16" /><b>OAuth 授权</b></span>
      </div>
      <div v-if="grants.length" class="connection-list">
        <article v-for="grant in grants" :key="grant.id" class="connection-row">
          <div class="connection-main">
            <div class="connection-title">
              <b>{{ grant.clientName }}</b>
              <span :class="['status', grant.status]">{{ grant.status === 'active' ? '已授权' : '已撤销' }}</span>
            </div>
            <div class="scope-list">
              <span v-for="scope in grant.scopes" :key="scope">{{ scopeLabel(scope) }}</span>
            </div>
            <p>最近使用：{{ formatTime(grant.lastUsedAt) }}</p>
          </div>
          <button
            v-if="grant.status === 'active'"
            type="button"
            class="icon-button danger focus-ring"
            aria-label="撤销 OAuth 授权"
            @click="revokeGrant(grant)"
          >
            <Trash2 :size="15" />
          </button>
        </article>
      </div>
      <div v-else class="empty-state">暂无 OAuth 授权</div>
    </section>

    <div v-if="issuedToken" class="token-overlay" role="dialog" aria-modal="true" aria-labelledby="token-title">
      <section class="token-dialog">
        <div class="token-head">
          <div>
            <h2 id="token-title">{{ issuedName }}</h2>
            <p>完整 token 仅显示这一次</p>
          </div>
          <button type="button" class="icon-button focus-ring" aria-label="关闭" @click="issuedToken = ''">
            <X :size="17" />
          </button>
        </div>
        <div class="token-warning">
          <ShieldAlert :size="16" />
          <span>复制后只放入受信任客户端的 Header 或 OAuth 配置，不要粘贴到公开对话、截图、工单或文档中。</span>
        </div>
        <code class="issued-token">{{ issuedToken }}</code>
        <button class="submit-button focus-ring" type="button" @click="copyToken">
          <Check v-if="copied" :size="16" />
          <Clipboard v-else :size="16" />
          <span>{{ copied ? '已复制' : '复制 token' }}</span>
        </button>
      </section>
    </div>
  </section>
</template>

<style scoped>
.mcp-page { display: grid; gap: 10px; padding: 12px 12px 18px; }
.page-head { display: grid; grid-template-columns: 34px minmax(0, 1fr) auto; gap: 9px; align-items: center; }
.page-head h1, .token-head h2 { margin: 0; color: var(--ink); font-size: 1rem; letter-spacing: 0; }
.page-head p, .token-head p { margin: 2px 0 0; color: var(--muted); font-size: .72rem; }
.head-actions { display: flex; justify-content: flex-end; gap: 6px; }
.icon-button { display: inline-grid; width: 34px; height: 34px; place-items: center; border: 1px solid var(--line); border-radius: 5px; background: var(--panel); color: var(--ink); }
.icon-button.danger { color: #b42318; }
.error-band { padding: 9px 11px; border: 1px solid #f4b5af; border-radius: 5px; background: #fff2f0; color: #9f1c13; font-size: .8rem; }
.notice-band, .token-warning { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; padding: 10px 11px; border: 1px solid #fed7aa; border-radius: 6px; background: #fff7ed; color: #9a3412; font-size: .76rem; line-height: 1.55; }
.notice-band b { display: block; margin-bottom: 2px; color: #7c2d12; }
.notice-band a { grid-column: 2; color: var(--brand); font-weight: 760; text-decoration: none; }
.form-note { margin: 0; color: var(--muted); font-size: .72rem; line-height: 1.55; }
.content-band { display: grid; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); overflow: hidden; }
.band-head { display: flex; min-height: 44px; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 10px; border-bottom: 1px solid var(--divider); }
.band-head > span { display: inline-flex; align-items: center; gap: 7px; color: var(--ink); font-size: .84rem; }
.primary-action, .submit-button { display: inline-flex; align-items: center; justify-content: center; gap: 5px; min-height: 32px; padding: 6px 10px; border: 0; border-radius: 5px; background: var(--brand); color: #fff; font-size: .78rem; font-weight: 780; }
.create-form { display: grid; gap: 12px; padding: 12px; border-bottom: 1px solid var(--divider); background: var(--canvas); }
.create-form > label { display: grid; gap: 5px; color: var(--muted); font-size: .74rem; font-weight: 700; }
.create-form input[type="text"], .create-form input:not([type]) { min-height: 36px; padding: 7px 9px; border: 1px solid var(--line); border-radius: 4px; background: var(--panel); color: var(--ink); }
fieldset { display: grid; gap: 7px; margin: 0; padding: 0; border: 0; }
legend { margin-bottom: 6px; color: var(--muted); font-size: .74rem; font-weight: 700; }
.segmented { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); width: min(240px, 100%); border: 1px solid var(--line); border-radius: 5px; overflow: hidden; }
.segmented button { min-height: 34px; border: 0; border-right: 1px solid var(--line); background: var(--panel); color: var(--muted); }
.segmented button:last-child { border-right: 0; }
.segmented button.active { background: var(--brand); color: #fff; font-weight: 760; }
.scope-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 6px 10px; }
.scope-option { display: flex; align-items: center; gap: 6px; min-width: 0; color: var(--ink); font-size: .77rem; }
.scope-option input { accent-color: var(--brand); }
.connection-list { display: grid; }
.connection-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 10px; padding: 11px; border-bottom: 1px solid var(--divider); }
.connection-row:last-child { border-bottom: 0; }
.connection-main { display: grid; gap: 6px; min-width: 0; }
.connection-title { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.connection-title b { color: var(--ink); font-size: .86rem; }
.status { padding: 2px 5px; border-radius: 3px; background: #eef0f4; color: var(--muted); font-size: .62rem; font-weight: 760; }
.status.active { background: #e8f7ed; color: #18763b; }
.connection-main code, .issued-token { overflow-wrap: anywhere; color: var(--muted); font-size: .7rem; }
.scope-list { display: flex; flex-wrap: wrap; gap: 4px; }
.scope-list span { padding: 2px 5px; border: 1px solid var(--divider); border-radius: 3px; color: var(--muted); font-size: .64rem; }
.connection-main p { margin: 0; color: var(--muted); font-size: .68rem; }
.row-actions { display: flex; gap: 6px; align-items: start; }
.empty-state { padding: 22px 12px; color: var(--muted); font-size: .78rem; text-align: center; }
.token-overlay { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 16px; background: rgba(15, 22, 35, .58); }
.token-dialog { display: grid; gap: 14px; width: min(100%, 560px); padding: 16px; border-radius: 7px; background: var(--panel); box-shadow: 0 18px 50px rgba(0, 0, 0, .25); }
.token-head { display: flex; align-items: start; justify-content: space-between; gap: 10px; }
.token-warning { background: #fff7ed; }
.issued-token { display: block; max-height: 150px; overflow: auto; padding: 11px; border: 1px solid var(--line); border-radius: 4px; background: var(--canvas); color: var(--ink); }
@media (min-width: 760px) {
  .mcp-page { width: min(920px, 100%); margin: 0 auto; padding: 18px 20px 28px; }
  .scope-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>
