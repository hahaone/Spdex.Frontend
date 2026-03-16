<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePolymarketData } from '~/composables/usePolymarketData'

// ─── Route & Data ───

const route = useRoute()
const spdexEventId = computed(() => {
  const raw = route.query.id
  const num = Number(raw)
  return Number.isFinite(num) && num > 0 ? num : null
})

const { matchLinks, primaryLink, trades, book, loading, error, refresh } = usePolymarketData(spdexEventId)

// ─── 比赛信息（优先使用 Spdex 中文名，从 URL query 传入） ───

const cnHome = computed(() => route.query.home ? String(route.query.home) : null)
const cnAway = computed(() => route.query.away ? String(route.query.away) : null)
const cnLeague = computed(() => route.query.league ? String(route.query.league) : null)

const matchTitle = computed(() => {
  if (cnHome.value && cnAway.value) {
    return `${cnHome.value}  vs  ${cnAway.value}`
  }
  const link = primaryLink.value
  if (!link) return trades.value?.title ?? '加载中...'
  const home = link.betsapiHomeTeam ?? link.polymarketHomeTeam ?? '?'
  const away = link.betsapiAwayTeam ?? link.polymarketAwayTeam ?? '?'
  return `${home}  vs  ${away}`
})

const matchMeta = computed(() => {
  const link = primaryLink.value
  const parts: string[] = []

  if (cnLeague.value) {
    parts.push(cnLeague.value)
  }
  else if (link?.betsapiLeagueName) {
    parts.push(link.betsapiLeagueName)
  }

  const kickoff = link?.betsapiKickoffUtc ?? link?.polymarketKickoffUtc
  if (kickoff) {
    parts.push(new Date(kickoff).toLocaleString('zh-CN', {
      month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    }))
  }

  if (link && link.matchConfidence > 0) {
    parts.push(`匹配度 ${Math.round(link.matchConfidence * 100)}%`)
  }

  return parts.join(' · ')
})

const polymarketUrl = computed(() => {
  const slug = trades.value?.slug ?? primaryLink.value?.polymarketSlug
  if (!slug) return null
  return `https://polymarket.com/event/${slug}`
})
</script>

<template>
  <div class="poly-detail-page">
    <!-- 顶部导航 -->
    <div class="page-header">
      <NuxtLink to="/" class="back-link">← 返回列表</NuxtLink>
      <button class="refresh-btn" :disabled="loading" @click="refresh">
        {{ loading ? '刷新中...' : '🔄 刷新' }}
      </button>
    </div>

    <!-- 比赛信息 -->
    <div class="match-info">
      <h1 class="match-title">{{ matchTitle }}</h1>
      <div class="match-meta">
        {{ matchMeta }}
        <a v-if="polymarketUrl" :href="polymarketUrl" target="_blank" rel="noopener" class="poly-link">
          ↗ Polymarket
        </a>
      </div>
    </div>

    <!-- Error (无数据时显示) -->
    <div v-if="error && !trades && !loading" class="status-box text-amber-600">{{ error }}</div>

    <!-- Polymarket Panel -->
    <PolymarketPanel
      :links="matchLinks"
      :trades="trades"
      :book="book"
      :loading="loading"
      :cn-home="cnHome"
      :cn-away="cnAway"
    />
  </div>
</template>

<style scoped>
.poly-detail-page {
  max-width: 920px;
  margin: 0 auto;
  padding: 16px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.back-link {
  font-size: 0.85rem;
  color: #6d28d9;
  text-decoration: none;
}
.back-link:hover {
  text-decoration: underline;
}

.refresh-btn {
  font-size: 0.8rem;
  padding: 4px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  background: #fff;
  cursor: pointer;
  color: #374151;
}
.refresh-btn:hover {
  background: #f9fafb;
}
.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.match-info {
  margin-bottom: 20px;
}

.match-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #111827;
  margin: 0 0 4px;
}

.match-meta {
  font-size: 0.8rem;
  color: #6b7280;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.poly-link {
  color: #6d28d9;
  text-decoration: none;
  font-weight: 500;
}
.poly-link:hover {
  text-decoration: underline;
}

.status-box {
  text-align: center;
  padding: 40px 16px;
  color: #9ca3af;
  font-size: 0.9rem;
}
</style>
