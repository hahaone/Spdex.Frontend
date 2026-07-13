<script setup lang="ts">
import type { BigTradeGroup } from '~/composables/useBigTrades'

interface DistributionItem {
  sel: string
  label: string
  amount: number
  buy: number
  sell: number
  color: string
  lightColor: string
}

const props = defineProps<{
  groups: BigTradeGroup[]
}>()

const activeMarket = ref('standard')

const marketOptions = computed(() => [
  props.groups.some(g => g.market === 'standard')
    ? { label: '标盘', value: 'standard' }
    : null,
  props.groups.some(g => g.market === 'goals')
    ? { label: '大小球', value: 'goals' }
    : null,
].filter((option): option is { label: string, value: string } => option !== null))

watch(marketOptions, (options) => {
  if (!options.some(option => option.value === activeMarket.value))
    activeMarket.value = options[0]?.value ?? 'standard'
}, { immediate: true })

const combinedGroup = computed(() => {
  const key = activeMarket.value === 'goals' ? 'ou-all' : 'std-all'
  return props.groups.find(group => group.key === key)
    ?? props.groups.find(group => group.market === activeMarket.value)
    ?? null
})

const selectionDefinitions = computed(() => activeMarket.value === 'goals'
  ? [
      { sel: '大', label: '大球', color: '#d6324c', lightColor: '#ec8999' },
      { sel: '小', label: '小球', color: '#5b6fe8', lightColor: '#a8b2f2' },
    ]
  : [
      { sel: '主', label: '主胜', color: '#d6324c', lightColor: '#ec8999' },
      { sel: '平', label: '平局', color: '#2e9c5f', lightColor: '#8bc8a5' },
      { sel: '客', label: '客胜', color: '#5b6fe8', lightColor: '#a8b2f2' },
    ])

const distribution = computed<DistributionItem[]>(() => selectionDefinitions.value.map((definition) => {
  const trades = (combinedGroup.value?.trades ?? []).filter(trade => trade.sel === definition.sel)
  return {
    ...definition,
    amount: trades.reduce((sum, trade) => sum + trade.amount, 0),
    buy: trades.filter(trade => trade.side.includes('买')).reduce((sum, trade) => sum + trade.amount, 0),
    sell: trades.filter(trade => trade.side.includes('卖')).reduce((sum, trade) => sum + trade.amount, 0),
  }
}))

const totalAmount = computed(() => distribution.value.reduce((sum, item) => sum + item.amount, 0))

const donutStyle = computed(() => {
  if (totalAmount.value <= 0)
    return { background: 'var(--surface)' }

  let cursor = 0
  const stops = distribution.value
    .filter(item => item.amount > 0)
    .map((item) => {
      const start = cursor
      cursor += item.amount / totalAmount.value * 100
      return `${item.color} ${start.toFixed(2)}% ${cursor.toFixed(2)}%`
    })

  return { background: `conic-gradient(${stops.join(', ')})` }
})

function niceMaximum(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const fraction = value / power
  const rounded = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return rounded * power
}

const barMaximum = computed(() => niceMaximum(Math.max(
  ...distribution.value.flatMap(item => [item.buy, item.sell]),
  0,
)))

const axisTicks = computed(() => Array.from({ length: 5 }, (_, index) =>
  barMaximum.value * (4 - index) / 4))

function barHeight(value: number): string {
  return `${Math.max(0, Math.min(100, value / barMaximum.value * 100))}%`
}

function money(value: number): string {
  return Math.round(value).toLocaleString('en-US')
}

function compactMoney(value: number): string {
  if (value >= 100_000_000) return `${(value / 100_000_000).toFixed(1)}亿`
  if (value >= 10_000) return `${(value / 10_000).toFixed(value >= 100_000 ? 0 : 1)}万`
  return money(value)
}
</script>

<template>
  <section v-if="combinedGroup?.trades.length" class="distribution-card">
    <header class="distribution-head">
      <h2>大额成交分布</h2>
      <SegmentedControl
        v-if="marketOptions.length > 1"
        v-model="activeMarket"
        :options="marketOptions"
        dense
        tone="accent"
      />
    </header>

    <div class="distribution-grid">
      <div class="volume-view">
        <h3>大额交易量</h3>
        <div class="volume-content">
          <div class="donut" :style="donutStyle" role="img" :aria-label="`大额交易量合计 ${money(totalAmount)}`">
            <div class="donut-center">
              <strong class="num">{{ compactMoney(totalAmount) }}</strong>
              <span>总大注</span>
            </div>
          </div>

          <ul class="selection-legend">
            <li v-for="item in distribution" :key="item.sel">
              <i :style="{ backgroundColor: item.color }" />
              <span>{{ item.label }}</span>
              <b class="num">{{ money(item.amount) }}</b>
              <em class="num">{{ totalAmount > 0 ? (item.amount / totalAmount * 100).toFixed(1) : '0.0' }}%</em>
            </li>
          </ul>
        </div>
      </div>

      <div class="side-view">
        <div class="side-head">
          <h3>买卖分布</h3>
          <div class="side-legend">
            <span><i class="buy" />买入（深色）</span>
            <span><i class="sell" />卖出（浅色）</span>
          </div>
        </div>

        <div class="bar-chart" role="img" aria-label="各选项大额买入和卖出成交量柱状图">
          <div class="bar-axis" aria-hidden="true">
            <span v-for="tick in axisTicks" :key="tick" class="num">{{ compactMoney(tick) }}</span>
          </div>
          <div class="bar-body">
            <div class="bar-grid" aria-hidden="true">
              <i v-for="tick in axisTicks" :key="tick" />
            </div>
            <div class="bar-groups" :style="{ gridTemplateColumns: `repeat(${distribution.length}, minmax(0, 1fr))` }">
              <div v-for="item in distribution" :key="item.sel" class="bar-group">
                <div class="bar-columns">
                  <i class="bar buy" :style="{ height: barHeight(item.buy), backgroundColor: item.color }" :title="`${item.label}买入 ${money(item.buy)}`" />
                  <i class="bar sell" :style="{ height: barHeight(item.sell), backgroundColor: item.lightColor }" :title="`${item.label}卖出 ${money(item.sell)}`" />
                </div>
                <span>{{ item.label }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.distribution-card {
  margin: 10px 12px 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  background: var(--panel);
  box-shadow: var(--card-shadow);
}

.distribution-head {
  display: flex;
  min-height: 42px;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--divider);
  background: linear-gradient(180deg, var(--brand-tint) 0%, var(--brand-tint-strong) 100%);
}

.distribution-head h2,
.distribution-grid h3 {
  margin: 0;
  letter-spacing: 0;
}

.distribution-head h2 {
  color: var(--brand-deep);
  font-size: 0.88rem;
  font-weight: 820;
}

.distribution-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}

.volume-view,
.side-view {
  min-width: 0;
  padding: 11px 12px 12px;
}

.side-view {
  border-top: 1px solid var(--divider);
}

.distribution-grid h3 {
  color: var(--ink);
  font-size: 0.78rem;
  font-weight: 800;
}

.volume-content {
  display: grid;
  grid-template-columns: 128px minmax(0, 1fr);
  align-items: center;
  gap: 16px;
  min-height: 182px;
  margin-top: 5px;
}

.donut {
  display: grid;
  width: 126px;
  aspect-ratio: 1;
  place-items: center;
  border-radius: 50%;
  transform: rotate(-90deg);
}

.donut-center {
  display: grid;
  width: 72%;
  aspect-ratio: 1;
  place-content: center;
  border-radius: 50%;
  background: var(--panel);
  text-align: center;
  transform: rotate(90deg);
  box-shadow: 0 0 0 1px var(--divider);
}

.donut-center strong {
  color: var(--ink);
  font-size: 1rem;
  line-height: 1.15;
}

.donut-center span {
  margin-top: 2px;
  color: var(--muted);
  font-size: 0.64rem;
  font-weight: 720;
}

.selection-legend {
  display: grid;
  gap: 7px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.selection-legend li {
  display: grid;
  grid-template-columns: 9px 36px minmax(48px, 1fr) 42px;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 0.7rem;
}

.selection-legend i,
.side-legend i {
  display: block;
  width: 9px;
  height: 9px;
  border-radius: 2px;
}

.selection-legend b {
  color: var(--ink);
  text-align: right;
  font-weight: 800;
}

.selection-legend em {
  color: var(--soft);
  text-align: right;
  font-style: normal;
  font-weight: 720;
}

.side-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.side-legend {
  display: flex;
  gap: 10px;
  color: var(--muted);
  font-size: 0.66rem;
  font-weight: 720;
}

.side-legend span {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.side-legend i.buy,
.side-legend i.sell {
  width: 14px;
}

.side-legend i.buy {
  background: linear-gradient(90deg, #d6324c 0 33%, #2e9c5f 33% 66%, #5b6fe8 66%);
}

.side-legend i.sell {
  background: linear-gradient(90deg, #ec8999 0 33%, #8bc8a5 33% 66%, #a8b2f2 66%);
}

.bar-chart {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr);
  height: 190px;
  margin-top: 9px;
}

.bar-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  height: 162px;
  padding-right: 6px;
  color: var(--soft);
  text-align: right;
  font-size: 0.58rem;
}

.bar-body {
  position: relative;
  min-width: 0;
  height: 190px;
}

.bar-grid {
  position: absolute;
  inset: 0 0 28px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
  border-left: 1px solid var(--line);
}

.bar-grid i {
  display: block;
  width: 100%;
  border-top: 1px solid var(--divider);
}

.bar-groups {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.bar-group {
  display: grid;
  grid-template-rows: 162px 28px;
  min-width: 0;
  text-align: center;
}

.bar-columns {
  display: flex;
  min-width: 0;
  align-items: flex-end;
  justify-content: center;
  gap: 5px;
  padding: 7px 8px 0;
}

.bar {
  display: block;
  width: min(26%, 28px);
  min-width: 9px;
  border-radius: 3px 3px 0 0;
  transition: height 0.18s ease;
}

.bar-group > span {
  align-self: center;
  overflow: hidden;
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 760;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (min-width: 768px) {
  .distribution-grid {
    grid-template-columns: minmax(300px, 0.8fr) minmax(400px, 1.2fr);
  }

  .side-view {
    border-top: 0;
    border-left: 1px solid var(--divider);
  }

  .volume-content {
    grid-template-columns: 142px minmax(0, 1fr);
  }

  .donut {
    width: 140px;
  }
}

@media (max-width: 380px) {
  .volume-content {
    grid-template-columns: 112px minmax(0, 1fr);
    gap: 10px;
  }

  .donut {
    width: 110px;
  }

  .selection-legend li {
    grid-template-columns: 8px 32px minmax(42px, 1fr);
  }

  .selection-legend em {
    display: none;
  }
}
</style>
