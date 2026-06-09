<script setup lang="ts">
import { ChevronDown, ChevronUp, Zap } from '@lucide/vue'
import type { RouteLocationRaw } from 'vue-router'
import type { MatchSummary } from '~/types/match'

const props = withDefaults(defineProps<{
  match: MatchSummary
  selected: boolean
  collapsed: boolean
  detailTo: RouteLocationRaw
  twoWay?: boolean
  showFlashQ?: boolean
  sport?: 'football' | 'basketball'
}>(), {
  twoWay: false,
  showFlashQ: true,
  sport: 'football',
})

const emit = defineEmits<{
  toggleSelected: [eventId: number]
  toggleCollapsed: [eventId: number]
}>()

const { buildFlashQLink } = useFlashQLink()
const { canOpenFlashQ, flashQLockMessage } = useFlashQAccess()

// 视口门控:赛事块滚近视口才置 visible(置后停止观察,保留图表/补全状态)。
// visible 驱动「整行补全(enrich)」与「内嵌走势图」的懒加载,避免整页 N 场并发拉详情。
const rootEl = ref<HTMLElement | null>(null)
const visible = ref(false)
const chartAreaRef = ref<{ showTips: () => void } | null>(null)
const eventIdRef = computed(() => props.match.eventId)
const active = computed(() => visible.value && !props.collapsed)
const { enrich } = useClassicMatchEnrich(eventIdRef, active)

let io: IntersectionObserver | null = null
onMounted(() => {
  if (!rootEl.value || typeof IntersectionObserver === 'undefined') {
    visible.value = true
    return
  }
  io = new IntersectionObserver((entries) => {
    if (entries.some(e => e.isIntersecting)) {
      visible.value = true
      io?.disconnect()
      io = null
    }
  }, { rootMargin: '300px 0px' })
  io.observe(rootEl.value)
})
onBeforeUnmount(() => { io?.disconnect(); io = null })

const kickOff = computed(() => props.match.matchTime.slice(11, 16))
// 竞彩场次序号补足 3 位(对齐旧站「第 001 场」);足彩序号不补位。
const jcOrderText = computed(() => String(props.match.jcOrder ?? 0).padStart(3, '0'))
// 未开赛不显示比分(原来固定 0-0);已开赛/已结束才显示。进行中额外显示近似进行时间(后端 liveMinute)。
const scoreText = computed(() => (props.match.status === 'upcoming' ? '' : (props.match.scoreText || '')))
// 半场比分(回查/已结束多有值):非空才显,拼成 全场(半场) 如 2-1(0-0);无源不补(铁律)。
const halfText = computed(() => (props.match.status === 'upcoming' ? '' : (props.match.halfScoreText || '')))
const liveMinute = computed(() => props.match.liveMinute || '')
const totalTurnover = computed(() => Math.round(props.match.bfAmount ?? 0).toLocaleString('en-US'))
const goalsTotal = computed(() => {
  const v = props.match.goalsAmount ?? [0, 0]
  const total = v[0] + v[1]
  return total > 0 ? Math.round(total).toLocaleString('en-US') : '0'
})
const handicapTotal = computed(() => {
  const t = enrich.value?.handicapTotal ?? 0
  return t > 0 ? Math.round(t).toLocaleString('en-US') : '-'
})
const flashQUrl = computed(() => buildFlashQLink(props.match.eventId))
const bigBetText = computed(() => {
  if (!props.match.bigBetSide) return '最大单注 -'
  const o = props.match.bigBetOdds ? `@${props.match.bigBetOdds.toFixed(2)}` : ''
  const amount = props.match.bigBetAmount ? Math.round(props.match.bigBetAmount).toLocaleString('en-US') : '-'
  return `最大单注 ${props.match.bigBetSide}${o} ${props.match.bigBetAttr || ''} ${amount}`
})
</script>

<template>
  <article ref="rootEl" class="classic-match-card">
    <header class="classic-card-head">
      <label class="select-cell" :aria-label="`选择 ${match.homeTeam} 对 ${match.awayTeam}`">
        <input type="checkbox" :checked="selected" @change="emit('toggleSelected', match.eventId)">
      </label>

      <div class="head-main">
        <span class="league">{{ match.leagueCode || match.leagueName }}</span>
        <span class="teams">{{ match.homeTeam }} <b>VS</b> {{ match.awayTeam }}</span>
        <span v-if="match.sfcOrder" class="lottery-tag sfc">足彩 {{ match.sfcIssue }} 期 第 {{ match.sfcOrder }} 场</span>
        <span v-if="match.jcOrder" class="lottery-tag jc">竞彩 {{ match.jcIssue }} 期 第 {{ jcOrderText }} 场</span>
      </div>

      <div class="head-meta">
        <a v-if="showFlashQ && canOpenFlashQ" :href="flashQUrl" class="flashq-inline" aria-label="使用闪Q分析">
          <Zap :size="12" /><span>闪Q</span>
        </a>
        <button v-else-if="showFlashQ" type="button" class="flashq-inline locked" :title="flashQLockMessage" aria-label="免费版暂未开放闪Q" disabled>
          <Zap :size="12" /><span>闪Q</span>
        </button>
        <span class="num">开赛时间：{{ match.matchTime.slice(0, 10).replaceAll('-', '/') }} {{ kickOff }}</span>
        <span v-if="liveMinute" class="live-min num" title="近似进行时间(开赛至今;精确分钟见实时赛事)">{{ liveMinute }}</span>
        <span v-if="scoreText" class="score num">{{ scoreText }}<template v-if="halfText">({{ halfText }})</template></span>
      </div>

      <button type="button" class="collapse-btn" :aria-label="collapsed ? '展开赛事' : '收起赛事'" @click="emit('toggleCollapsed', match.eventId)">
        <ChevronDown v-if="collapsed" :size="15" />
        <ChevronUp v-else :size="15" />
      </button>
    </header>

    <template v-if="!collapsed">
      <ClassicMatchMetricGrid :match="match" :enrich="enrich" :two-way="twoWay" />

      <div class="classic-total-row">
        <span class="tips-trigger" role="button" tabindex="0" title="查看交易所重大成交提示" @click="chartAreaRef?.showTips()" @keydown.enter="chartAreaRef?.showTips()">交易所重大成交提示</span>
        <span>标盘总成交：<b class="num">{{ totalTurnover }}</b></span>
        <span>进球总成交：<b class="num">{{ goalsTotal }}</b></span>
        <span>让分总成交：<b class="num">{{ handicapTotal }}</b></span>
        <span>{{ bigBetText }}</span>
      </div>

      <ClassicMatchChartArea
        v-if="visible"
        ref="chartAreaRef"
        :event-id="match.eventId"
        :home-team="match.homeTeam"
        :away-team="match.awayTeam"
        :detail-to="detailTo"
        :sport="sport"
      />
    </template>
  </article>
</template>

<style scoped>
.classic-match-card {
  border: 1px solid var(--classic-border);
  border-radius: var(--classic-radius);
  overflow: hidden;
  background: var(--classic-panel);
  box-shadow: var(--classic-shadow);
}

.classic-card-head {
  display: grid;
  grid-template-columns: 26px minmax(0, 1fr) auto 28px;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 8px;
  background: var(--classic-title);
  color: #fff;
  font-size: 0.78rem;
  font-weight: 800;
}

.select-cell {
  display: grid;
  place-items: center;
}

.select-cell input {
  width: 14px;
  height: 14px;
  margin: 0;
}

.head-main,
.head-meta {
  display: inline-flex;
  align-items: center;
  min-width: 0;
}

.head-main {
  gap: 8px;
}

.league {
  color: #e8e8e8;
  white-space: nowrap;
}

.teams {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.teams b {
  margin: 0 3px;
  color: #fff;
}

.mini-tag {
  flex: 0 0 auto;
  padding: 1px 5px;
  border-radius: 2px;
  background: var(--classic-green);
  color: #fff;
  font-size: 0.68rem;
}

/* 竞彩/足彩 期号+序号标签(对齐旧站):竞彩绿、足彩金,深色头部上清晰可读。 */
.lottery-tag {
  flex: 0 0 auto;
  white-space: nowrap;
  font-size: 0.68rem;
  font-weight: 760;
}

.lottery-tag.jc {
  color: #9bf0b9;
}

.lottery-tag.sfc {
  color: #ffd479;
}

.head-meta {
  gap: 10px;
  color: var(--classic-title-muted);
  white-space: nowrap;
}

.score {
  color: #9bf0b9;
}

/* 进行中近似进行时间:红色,深/浅卡头均可见。 */
.live-min {
  color: #ff8a8a;
  font-weight: 800;
}

/* 闪Q 入口:置于卡片标题「开赛时间」左侧的小号品牌黄按钮,各屏宽常驻。 */
.flashq-inline {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  border: 0;
  border-radius: 3px;
  /* 固定亮金(不用 var(--classic-yellow):深色主题下它是暗橄榄 #5a4d18,与深色卡头撞色看不见)。 */
  background: #f6c343;
  color: #1f2430;
  font-size: 0.7rem;
  font-weight: 840;
  cursor: pointer;
}

.flashq-inline.locked {
  opacity: 0.6;
  cursor: not-allowed;
}

.collapse-btn {
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.classic-total-row {
  display: grid;
  grid-template-columns: 1.1fr 1fr 1fr 1fr 1.4fr;
  min-height: 28px;
  /* #4 与上方网格末行(白色队名)之间补分隔线,避免两段白底糊在一起。 */
  border-top: 1px solid var(--classic-grid);
  border-right: 1px solid var(--classic-grid);
  border-bottom: 2px solid var(--classic-green);
  border-left: 1px solid var(--classic-grid);
  color: var(--classic-text);
  font-size: 0.76rem;
  font-weight: 760;
}

.classic-total-row span {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 8px;
  border-right: 1px solid var(--classic-grid);
}

/* 「交易所重大成交提示」可点击,触发图表区显示重大成交提示(替代原图表区按钮)。 */
.tips-trigger {
  cursor: pointer;
  color: var(--classic-link);
}

.tips-trigger:hover {
  text-decoration: underline;
}

.classic-total-row span:last-child {
  border-right: 0;
}

.classic-total-row b {
  color: var(--accent-deep);
  font-size: 0.86rem;
}

@media (max-width: 1320px) {
  .classic-card-head {
    grid-template-columns: 24px minmax(0, 1fr) auto 28px;
  }
}
</style>
