<script setup lang="ts">
import { formatMoney, formatDateTime, formatMatchTime } from '~/utils/formatters'

// ── 路由参数 ──
const route = useRoute()
const eventId = computed(() => Number(route.query.id) || 0)

// ── 数据获取 ──
const { data, pending, error } = useBfFilter1(eventId)

const result = computed(() => data.value?.data)
const matchInfo = computed(() => result.value?.match)
const items = computed(() => result.value?.items ?? [])

useHead({
  title: computed(() => matchInfo.value
    ? `标盘提炼表 ${matchInfo.value.homeTeam}vs${matchInfo.value.guestTeam}`
    : '标盘提炼表'),
})
</script>

<template>
  <div class="detail-page">
    <!-- 加载/错误状态 -->
    <div v-if="pending" class="loading">加载中...</div>
    <div v-else-if="error || !result" class="error-msg">
      {{ error ? '数据加载失败' : '赛事不存在' }}
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
          <span class="page-badge">标盘提炼表</span>
        </h2>
        <div class="match-meta">
          开赛时间：{{ formatMatchTime(matchInfo?.matchTime ?? '') }}
          &nbsp;|&nbsp; MarketId1: {{ matchInfo?.marketId1 }}
        </div>
      </div>

      <!-- 主表 -->
      <div class="table-wrapper">
        <table class="gridtable">
          <thead>
            <tr>
              <th>CS</th>
              <th class="bg-back">挂卖价</th>
              <th class="bg-back">挂卖量</th>
              <th class="bg-lay">挂买价</th>
              <th class="bg-lay">挂买量</th>
              <th>成交量</th>
              <th>更新时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(item, idx) in items" :key="idx">
              <td :class="'sel-' + item.selection">
                <strong>{{ item.selection }}</strong>
              </td>
              <td class="bg-back num-cell">{{ item.toBack > 0 ? item.price.toFixed(2) : '' }}</td>
              <td class="bg-back num-cell">{{ item.toBack > 0 ? formatMoney(item.toBack) : '' }}</td>
              <td class="bg-lay num-cell">{{ item.toLay > 0 ? item.price.toFixed(2) : '' }}</td>
              <td class="bg-lay num-cell">{{ item.toLay > 0 ? formatMoney(item.toLay) : '' }}</td>
              <td class="num-cell">{{ formatMoney(item.traded) }}</td>
              <td class="col-time-val">{{ formatDateTime(item.updateTime) }}</td>
            </tr>

            <tr v-if="items.length === 0">
              <td colspan="7" class="no-data">暂无数据</td>
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
/* ── filter1 特有样式 ── */
.page-badge {
  display: inline-block;
  margin-left: 12px;
  padding: 2px 10px;
  background: #b22222;
  color: #fff;
  font-size: 0.78rem;
  font-weight: 600;
  border-radius: 4px;
  vertical-align: middle;
}

/* 1x2 Selection 颜色 */
.sel-主 { color: #c00; font-weight: 700; }
.sel-平 { color: #666; font-weight: 700; }
.sel-客 { color: #00c; font-weight: 700; }

.num-cell {
  font-variant-numeric: tabular-nums;
  text-align: right;
}
</style>
