<script setup lang="ts">
import type { PolymarketTokenHolders, PolymarketHolder, BswApiResult } from '~/types/polymarket'

const props = defineProps<{
  conditionId: string | null
  label?: string
}>()

const BSW_OK = '00000'
const token = useCookie('spdex_token')
const loading = ref(false)
const holders = ref<PolymarketTokenHolders[]>([])

async function fetchHolders() {
  if (!props.conditionId) return
  loading.value = true
  try {
    const headers: Record<string, string> = {}
    if (token.value) headers.Authorization = `Bearer ${token.value}`
    const result = await $fetch<BswApiResult<PolymarketTokenHolders[]>>(
      '/api/polymarket/Get/Soccer/Holders',
      { params: { conditionId: props.conditionId, limit: 20 }, headers },
    )
    holders.value = String(result.code) === BSW_OK && result.data ? result.data : []
  }
  catch { holders.value = [] }
  finally { loading.value = false }
}

watch(() => props.conditionId, () => {
  holders.value = []
  fetchHolders()
}, { immediate: true })

// YES = outcomeIndex 0, NO = outcomeIndex 1
const yesHolders = computed(() => {
  const t = holders.value.find(h => h.outcomeIndex === 0)
  return t?.holders ?? []
})
const noHolders = computed(() => {
  const t = holders.value.find(h => h.outcomeIndex === 1)
  return t?.holders ?? []
})

const maxRows = computed(() => Math.max(yesHolders.value.length, noHolders.value.length))

function displayName(h: PolymarketHolder): string {
  if (h.pseudonym) return h.pseudonym
  if (h.name) return h.name
  if (h.proxyWallet) return `${h.proxyWallet.slice(0, 6)}...${h.proxyWallet.slice(-4)}`
  return '-'
}

function formatAmount(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1000) return amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return amount.toFixed(0)
}
</script>

<template>
  <div class="space-y-2">
    <div v-if="loading" class="text-xs text-gray-400 text-center py-6">加载持仓排行...</div>
    <div v-else-if="maxRows === 0" class="text-xs text-gray-400 text-center py-6">暂无持仓数据</div>
    <template v-else>
      <div class="grid grid-cols-2 gap-4">
        <!-- YES 持仓者 -->
        <div>
          <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">YES 持仓者</div>
          <div class="space-y-0">
            <div
              v-for="(h, i) in yesHolders"
              :key="'y-' + i"
              class="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0"
            >
              <span class="text-[11px] text-gray-400 w-5 text-right tabular-nums shrink-0">{{ i + 1 }}</span>
              <a
                v-if="h.proxyWallet"
                :href="`https://polymarket.com/profile/${h.proxyWallet}`"
                target="_blank"
                rel="noopener"
                class="text-xs text-blue-500 hover:underline truncate flex-1"
              >{{ displayName(h) }}</a>
              <span v-else class="text-xs text-gray-600 truncate flex-1">{{ displayName(h) }}</span>
              <span class="text-xs font-semibold text-gray-900 tabular-nums shrink-0">{{ formatAmount(h.amount) }}</span>
            </div>
          </div>
        </div>

        <!-- NO 持仓者 -->
        <div>
          <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">NO 持仓者</div>
          <div class="space-y-0">
            <div
              v-for="(h, i) in noHolders"
              :key="'n-' + i"
              class="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0"
            >
              <span class="text-[11px] text-gray-400 w-5 text-right tabular-nums shrink-0">{{ i + 1 }}</span>
              <a
                v-if="h.proxyWallet"
                :href="`https://polymarket.com/profile/${h.proxyWallet}`"
                target="_blank"
                rel="noopener"
                class="text-xs text-blue-500 hover:underline truncate flex-1"
              >{{ displayName(h) }}</a>
              <span v-else class="text-xs text-gray-600 truncate flex-1">{{ displayName(h) }}</span>
              <span class="text-xs font-semibold text-gray-900 tabular-nums shrink-0">{{ formatAmount(h.amount) }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
