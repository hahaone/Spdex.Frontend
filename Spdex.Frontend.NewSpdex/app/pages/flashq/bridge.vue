<script setup lang="ts">
import { Zap } from '@lucide/vue'
import type { ApiResponse } from '~/types/auth'
import { isQuantilearnRedirectTarget } from '~/utils/quantilearnRedirect'
import { isFreeMembership } from '~/utils/membership'

interface QuantilearnTicket {
  ticket: string
  expiresAt: string
}

const route = useRoute()
const { user, refreshToken } = useAuth()
const error = ref('')
const blockedByPlan = ref(false)
const flashTarget = ref(false)
const freeFlashQMessage = '免费版暂未开放闪Q，请升级会籍后使用'

function appendQuery(url: string, params: Record<string, string | undefined>) {
  const parsed = new URL(url, window.location.origin)
  Object.entries(params).forEach(([key, value]) => {
    if (value) parsed.searchParams.set(key, value)
  })
  return parsed.href
}

function normalizeTarget(raw: string) {
  try {
    const parsed = new URL(raw, window.location.origin)
    if (isQuantilearnRedirectTarget(parsed)) {
      parsed.searchParams.delete('ticket')
      return `${parsed.origin}${parsed.pathname}${parsed.search}${parsed.hash}`
    }
  }
  catch {
    // fall through
  }

  return 'https://ql.spdex.com/flash'
}

onMounted(async () => {
  const target = normalizeTarget(String(route.query.target || 'https://ql.spdex.com/flash').trim())
  const targetUrl = new URL(target, window.location.origin)
  flashTarget.value = targetUrl.pathname === '/flash'
  const eid = String(route.query.eid || targetUrl.searchParams.get('eid') || '').trim()

  if (flashTarget.value && !eid) {
    error.value = '缺少赛事 ID'
    return
  }

  try {
    const authenticated = await refreshToken()
    if (!authenticated || !user.value) {
      error.value = flashTarget.value ? '请先登录后访问闪Q' : '请先登录后访问量化模型'
      return
    }

    if (flashTarget.value && isFreeMembership(user.value)) {
      blockedByPlan.value = true
      error.value = freeFlashQMessage
      return
    }

    const res = await $apiFetch<ApiResponse<QuantilearnTicket>>('/api/newspdex/auth/quantilearn-ticket', {
      method: 'POST',
    })

    if (res.code !== 0 || !res.data?.ticket) {
      error.value = res.message || (flashTarget.value ? '闪Q登录票据生成失败' : '量化模型登录票据生成失败')
      return
    }

    await navigateTo(appendQuery(target, { eid, ticket: res.data.ticket }), { external: true })
  }
  catch (err: unknown) {
    const fetchErr = err as { data?: { message?: string } }
    error.value = fetchErr?.data?.message || (flashTarget.value ? '无法打开闪Q，请稍后重试' : '无法打开量化模型，请稍后重试')
  }
})
</script>

<template>
  <section class="flashq-bridge">
    <Zap :size="34" stroke-width="1.8" />
    <h1>{{ flashTarget ? '正在打开闪Q' : '正在打开量化模型' }}</h1>
    <p v-if="!error">正在建立安全会话...</p>
    <p v-else class="error">{{ error }}</p>
    <NuxtLink v-if="blockedByPlan" to="/account/upgrade" class="upgrade-link focus-ring">
      升级会籍
    </NuxtLink>
  </section>
</template>

<style scoped>
.flashq-bridge {
  min-height: 60vh;
  display: grid;
  place-items: center;
  align-content: center;
  gap: 12px;
  color: var(--text, #1f2937);
  text-align: center;
}

.flashq-bridge svg {
  color: #6f55f2;
}

.flashq-bridge h1 {
  margin: 0;
  font-size: 24px;
}

.flashq-bridge p {
  margin: 0;
  color: #667085;
}

.flashq-bridge .error {
  color: #b42318;
}

.upgrade-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 14px;
  border-radius: 6px;
  background: #6f55f2;
  color: #fff;
  font-size: 14px;
  font-weight: 760;
  text-decoration: none;
}
</style>
