<script setup lang="ts">
import { Check, CircleHelp, KeyRound, ShieldAlert, ShieldCheck, X } from '@lucide/vue'

interface OAuthAuthorization {
  id: string
  clientId: string
  clientName: string
  redirectUri: string
  scopes: string[]
  status: string
  expiresAt: string
}

interface OAuthDecision {
  redirectUrl: string
}

const route = useRoute()
const config = useRuntimeConfig()
const helpCenterUrl = computed(() => String(config.public.helpCenterUrl || 'https://help-test.spdex.com').replace(/\/$/, ''))
const usageHelpUrl = computed(() => `${helpCenterUrl.value}/ai/ai-mcp-usage-quota`)
const requestId = computed(() => typeof route.query.request_id === 'string' ? route.query.request_id : '')
const authorization = ref<OAuthAuthorization | null>(null)
const loading = ref(true)
const deciding = ref(false)
const errorMessage = ref('')

const scopeLabels: Record<string, string> = {
  'matches.search': '搜索和筛选赛事',
  'matches.snapshot': '读取单场数据快照',
  'markets.series': '读取盘口和成交走势',
  'markets.anomalies': '检测市场异常证据',
  'metrics.explain': '解释 SPdex 数据指标',
}

async function load() {
  if (!requestId.value) {
    errorMessage.value = '缺少 OAuth 授权请求'
    loading.value = false
    return
  }

  try {
    authorization.value = await $apiFetch<OAuthAuthorization>(
      `/api/newspdex/ai/oauth/authorization/${requestId.value}`,
    )
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { error_description?: string, message?: string } }
    errorMessage.value = fetchError.data?.error_description || fetchError.data?.message || '授权请求已失效'
  }
  finally {
    loading.value = false
  }
}

async function decide(approved: boolean) {
  if (!authorization.value || deciding.value) return
  deciding.value = true
  try {
    const result = await $apiFetch<OAuthDecision>(
      `/api/newspdex/ai/oauth/authorization/${requestId.value}`,
      { method: 'POST', body: { approved } },
    )
    await navigateTo(result.redirectUrl, { external: true })
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { error_description?: string, message?: string } }
    errorMessage.value = fetchError.data?.error_description || fetchError.data?.message || '授权操作失败'
    deciding.value = false
  }
}

onMounted(load)
</script>

<template>
  <section class="authorize-page">
    <div class="authorize-panel">
      <div class="app-mark"><KeyRound :size="24" /></div>
      <template v-if="loading">
        <h1>正在验证授权请求</h1>
      </template>
      <template v-else-if="authorization">
        <h1>授权 {{ authorization.clientName }}</h1>
        <p class="lead">该客户端申请访问你的 SPdex AI 数据工具。</p>
        <div class="boundary-note">
          <ShieldAlert :size="16" />
          <span>允许后，该客户端可以代表你调用已勾选的数据工具。第三方客户端可能记录问题、上下文和工具结果，并可能另行收取模型或平台费用。</span>
        </div>
        <div class="safety-note">
          <ShieldCheck :size="15" />
          <span>只授权你信任的客户端；授权后可在账号中心随时撤销。不要把 token、Authorization header 或本地 MCP 配置交给聊天模型阅读。</span>
        </div>
        <div class="scope-list">
          <div v-for="scope in authorization.scopes" :key="scope" class="scope-row">
            <Check :size="15" />
            <span>{{ scopeLabels[scope] || scope }}</span>
          </div>
        </div>
        <div class="actions">
          <button class="deny focus-ring" type="button" :disabled="deciding" @click="decide(false)">
            <X :size="16" /><span>拒绝</span>
          </button>
          <button class="approve focus-ring" type="button" :disabled="deciding" @click="decide(true)">
            <ShieldCheck :size="16" /><span>{{ deciding ? '处理中' : '允许访问' }}</span>
          </button>
        </div>
        <a class="help-link focus-ring" :href="usageHelpUrl" target="_blank" rel="noopener noreferrer">
          <CircleHelp :size="15" />
          <span>查看用量、额度和凭证安全说明</span>
        </a>
      </template>
      <div v-if="errorMessage" class="error-message">{{ errorMessage }}</div>
    </div>
  </section>
</template>

<style scoped>
.authorize-page { display: grid; min-height: calc(100vh - 112px); place-items: center; padding: 18px 12px; }
.authorize-panel { display: grid; gap: 14px; width: min(100%, 460px); padding: 20px; border: 1px solid var(--line); border-radius: 7px; background: var(--panel); box-shadow: 0 12px 34px rgba(20, 28, 44, .11); }
.app-mark { display: grid; width: 46px; height: 46px; place-items: center; border-radius: 6px; background: var(--brand); color: #fff; }
h1 { margin: 0; color: var(--ink); font-size: 1.08rem; letter-spacing: 0; }
.lead { margin: -7px 0 0; color: var(--muted); font-size: .8rem; }
.boundary-note { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; padding: 10px; border: 1px solid #fed7aa; border-radius: 5px; background: #fff7ed; color: #9a3412; font-size: .76rem; line-height: 1.55; }
.safety-note { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 8px; padding: 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--canvas); color: var(--muted); font-size: .74rem; line-height: 1.5; }
.safety-note svg { color: var(--brand); }
.scope-list { display: grid; border: 1px solid var(--divider); border-radius: 5px; overflow: hidden; }
.scope-row { display: grid; grid-template-columns: 18px minmax(0, 1fr); gap: 7px; align-items: center; min-height: 39px; padding: 8px 10px; border-bottom: 1px solid var(--divider); color: var(--ink); font-size: .78rem; }
.scope-row:last-child { border-bottom: 0; }
.scope-row svg { color: #18763b; }
.actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.actions button { display: inline-flex; min-height: 38px; align-items: center; justify-content: center; gap: 6px; border-radius: 5px; font-size: .8rem; font-weight: 780; }
.deny { border: 1px solid var(--line); background: var(--panel); color: var(--ink); }
.approve { border: 0; background: var(--brand); color: #fff; }
.help-link { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; color: var(--brand); font-size: .78rem; font-weight: 760; text-decoration: none; }
.error-message { padding: 9px 10px; border: 1px solid #f4b5af; border-radius: 5px; background: #fff2f0; color: #9f1c13; font-size: .77rem; }
</style>
