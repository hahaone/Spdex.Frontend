<script setup lang="ts">
import { ArrowRight, Bot, ChevronRight, Crown, Lock, Sparkles, TrendingUp } from '@lucide/vue'

const today = new Date().toISOString().slice(0, 10).replace(/-/g, '/')

const { metrics, bigTradesTicker, prematchSixHourLockApplied, pending } = useDashboardMetrics()

function tickerSideClass(selection: string): string {
  if (selection.includes('主')) return 'side-home'
  if (selection.includes('客')) return 'side-away'
  if (selection.includes('平')) return 'side-draw'
  return 'side-mute'
}
const { user, tier } = useAuth()

const tierLabel: Record<string, string> = {
  Free: '免费版',
  Expert: '专家版',
  Gold: '黄金版',
  Emerald: '翡翠版',
  Ruby: '红宝石版',
  Platinum: '白金版',
}

const tierDisplay = computed(() => tierLabel[tier.value] ?? tier.value)
const endDateDisplay = computed(() => {
  const raw = user.value?.endDate
  if (!raw) return '永久'
  return raw.slice(0, 10)
})
const showUpgradeCta = computed(() => tier.value === 'Free' || tier.value === 'Expert')

const featureCards = [
  { id: 'football', title: '今日足球', subtitle: '今日重点赛事 · 异动 + 双红', to: '/football', icon: TrendingUp, tone: 'ink' },
  { id: 'live', title: '实时赛事', subtitle: '进行中赛事 · 现场赔率 + 赛况', to: '/live', icon: Sparkles, tone: 'signal' },
]
</script>

<template>
  <div class="home-page">
    <section class="hero">
      <div class="hero-row">
        <span class="hero-title">超级指数 · 今日异动</span>
        <span class="hero-date num">{{ today }}</span>
      </div>
      <div class="hero-meta">
        <span>POLY · 必发 · 双红 · 让分 · 进球</span>
      </div>
    </section>

    <section v-if="bigTradesTicker.length" class="ticker-band">
      <span class="ticker-label">🔥 大单</span>
      <div class="ticker-scroll scrollbar-none">
        <NuxtLink
          v-for="t in bigTradesTicker"
          :key="`${t.eventId}-${t.timeText}`"
          :to="`/football/${t.eventId}`"
          :class="['ticker-item', tickerSideClass(t.selection)]"
          :title="`${t.homeTeam} vs ${t.awayTeam} ${t.attr}`"
        >
          <span class="t-amount num">{{ t.amountText }}</span>
          <span class="t-side">{{ t.selection }}</span>
          <span class="t-odds num">@{{ t.odds.toFixed(2) }}</span>
          <span class="t-time num">{{ t.timeText }}</span>
        </NuxtLink>
      </div>
    </section>

    <div class="home-grid">
      <section class="col-metrics">
        <div class="col-head">
          <h2>今日异动指标</h2>
          <span class="muted">点击进入对应筛选</span>
        </div>
        <div v-if="prematchSixHourLockApplied" class="lock-banner">
          <Lock :size="13" />
          <span>免费会员已隐去赛前 6 小时内的未开赛赛事</span>
        </div>

        <div class="metric-list">
          <div v-if="pending && !metrics.length" class="metric-skeleton">
            <div v-for="i in 5" :key="i" class="skeleton-row" />
          </div>

          <NuxtLink
            v-for="item in metrics"
            v-else
            :key="item.id"
            :to="item.to"
            :class="['metric-row focus-ring', item.tone, { 'is-pending': item.status === 'pending' }]"
          >
            <div class="metric-left">
              <span class="metric-dot" />
              <strong>{{ item.title }}</strong>
              <span v-if="item.threshold" class="threshold num">{{ item.threshold }}</span>
              <span v-if="item.status === 'pending'" class="pending-tag">待接入</span>
            </div>
            <b class="metric-count num">{{ item.status === 'pending' ? '—' : item.count }}</b>
            <ChevronRight :size="16" />
          </NuxtLink>
        </div>
      </section>

      <section class="col-features">
        <div class="col-head">
          <h2>快速入口</h2>
          <span class="muted">高频访问的赛事工作台</span>
        </div>
        <div class="feature-grid">
          <NuxtLink
            v-for="card in featureCards"
            :key="card.id"
            :to="card.to"
            :class="['feature-card focus-ring', card.tone]"
          >
            <component :is="card.icon" :size="20" stroke-width="2.2" />
            <div class="feature-text">
              <b>{{ card.title }}</b>
              <span>{{ card.subtitle }}</span>
            </div>
            <ArrowRight :size="16" />
          </NuxtLink>
        </div>

        <div class="info-card">
          <div class="info-head">
            <span class="dot brand" />
            <h3>使用提示</h3>
          </div>
          <ul>
            <li>指标行右侧的数字 = 当前可看赛事数</li>
            <li>上半场进球模型每 30 秒扫描，命中赛事进入"双红"指标</li>
            <li>会员等级影响推送数量与现场大单可见度</li>
          </ul>
        </div>
      </section>

      <section class="col-ai">
        <div class="col-head">
          <h2>会员中心</h2>
          <span class="muted">当前 {{ tierDisplay }} · 到期 {{ endDateDisplay }}</span>
        </div>

        <NuxtLink v-if="showUpgradeCta" to="/account/upgrade" class="upgrade-box focus-ring">
          <span class="upgrade-icon">
            <Crown :size="20" />
          </span>
          <div class="upgrade-text">
            <b>升级解锁全部能力</b>
            <span>黄金及以上享时光机 / 让分异动 / 优惠付费闪Q</span>
          </div>
          <ChevronRight :size="16" />
        </NuxtLink>

        <NuxtLink to="/account" class="account-box focus-ring">
          <span class="account-icon">
            <Bot :size="20" />
          </span>
          <div class="account-text">
            <b>{{ tierDisplay }}</b>
            <span>查看锦囊余额 / 订单历史</span>
          </div>
          <ChevronRight :size="16" />
        </NuxtLink>

        <div class="info-card">
          <div class="info-head">
            <span class="dot brand" />
            <h3>会员权益速览</h3>
          </div>
          <ul>
            <li>免费版：基础数据 + 20 锦囊/天</li>
            <li>专家版：冷热指数 + 亚指 + 走势图</li>
            <li>黄金以上：时光机、独立 Q 系统、必发明细</li>
          </ul>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.home-page {
  display: grid;
}

.hero {
  padding: 10px 12px;
  background: linear-gradient(120deg, var(--brand) 0%, var(--brand-deep) 60%, var(--accent-deep) 100%);
  color: #fff;
}

.hero-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
}

.hero-title {
  font-size: 0.92rem;
  font-weight: 820;
  letter-spacing: 0.02em;
}

.hero-date {
  opacity: 0.88;
  font-size: 0.8rem;
  font-weight: 720;
}

.hero-meta {
  margin-top: 4px;
  opacity: 0.82;
  font-size: 0.76rem;
  font-weight: 720;
}

.ticker-band {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 7px;
  padding: 6px 9px;
  background: var(--away-bg);
  border-bottom: 1px solid var(--away-strong);
}

.ticker-label {
  padding: 1px 6px;
  border-radius: 2px;
  background: #c46613;
  color: #fff;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.02em;
}

.ticker-scroll {
  display: flex;
  overflow-x: auto;
  gap: 6px;
}

.ticker-item {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid transparent;
  border-radius: 3px;
  font-size: 0.72rem;
  font-weight: 760;
  text-decoration: none;
  white-space: nowrap;
}

.ticker-item.side-home { background: var(--brand-tint); color: var(--brand-deep); border-color: #b8d8eb; }
.ticker-item.side-away { background: var(--away-bg); color: var(--warn); border-color: var(--away-strong); }
.ticker-item.side-draw { background: var(--canvas); color: var(--muted); border-color: var(--line); }
.ticker-item.side-mute { background: var(--surface); color: var(--muted); border-color: var(--line); }

.t-amount { font-weight: 820; }
.t-side { padding: 0 4px; border-radius: 2px; background: rgba(255,255,255,0.6); font-weight: 800; }
.t-odds { opacity: 0.86; }
.t-time { opacity: 0.7; font-size: 0.68rem; }

.home-grid {
  display: grid;
  gap: 8px;
  padding: 10px 12px 16px;
}

.col-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}

.col-head h2 {
  margin: 0;
  font-size: 0.88rem;
  font-weight: 820;
  color: var(--ink);
}

.col-head .muted {
  font-size: 0.74rem;
  font-weight: 720;
}

/* col-metrics */
.metric-list {
  display: grid;
  gap: 6px;
}

.metric-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  min-height: 50px;
  gap: 8px;
  padding: 8px 10px 8px 12px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
  box-shadow: 0 2px 6px rgba(26, 34, 51, 0.05);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.metric-row:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(26, 34, 51, 0.10);
}

.metric-left {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 8px;
}

.metric-dot {
  flex: 0 0 auto;
  align-self: center;
  width: 6px;
  height: 22px;
  border-radius: 1px;
}

.metric-row.bf .metric-dot {
  background: var(--brand);
}

.metric-row.poly .metric-dot {
  background: var(--accent);
}

.metric-row.index .metric-dot {
  background: var(--sell);
}

.metric-row.signal .metric-dot {
  background: var(--buy);
}

.metric-row strong {
  min-width: 0;
  overflow: hidden;
  font-size: 0.96rem;
  font-weight: 800;
  letter-spacing: 0.02em;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.threshold {
  padding: 1px 5px;
  border-radius: 2px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.72rem;
  font-weight: 720;
  white-space: nowrap;
}

.metric-count {
  min-width: 30px;
  text-align: right;
  font-size: 1.3rem;
  font-weight: 860;
  color: var(--ink);
}

.metric-row.signal .metric-count {
  color: var(--buy);
}

.metric-row.is-pending {
  opacity: 0.62;
}

.metric-row.is-pending .metric-count {
  color: var(--soft);
}

.metric-row svg {
  color: var(--soft);
}

.pending-tag {
  padding: 1px 5px;
  border-radius: 2px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.68rem;
  font-weight: 720;
}

.lock-banner {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-bottom: 8px;
  padding: 5px 9px;
  border: 1px solid var(--away-strong);
  border-radius: 4px;
  background: var(--away-bg);
  color: #8a6212;
  font-size: 0.74rem;
  font-weight: 720;
}

.metric-skeleton {
  display: grid;
  gap: 6px;
}

.skeleton-row {
  height: 50px;
  border: 1px solid var(--divider);
  border-radius: 5px;
  background: linear-gradient(90deg, var(--surface) 0%, var(--divider) 50%, var(--surface) 100%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
}

@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* col-features */
.feature-grid {
  display: grid;
  gap: 8px;
}

.feature-card {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) 16px;
  align-items: center;
  gap: 10px;
  padding: 11px 12px;
  border-radius: 5px;
  color: #fff;
  box-shadow: 0 3px 10px rgba(26, 34, 51, 0.10);
  transition: transform 0.12s ease;
}

.feature-card:hover {
  transform: translateY(-1px);
}

.feature-card.ink {
  background: linear-gradient(120deg, #1a2233 0%, #2b3548 100%);
}

.feature-card.signal {
  background: linear-gradient(120deg, #c2410c 0%, #9a3409 100%);
}

.feature-card svg {
  flex: 0 0 auto;
  padding: 7px;
  width: 36px;
  height: 36px;
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.18);
}

.feature-text {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.feature-text b {
  font-size: 0.95rem;
  font-weight: 820;
  letter-spacing: 0.02em;
}

.feature-text span {
  opacity: 0.86;
  font-size: 0.74rem;
  font-weight: 720;
}

.info-card {
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid var(--line);
  border-radius: 5px;
  background: var(--panel);
}

.info-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.info-head .dot {
  width: 4px;
  height: 14px;
  border-radius: 1px;
}

.info-head .dot.brand {
  background: var(--brand);
}

.info-head h3 {
  margin: 0;
  font-size: 0.82rem;
  font-weight: 800;
}

.info-card ul {
  display: grid;
  gap: 4px;
  margin: 0;
  padding-left: 14px;
  color: var(--muted);
  font-size: 0.78rem;
  font-weight: 720;
  line-height: 1.45;
}

/* col-ai (现为会员中心) */
.upgrade-box,
.account-box {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-radius: 5px;
  color: var(--ink);
  text-decoration: none;
}

.upgrade-box {
  margin-bottom: 8px;
  border: 1px solid #c8a64b;
  background: linear-gradient(180deg, var(--away-bg) 0%, var(--panel) 100%);
  box-shadow: 0 3px 10px rgba(0, 0, 0, 0.12);
}

.account-box {
  border: 1px solid var(--lavender-strong);
  background: linear-gradient(180deg, var(--lavender) 0%, var(--panel) 100%);
}

.upgrade-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 5px;
  background: #c8a64b;
  color: #fff;
}

.account-icon {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border-radius: 5px;
  background: var(--accent);
  color: #fff;
}

.upgrade-text,
.account-text {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.upgrade-text b {
  font-size: 0.92rem;
  font-weight: 820;
  color: #8a6212;
}

.account-text b {
  font-size: 0.92rem;
  font-weight: 820;
  color: var(--accent-deep);
}

.upgrade-text span,
.account-text span {
  font-size: 0.72rem;
  font-weight: 720;
  color: var(--muted);
}

@media (min-width: 1024px) {
  .hero {
    border-radius: 8px;
    margin-top: 16px;
    padding: 18px 22px;
  }

  .hero-title {
    font-size: 1.06rem;
  }

  .hero-date,
  .hero-meta {
    font-size: 0.86rem;
  }

  .home-grid {
    grid-template-columns: 1.05fr 1fr 1fr;
    gap: 16px;
    padding: 16px 0 32px;
  }

  .col-head h2 {
    font-size: 0.96rem;
  }
}

@media (min-width: 768px) and (max-width: 1023px) {
  .home-grid {
    grid-template-columns: 1fr 1fr;
  }

  .col-ai {
    grid-column: span 2;
  }
}
</style>
