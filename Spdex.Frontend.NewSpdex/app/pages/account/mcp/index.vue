<script setup lang="ts">
import { Check, ChevronDown, ChevronLeft, ChevronUp, CircleHelp, Clipboard, KeyRound, Link2, Plus, RefreshCw, ShieldAlert, ShieldCheck, Trash2, X } from '@lucide/vue'

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

interface ScopeOption {
  value: string
  label: string
  description: string
}

interface ScopeGroup {
  key: string
  label: string
  description: string
  scopes: ScopeOption[]
}

const scopeGroups: ScopeGroup[] = [
  {
    key: 'match',
    label: '赛事与基础市场',
    description: '定位比赛、读取快照、盘口走势、异常与指标口径。',
    scopes: [
      { value: 'matches.search', label: '赛事发现', description: '搜索比赛和读取重点赛事排行。' },
      { value: 'matches.snapshot', label: '比赛快照', description: '读取单场快照和市场能力。' },
      { value: 'markets.series', label: '盘口走势', description: '读取价格、成交量和指标时间序列。' },
      { value: 'markets.anomalies', label: '异常检测', description: '检测盘口、成交与市场结构异常。' },
      { value: 'metrics.explain', label: '指标解释', description: '解释必发、Poly 与分析指标。' },
    ],
  },
  {
    key: 'advanced',
    label: '交易与 FJCX 高级分析',
    description: '覆盖 Hold、大额交易、提炼、共振与窗口比较。',
    scopes: [
      { value: 'markets.trades', label: '交易与 Hold', description: '读取成交流、大额交易、深度和 Hold 窗口。' },
      { value: 'analytics.window_compare', label: '窗口比较', description: '比较不同时间窗口的市场变化。' },
      { value: 'analytics.extraction', label: 'FJCX 提炼', description: '读取挂牌与指数提炼信号。' },
      { value: 'analytics.resonance', label: '跨市场共振', description: '识别标盘、亚盘与进球市场共振。' },
      { value: 'external.prediction', label: '预测市场', description: '读取外部预测市场并与 SPdex 对照。' },
      { value: 'live.monitor', label: '赛中监测', description: '读取赛中市场监测结果。' },
      { value: 'signals.read', label: '交易信号', description: '读取并解释系统信号。' },
    ],
  },
  {
    key: 'workflow',
    label: '工作流与报告',
    description: '让 Agent 规划和运行多步骤分析，并生成结构化简报。',
    scopes: [
      { value: 'agent.plan', label: '分析规划', description: '生成适合当前问题的工具执行计划。' },
      { value: 'workflows.match_analysis', label: '单场工作流', description: '运行完整单场分析工作流。' },
      { value: 'workflows.watchlist_analysis', label: '赛事清单工作流', description: '批量分析关注赛事。' },
      { value: 'workflows.monitoring_prepare', label: '监测准备工作流', description: '为持续监测准备规则和上下文。' },
      { value: 'reports.match_brief', label: '单场简报', description: '生成单场结构化简报。' },
      { value: 'reports.watchlist', label: '清单报告', description: '生成多场关注清单报告。' },
    ],
  },
  {
    key: 'automation',
    label: '观察条件与自动化',
    description: '读取、创建和管理持续观察条件。',
    scopes: [
      { value: 'watch_conditions.read', label: '读取观察条件', description: '读取观察条件和站内通知。' },
      { value: 'watch_conditions.write', label: '管理观察条件', description: '创建、评估、修改或取消观察条件。' },
    ],
  },
]

const scopeOptions = scopeGroups.flatMap(group => group.scopes)
const fullScopes = scopeOptions.map(item => item.value)
const basicScopes = scopeGroups[0]!.scopes.map(item => item.value)

const connections = ref<AiCredential[]>([])
const grants = ref<OAuthGrant[]>([])
const showConnectionHistory = ref(false)
const config = useRuntimeConfig()
const helpCenterUrl = computed(() => String(config.public.helpCenterUrl || 'https://help-test.spdex.com').replace(/\/$/, ''))
const mcpEndpoint = computed(() => String(config.public.mcpEndpoint || 'https://mcp-test.spdex.com/mcp?tool_subset=spdex-full'))
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
  scopes: [...fullScopes],
})

function applyScopePreset(preset: 'full' | 'basic') {
  form.scopes = [...(preset === 'full' ? fullScopes : basicScopes)]
}

function hasAllScopes(scopes: string[]) {
  const available = new Set(scopes)
  return fullScopes.every(scope => available.has(scope))
}

function visibleScopes(scopes: string[]) {
  return scopes.slice(0, 4)
}

function connectionStatusLabel(status: string) {
  if (status === 'active') return '有效'
  if (status === 'expired') return '已过期'
  return '已停用'
}

const activeConnections = computed(() => connections.value.filter(connection => connection.status === 'active'))
const inactiveConnections = computed(() => connections.value.filter(connection => connection.status !== 'active'))

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

async function reauthorizeConnection(connection: AiCredential) {
  if (!confirm(`“${connection.name}”将升级为完整 35 工具权限，旧 token 会立即失效。继续吗？`)) return
  try {
    const issue = await $apiFetch<AiCredentialIssue>(`/api/newspdex/ai/mcp/connections/${connection.id}/rotate`, {
      method: 'POST',
      body: { ttlDays: 90, scopes: fullScopes },
    })
    showIssued(issue)
    await load()
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string } }
    errorMessage.value = fetchError.data?.message || '重新授权失败'
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
        <b>完整连接可使用 SPdex 当前开放的 35 个工具。</b>
        <span>数据权限由 MCP token 的访问范围决定；客户端还需使用“完整工具”地址。外部 Agent 的模型费用由对应平台或你的模型 Key 承担。</span>
      </div>
      <a :href="usageHelpUrl" target="_blank" rel="noopener noreferrer">查看用量与安全边界</a>
    </section>

    <section class="safety-steps" aria-label="MCP 凭证安全处理">
      <div>
        <ShieldCheck :size="16" />
        <b>建议每个客户端单独创建 token</b>
        <span>例如 WorkBuddy、Cherry、Claude 或企业 Agent 分开命名，便于审计和单独撤销。</span>
      </div>
      <div>
        <RefreshCw :size="16" />
        <b>发现泄露时先撤销再重建</b>
        <span>如果 token 出现在截图、日志、聊天记录或共享文档中，应立即撤销对应连接，再创建新 token。</span>
      </div>
      <div>
        <ShieldAlert :size="16" />
        <b>不要让 Agent 读取本地配置</b>
        <span>外部 Agent 的提示词应要求模型不得输出密钥、请求头、cookie 或完整原始凭证。</span>
      </div>
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
          <div class="scope-heading">
            <legend>访问范围</legend>
            <div class="scope-presets" aria-label="权限预设">
              <button type="button" :class="{ active: hasAllScopes(form.scopes) }" @click="applyScopePreset('full')">完整 35 工具</button>
              <button type="button" :class="{ active: form.scopes.length === basicScopes.length && basicScopes.every(scope => form.scopes.includes(scope)) }" @click="applyScopePreset('basic')">基础 9 工具</button>
            </div>
          </div>
          <p class="scope-intro">推荐选择完整能力。基础模式只适合赛事搜索和基础盘口查询，不包含 FJCX、交易信号、工作流与自动化。</p>
          <div class="scope-groups">
            <section v-for="group in scopeGroups" :key="group.key" class="scope-group">
              <div class="scope-group-head">
                <b>{{ group.label }}</b>
                <span>{{ group.description }}</span>
              </div>
              <div class="scope-grid">
                <label v-for="scope in group.scopes" :key="scope.value" class="scope-option" :title="scope.description">
                  <input v-model="form.scopes" type="checkbox" :value="scope.value">
                  <span>{{ scope.label }}</span>
                </label>
              </div>
            </section>
          </div>
        </fieldset>
        <button class="submit-button focus-ring" type="submit" :disabled="saving || !form.scopes.length">
          <ShieldCheck :size="16" />
          <span>{{ saving ? '创建中' : '创建连接' }}</span>
        </button>
        <p class="form-note">创建后完整 token 只显示一次；建议按客户端单独创建、定期轮换，并在设备丢失或人员变更后立即撤销。</p>
      </form>

      <div v-if="loading" class="empty-state">正在读取连接</div>
      <div v-else-if="activeConnections.length" class="connection-list">
        <article v-for="connection in activeConnections" :key="connection.id" class="connection-row">
          <div class="connection-main">
            <div class="connection-title">
              <b>{{ connection.name }}</b>
              <span :class="['status', connection.status]">{{ connectionStatusLabel(connection.status) }}</span>
              <span v-if="hasAllScopes(connection.scopes)" class="status full">完整 35 工具</span>
              <span v-else class="status limited">权限不完整</span>
            </div>
            <code>{{ connection.tokenPrefix }}</code>
            <div class="scope-list">
              <span v-for="scope in visibleScopes(connection.scopes)" :key="scope">{{ scopeLabel(scope) }}</span>
              <span v-if="connection.scopes.length > 4">另有 {{ connection.scopes.length - 4 }} 项</span>
            </div>
            <p>
              最近使用：{{ formatTime(connection.lastUsedAt) }}
              <template v-if="connection.lastSourceIp"> · {{ connection.lastSourceIp }}</template>
              · {{ connection.callCount }} 次
            </p>
          </div>
          <div v-if="connection.status === 'active'" class="row-actions">
            <button
              v-if="!hasAllScopes(connection.scopes)"
              type="button"
              class="reauthorize-button focus-ring"
              @click="reauthorizeConnection(connection)"
            >
              <ShieldCheck :size="15" />
              <span>升级权限</span>
            </button>
            <button type="button" class="icon-button focus-ring" aria-label="轮换 token" @click="rotateConnection(connection)">
              <RefreshCw :size="15" />
            </button>
            <button type="button" class="icon-button danger focus-ring" aria-label="撤销连接" @click="revokeConnection(connection)">
              <Trash2 :size="15" />
            </button>
          </div>
        </article>
      </div>
      <div v-else class="empty-state">暂无有效 MCP 连接</div>

      <section v-if="inactiveConnections.length" class="connection-history" aria-label="已停用 MCP 连接历史">
        <button
          type="button"
          class="history-toggle focus-ring"
          :aria-expanded="showConnectionHistory"
          @click="showConnectionHistory = !showConnectionHistory"
        >
          <span>
            <ChevronUp v-if="showConnectionHistory" :size="15" />
            <ChevronDown v-else :size="15" />
            <b>已停用连接</b>
            <small>{{ inactiveConnections.length }} 条</small>
          </span>
          <em>{{ showConnectionHistory ? '收起历史' : '查看历史' }}</em>
        </button>
        <p v-if="showConnectionHistory" class="history-copy">历史记录仅用于审计；已停用 token 不能继续调用，也不会占用当前连接列表。</p>
        <div v-if="showConnectionHistory" class="connection-list history-list">
          <article v-for="connection in inactiveConnections" :key="connection.id" class="connection-row inactive-row">
            <div class="connection-main">
              <div class="connection-title">
                <b>{{ connection.name }}</b>
                <span :class="['status', connection.status]">{{ connectionStatusLabel(connection.status) }}</span>
                <span v-if="hasAllScopes(connection.scopes)" class="status full">原完整 35 工具</span>
                <span v-else class="status limited">原权限不完整</span>
              </div>
              <code>{{ connection.tokenPrefix }}</code>
              <p>停用前最近使用：{{ formatTime(connection.lastUsedAt) }} · {{ connection.callCount }} 次</p>
            </div>
          </article>
        </div>
      </section>
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
          <span>复制后只放入受信任客户端的 Header 或 OAuth 配置，不要粘贴到公开对话、截图、工单或文档中。若已暴露，请立即关闭窗口并撤销该连接。</span>
        </div>
        <code class="issued-token">{{ issuedToken }}</code>
        <div class="endpoint-block">
          <b>完整工具地址</b>
          <code>{{ mcpEndpoint }}</code>
          <span>在客户端中替换新 token，并重新连接或新建对话；工具列表应显示 35/35。</span>
        </div>
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
.safety-steps { display: grid; grid-template-columns: 1fr; gap: 7px; padding: 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--panel); }
.safety-steps > div { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 7px 8px; align-items: start; min-width: 0; color: var(--muted); font-size: .72rem; line-height: 1.5; }
.safety-steps svg { color: var(--brand); }
.safety-steps b { color: var(--ink); font-size: .76rem; }
.safety-steps span { grid-column: 2; }
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
.scope-heading { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; }
.scope-heading legend { margin: 0; }
.scope-presets { display: inline-flex; border: 1px solid var(--line); border-radius: 5px; overflow: hidden; }
.scope-presets button { min-height: 30px; padding: 5px 8px; border: 0; border-right: 1px solid var(--line); background: var(--panel); color: var(--muted); font-size: .7rem; }
.scope-presets button:last-child { border-right: 0; }
.scope-presets button.active { background: var(--brand); color: #fff; font-weight: 760; }
.scope-intro { margin: 0; color: var(--muted); font-size: .7rem; line-height: 1.55; }
.scope-groups { display: grid; gap: 8px; }
.scope-group { display: grid; gap: 8px; padding: 9px; border: 1px solid var(--divider); border-radius: 5px; background: var(--panel); }
.scope-group-head { display: grid; gap: 2px; }
.scope-group-head b { color: var(--ink); font-size: .76rem; }
.scope-group-head span { color: var(--muted); font-size: .68rem; line-height: 1.45; }
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
.connection-history { border-top: 1px solid var(--divider); background: var(--canvas); }
.history-toggle { display: flex; width: 100%; min-height: 42px; align-items: center; justify-content: space-between; gap: 10px; padding: 8px 11px; border: 0; background: transparent; color: var(--ink); text-align: left; }
.history-toggle > span { display: inline-flex; align-items: center; gap: 6px; }
.history-toggle b { font-size: .75rem; }
.history-toggle small { color: var(--muted); font-size: .66rem; }
.history-toggle em { color: var(--brand); font-size: .7rem; font-style: normal; font-weight: 760; }
.history-copy { margin: 0; padding: 0 11px 9px; color: var(--muted); font-size: .68rem; line-height: 1.5; }
.history-list { border-top: 1px solid var(--divider); background: var(--panel); }
.inactive-row { opacity: .78; }
.connection-main { display: grid; gap: 6px; min-width: 0; }
.connection-title { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.connection-title b { color: var(--ink); font-size: .86rem; }
.status { padding: 2px 5px; border-radius: 3px; background: #eef0f4; color: var(--muted); font-size: .62rem; font-weight: 760; }
.status.active { background: #e8f7ed; color: #18763b; }
.status.revoked, .status.expired { background: #f1f2f4; color: #697386; }
.status.full { background: #e9f6f4; color: #0f766e; }
.status.limited { background: #fff3e8; color: #a34100; }
.connection-main code, .issued-token { overflow-wrap: anywhere; color: var(--muted); font-size: .7rem; }
.scope-list { display: flex; flex-wrap: wrap; gap: 4px; }
.scope-list span { padding: 2px 5px; border: 1px solid var(--divider); border-radius: 3px; color: var(--muted); font-size: .64rem; }
.connection-main p { margin: 0; color: var(--muted); font-size: .68rem; }
.row-actions { display: flex; gap: 6px; align-items: start; }
.reauthorize-button { display: inline-flex; min-height: 34px; align-items: center; gap: 5px; padding: 6px 8px; border: 1px solid var(--brand); border-radius: 5px; background: var(--panel); color: var(--brand); font-size: .7rem; font-weight: 760; white-space: nowrap; }
.empty-state { padding: 22px 12px; color: var(--muted); font-size: .78rem; text-align: center; }
.token-overlay { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 16px; background: rgba(15, 22, 35, .58); }
.token-dialog { display: grid; gap: 14px; width: min(100%, 560px); padding: 16px; border-radius: 7px; background: var(--panel); box-shadow: 0 18px 50px rgba(0, 0, 0, .25); }
.token-head { display: flex; align-items: start; justify-content: space-between; gap: 10px; }
.token-warning { background: #fff7ed; }
.issued-token { display: block; max-height: 150px; overflow: auto; padding: 11px; border: 1px solid var(--line); border-radius: 4px; background: var(--canvas); color: var(--ink); }
.endpoint-block { display: grid; gap: 5px; padding: 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--canvas); }
.endpoint-block b { color: var(--ink); font-size: .76rem; }
.endpoint-block code { overflow-wrap: anywhere; color: var(--brand); font-size: .72rem; }
.endpoint-block span { color: var(--muted); font-size: .7rem; line-height: 1.5; }
@media (min-width: 760px) {
  .mcp-page { width: min(920px, 100%); margin: 0 auto; padding: 18px 20px 28px; }
  .safety-steps { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .scope-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>
