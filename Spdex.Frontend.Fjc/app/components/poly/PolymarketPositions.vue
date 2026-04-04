<script setup lang="ts">
import type { PolymarketTokenHolders, PolymarketHolder, PolymarketHolderSnapshot, BswApiResult } from '~/types/polymarket'

const props = defineProps<{
  conditionId: string | null
  eventId?: string | null
  label?: string
}>()

const BSW_OK = '00000'
const token = useCookie('spdex_token')
const loading = ref(false)
const holders = ref<PolymarketTokenHolders[]>([])
const snapshots = ref<PolymarketHolderSnapshot[]>([])

async function fetchHolders() {
  if (!props.conditionId) return
  loading.value = true
  try {
    const headers: Record<string, string> = {}
    if (token.value) headers.Authorization = `Bearer ${token.value}`

    const [holdersRes, snapshotsRes] = await Promise.all([
      $fetch<BswApiResult<PolymarketTokenHolders[]>>(
        '/api/polymarket/Get/Soccer/Holders',
        { params: { conditionId: props.conditionId, limit: 20 }, headers },
      ),
      props.eventId
        ? $fetch<BswApiResult<PolymarketHolderSnapshot[]>>(
            '/api/polymarket/Get/Soccer/HolderSnapshots',
            { params: { eventId: props.eventId, conditionId: props.conditionId }, headers },
          ).catch(() => null)
        : Promise.resolve(null),
    ])

    holders.value = String(holdersRes.code) === BSW_OK && holdersRes.data ? holdersRes.data : []
    snapshots.value = snapshotsRes && String(snapshotsRes.code) === BSW_OK && snapshotsRes.data ? snapshotsRes.data : []
  }
  catch { holders.value = []; snapshots.value = [] }
  finally { loading.value = false }
}

watch(() => props.conditionId, () => {
  holders.value = []; snapshots.value = []
  fetchHolders()
}, { immediate: true })

const yesHolders = computed(() => {
  const byIdx = holders.value.find(h => h.outcomeIndex === 0)
  if (byIdx) return byIdx.holders
  return holders.value[0]?.holders ?? []
})
const noHolders = computed(() => {
  const byIdx = holders.value.find(h => h.outcomeIndex === 1)
  if (byIdx) return byIdx.holders
  return holders.value[1]?.holders ?? []
})

// 持仓方差
function calcVariance(list: PolymarketHolder[]): number {
  const top = list.slice(0, 10).map(h => h.amount)
  if (!top.length) return 0
  const mean = top.reduce((s, v) => s + v, 0) / top.length
  return top.reduce((s, v) => s + (v - mean) ** 2, 0) / top.length
}
function fmtVar(v: number): string {
  if (v === 0) return '-'
  if (v >= 1e12) return `${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`
  return v.toFixed(0)
}

// 快照表格行
interface SnapRow { wallet: string; name: string; tokenLabel: string; amounts: Record<string, number | null> }
const snapshotRows = computed<SnapRow[]>(() => {
  if (!snapshots.value.length) return []
  const map = new Map<string, SnapRow>()
  for (const snap of snapshots.value) {
    for (const tk of snap.tokens) {
      const label = tk.tokenIndex === 0 ? 'Yes' : 'No'
      for (const h of tk.holders) {
        const key = `${h.proxyWallet}:${label}`
        if (!map.has(key)) map.set(key, { wallet: h.proxyWallet, name: h.pseudonym || h.name || h.proxyWallet.slice(0, 10) + '...', tokenLabel: label, amounts: {} })
        map.get(key)!.amounts[snap.offsetLabel] = h.amount
      }
    }
  }
  return [...map.values()].sort((a, b) => {
    if (a.tokenLabel !== b.tokenLabel) return a.tokenLabel === 'Yes' ? -1 : 1
    const maxA = Math.max(...Object.values(a.amounts).filter((v): v is number => v != null))
    const maxB = Math.max(...Object.values(b.amounts).filter((v): v is number => v != null))
    return maxB - maxA
  })
})

function displayName(h: PolymarketHolder): string {
  return h.pseudonym || h.name || (h.proxyWallet ? `${h.proxyWallet.slice(0, 6)}...${h.proxyWallet.slice(-4)}` : '-')
}
function formatAmount(amount: number): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1000) return amount.toLocaleString(undefined, { maximumFractionDigits: 0 })
  return amount.toFixed(0)
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="loading" class="text-xs text-gray-400 text-center py-6">加载持仓排行...</div>
    <div v-else-if="yesHolders.length === 0 && noHolders.length === 0" class="text-xs text-gray-400 text-center py-6">暂无持仓数据</div>
    <template v-else>
      <div class="grid grid-cols-2 gap-4">
        <!-- YES 持仓者 -->
        <div>
          <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span>YES 持仓者</span>
            <span class="text-[10px] font-normal" title="Top10持仓方差">方差 {{ fmtVar(calcVariance(yesHolders)) }}</span>
          </div>
          <div class="space-y-0">
            <div v-for="(h, i) in yesHolders" :key="'y-' + i"
              class="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
              <span class="text-[11px] text-gray-400 w-5 text-right tabular-nums shrink-0">{{ i + 1 }}</span>
              <a v-if="h.proxyWallet" :href="`https://polymarket.com/profile/${h.proxyWallet}`"
                target="_blank" rel="noopener" class="text-xs text-blue-500 hover:underline truncate flex-1">
                {{ displayName(h) }}
              </a>
              <span v-else class="text-xs text-gray-600 truncate flex-1">{{ displayName(h) }}</span>
              <span v-if="h.totalBought > 0" class="text-[10px] text-green-600 shrink-0">
                Bought {{ Math.round(h.avgPrice * 100) }}¢
              </span>
              <span class="text-xs font-semibold text-gray-900 tabular-nums shrink-0">{{ formatAmount(h.amount) }}</span>
            </div>
          </div>
        </div>

        <!-- NO 持仓者 -->
        <div>
          <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
            <span>NO 持仓者</span>
            <span class="text-[10px] font-normal" title="Top10持仓方差">方差 {{ fmtVar(calcVariance(noHolders)) }}</span>
          </div>
          <div class="space-y-0">
            <div v-for="(h, i) in noHolders" :key="'n-' + i"
              class="flex items-center gap-2 py-1.5 border-b border-gray-100 last:border-0">
              <span class="text-[11px] text-gray-400 w-5 text-right tabular-nums shrink-0">{{ i + 1 }}</span>
              <a v-if="h.proxyWallet" :href="`https://polymarket.com/profile/${h.proxyWallet}`"
                target="_blank" rel="noopener" class="text-xs text-blue-500 hover:underline truncate flex-1">
                {{ displayName(h) }}
              </a>
              <span v-else class="text-xs text-gray-600 truncate flex-1">{{ displayName(h) }}</span>
              <span v-if="h.totalBought > 0" class="text-[10px] text-green-600 shrink-0">
                Bought {{ Math.round(h.avgPrice * 100) }}¢
              </span>
              <span class="text-xs font-semibold text-gray-900 tabular-nums shrink-0">{{ formatAmount(h.amount) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 持仓分时快照 -->
      <div v-if="snapshotRows.length > 0" class="mt-3">
        <div class="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Top 3 持仓变化</div>
        <div class="overflow-x-auto">
          <table class="w-full text-xs">
            <thead>
              <tr class="border-b border-gray-200">
                <th class="text-left px-2 py-1.5 font-medium text-gray-400">持仓者</th>
                <th v-for="snap in snapshots" :key="snap.offsetLabel" class="text-right px-2 py-1.5 font-medium text-gray-400">
                  {{ snap.offsetLabel }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in snapshotRows" :key="row.wallet" class="border-b border-gray-100 last:border-0">
                <td class="px-2 py-1.5 text-gray-600 truncate max-w-[120px]">
                  <span class="text-[10px] px-1 py-0.5 rounded mr-1"
                    :class="row.tokenLabel === 'Yes' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'">
                    {{ row.tokenLabel }}
                  </span>
                  {{ row.name }}
                </td>
                <td v-for="snap in snapshots" :key="snap.offsetLabel"
                  class="text-right px-2 py-1.5 tabular-nums text-gray-900">
                  {{ row.amounts[snap.offsetLabel] != null ? Math.round(row.amounts[snap.offsetLabel]!).toLocaleString() : '-' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
