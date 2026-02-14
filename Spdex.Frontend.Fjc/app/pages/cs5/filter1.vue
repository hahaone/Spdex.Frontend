<script setup lang="ts">
import type { AsianFilter1Item } from '~/types/bffilter'
import { formatMoney, formatDateTime, formatMatchTimeFull } from '~/utils/formatters'

// ── 路由参数 ──
const route = useRoute()
const eventId = computed(() => Number(route.query.id) || 0)

// ── 数据获取 ──
const { data, pending, error } = useAsianFilter1(eventId)

const result = computed(() => data.value?.data)
const matchInfo = computed(() => result.value?.match)
const allItems = computed(() => result.value?.items ?? [])

useHead({
  title: computed(() => matchInfo.value
    ? `亚盘提炼表 ${matchInfo.value.homeTeam}vs${matchInfo.value.guestTeam}`
    : '亚盘提炼表'),
})

// ── 客户端过滤 ──
const excludeOverlap = ref(true)

/**
 * 过滤逻辑（与旧站 csc5_filter_1 一致）：
 * 启用 excludeOverlap 时，将同一 SelectId+Handicap 分组，
 * 如果组内同时存在满足挂买量(ToLay≥10K)和满足挂卖量(ToBack≥10K)的记录，则整组过滤。
 */
const filteredItems = computed(() => {
  if (!excludeOverlap.value) return allItems.value

  // 按 SelectId + Handicap 分组
  const groups = new Map<string, AsianFilter1Item[]>()
  for (const item of allItems.value) {
    const key = `${item.selectId}_${item.handicap}`
    const group = groups.get(key)
    if (group) group.push(item)
    else groups.set(key, [item])
  }

  // 标记需要过滤的组
  const excludedKeys = new Set<string>()
  for (const [key, group] of groups) {
    const hasBuy = group.some(r => r.toLay >= 10000)
    const hasSell = group.some(r => r.toBack >= 10000)
    if (hasBuy && hasSell) excludedKeys.add(key)
  }

  return allItems.value.filter((item) => {
    const key = `${item.selectId}_${item.handicap}`
    return !excludedKeys.has(key)
  })
})

const filterInfo = computed(() =>
  `说明：默认显示满足任一条件的数据，勾选后将过滤掉SelectId和让分相同且组内同时存在满足挂买量和满足挂卖量条件的记录（当前显示 ${filteredItems.value.length} 条数据）`,
)
</script>

<template>
  <div class="detail-page">
    <!-- 加载/错误状态 -->
    <div v-if="pending" class="loading">加载中...</div>
    <div v-else-if="error || !result" class="error-msg">
      {{ error ? '数据加载失败' : '赛事不存在或亚盘 MarketId3 为 0' }}
      <NuxtLink to="/" class="back-link">&larr; 返回首页</NuxtLink>
    </div>

    <template v-else>
      <!-- 页头 -->
      <div class="match-header">
        <NuxtLink to="/" class="back-link">&larr; 返回列表</NuxtLink>
        <h2 class="match-title">
          <span class="team-home">{{ matchInfo?.homeTeam }}</span>
          <span class="team-vs">vs</span>
          <span class="team-away">{{ matchInfo?.guestTeam }}</span>
          <span class="page-badge">亚盘提炼表</span>
        </h2>
        <div class="match-meta">
          开赛时间：{{ formatMatchTimeFull(matchInfo?.matchTime ?? '') }}
          &nbsp;|&nbsp; 亚盘 (Asian Handicap)
        </div>
      </div>

      <!-- 过滤器 -->
      <div class="filter-section">
        <div class="complex-filter">
          <label class="checkbox-wrapper">
            <input v-model="excludeOverlap" type="checkbox" class="filter-checkbox">
            <span class="filter-checkbox-label">过滤掉SelectId和让分相同且组内同时存在满足挂买量和满足挂卖量条件的记录</span>
          </label>
        </div>
        <div class="filter-info">{{ filterInfo }}</div>
      </div>

      <!-- 主表 -->
      <div class="table-wrapper">
        <table class="gridtable">
          <thead>
            <tr>
              <th>SelectId</th>
              <th>Handicap</th>
              <th class="bg-back">挂卖价</th>
              <th class="bg-back">挂卖量</th>
              <th class="bg-lay">挂买价</th>
              <th class="bg-lay">挂买量</th>
              <th>成交量</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in filteredItems" :key="idx" class="data-row">
              <td>{{ item.selection }}</td>
              <td>{{ item.handicap }}</td>
              <td class="bg-back num-cell">{{ item.toBack > 0 ? item.price.toFixed(2) : '' }}</td>
              <td class="bg-back num-cell">{{ item.toBack > 0 ? formatMoney(item.toBack) : '' }}</td>
              <td class="bg-lay num-cell">{{ item.toLay > 0 ? item.price.toFixed(2) : '' }}</td>
              <td class="bg-lay num-cell">{{ item.toLay > 0 ? formatMoney(item.toLay) : '' }}</td>
              <td class="num-cell">{{ formatMoney(item.traded) }}</td>
              <td class="col-time-val">{{ formatDateTime(item.updateTime) }}</td>
            </tr>

            <tr v-if="filteredItems.length === 0">
              <td colspan="8" class="no-data">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>

<style>
@import '~/assets/css/detail-shared.css';
</style>

<style scoped>
.page-badge {
  display: inline-block;
  margin-left: 12px;
  padding: 2px 10px;
  background: #7c3aed;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 4px;
  vertical-align: middle;
}

.num-cell {
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* ── 过滤器区域 ── */
.filter-section {
  border: 1px solid #e5e7eb;
  border-radius: 0.5rem;
  padding: 12px 16px;
  margin-bottom: 12px;
  background: #f8fafc;
}

.complex-filter {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  background: #fee2e2;
  border-radius: 6px;
  border: 1px solid #fecaca;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
}

.filter-checkbox {
  width: 16px;
  height: 16px;
  cursor: pointer;
}

.filter-checkbox-label {
  font-size: 0.875rem;
  color: #991b1b;
  user-select: none;
}

.filter-info {
  font-size: 0.85rem;
  color: #6b7280;
  margin-top: 8px;
}
</style>
