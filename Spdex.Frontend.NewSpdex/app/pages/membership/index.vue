<script setup lang="ts">
import { ArrowLeft, Crown } from '@lucide/vue'
import type { ApiResponse } from '~/types/auth'
import type { PaymentPlan } from '~/types/billing'

// 面向游客的公开「会籍权益说明」页：无需登录即可查看（见 middleware/auth.global PUBLIC_PATHS）。
// 套餐价格来自匿名只读接口；登录后可在「会员中心 → 升级会籍」选购套餐。
definePageMeta({ layout: false })

// 列顺序按价格由低到高：免费 < 专家 < 黄金 < 翡翠 < 红宝石 < 白金。
const tiers = [
  { label: '免费', roleId: 2 },
  { label: '专家', roleId: 4 },
  { label: '黄金', roleId: 10 },
  { label: '翡翠', roleId: 11 },
  { label: '红宝石', roleId: 12 },
  { label: '白金', roleId: 5 },
] as const
const fallbackMonthlyPrices: Record<number, number> = {
  2: 0,
  4: 288,
  10: 856,
  11: 988,
  12: 1888,
  5: 4888,
}
const benefitRows = [
  { feature: '基础赛事', free: '主流赛事', expert: '全部开放', gold: '全部开放', emerald: '全部开放', ruby: '全部开放', platinum: '全部开放' },
  { feature: '数据回查', free: '不可用', expert: '可用', gold: '可用', emerald: '可用', ruby: '可用', platinum: '可用' },
  { feature: '实时赛事', free: '不可用', expert: '开放', gold: '开放', emerald: '开放', ruby: '开放', platinum: '开放' },
  { feature: '经典版', free: '基础列表', expert: '走势图/明细', gold: '时光机/明细', emerald: '增强指数', ruby: '增强指数', platinum: '全量盘口' },
  { feature: '走势图', free: '未开放', expert: '标盘/指数', gold: '标盘/指数', emerald: '完整走势', ruby: '完整走势', platinum: '完整走势' },
  { feature: 'FlashQ', free: '不可用', expert: '20 锦囊/天', gold: '10 锦囊/天', emerald: '免费', ruby: '免费', platinum: '不限量' },
  { feature: 'Q 系统', free: '不可用', expert: '不可用', gold: '5 模型', emerald: '5 模型/进球均衡', ruby: '5 模型/内外盘', platinum: '10 模型/全量' },
  { feature: '比分/角球', free: '不可用', expert: '不可用', gold: '不可用', emerald: '不可用', ruby: '不可用', platinum: '开放' },
] as const

type BenefitRow = typeof benefitRows[number]
const cols: Array<keyof Omit<BenefitRow, 'feature'>> = ['free', 'expert', 'gold', 'emerald', 'ruby', 'platinum']

interface BackendPlans {
  plans: PaymentPlan[]
}

const config = useRuntimeConfig()
const { data: planResponse } = useFetch<ApiResponse<BackendPlans>>('/api/newspdex/billing/plans', {
  key: 'public-newspdex-billing-plans',
  baseURL: config.public.apiBase as string,
  credentials: 'include',
  headers: { 'X-Spdex-Frontend': 'newspdex' },
  server: false,
  lazy: true,
  timeout: 10_000,
})

const monthlyPrices = computed(() => {
  const prices = new Map<number, number>(Object.entries(fallbackMonthlyPrices).map(([roleId, price]) => [Number(roleId), price]))
  for (const plan of planResponse.value?.data?.plans ?? []) {
    const monthly = plan.prices.find(stage => Math.abs(stage.month - 1) < 0.001)
    if (monthly) prices.set(plan.roleId, monthly.price)
  }
  return prices
})

function formatMonthlyPrice(roleId: number): string {
  const price = monthlyPrices.value.get(roleId)
  if (price == null) return '—'
  return price === 0 ? '永久免费' : `¥${price.toLocaleString('zh-CN')}/月`
}
</script>

<template>
  <main class="membership-page">
    <section class="membership-panel">
      <NuxtLink to="/login" class="back focus-ring">
        <ArrowLeft :size="14" />
        <span>返回登录</span>
      </NuxtLink>

      <div class="brand-row">
        <span class="brand-text">SPdex</span>
        <span class="brand-sub">超级指数系统</span>
      </div>

      <div class="head">
        <h1><Crown :size="18" /> 会籍权益说明</h1>
        <p>按会籍由低到高对比各档开放能力，选择适合你的会员。</p>
      </div>

      <div class="benefits-scroll">
        <table>
          <thead>
            <tr>
              <th>能力</th>
              <th v-for="tier in tiers" :key="tier.roleId">{{ tier.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr class="price-row">
              <th>月费价格</th>
              <td v-for="tier in tiers" :key="tier.roleId">{{ formatMonthlyPrice(tier.roleId) }}</td>
            </tr>
            <tr v-for="row in benefitRows" :key="row.feature">
              <th>{{ row.feature }}</th>
              <td v-for="c in cols" :key="c">{{ row[c] }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <p class="note">登录后可在「会员中心 → 升级会籍」选择套餐并完成支付，会籍状态将自动刷新。</p>

      <div class="cta-row">
        <NuxtLink to="/register" class="cta primary focus-ring">免费注册</NuxtLink>
        <NuxtLink to="/login" class="cta ghost focus-ring">立即登录</NuxtLink>
      </div>
    </section>
  </main>
</template>

<style scoped>
.membership-page {
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 14px 40px;
  background: var(--app-bg, var(--surface));
}

.membership-panel {
  width: 100%;
  max-width: 880px;
  display: grid;
  gap: 12px;
  padding: 18px 18px 22px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--panel);
  box-shadow: 0 8px 30px rgba(26, 34, 51, 0.08);
}

.back {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 4px;
  color: var(--brand);
  font-size: 0.8rem;
  font-weight: 740;
  text-decoration: none;
}

.brand-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.brand-text {
  font-size: 1.3rem;
  font-weight: 860;
  color: var(--brand);
  letter-spacing: 0.01em;
}
.brand-sub { color: var(--muted); font-size: 0.82rem; font-weight: 740; }

.head h1 {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 4px;
  font-size: 1.04rem;
  font-weight: 840;
  color: var(--ink);
}
.head p { margin: 0; color: var(--muted); font-size: 0.82rem; font-weight: 700; }

.benefits-scroll {
  overflow-x: auto;
  border: 1px solid var(--line);
  border-radius: 6px;
}
.benefits-scroll table {
  width: 100%;
  min-width: 720px;
  border-collapse: collapse;
  font-size: 0.78rem;
}
.benefits-scroll th,
.benefits-scroll td {
  padding: 9px 10px;
  border-top: 1px solid var(--line);
  text-align: right;
  white-space: nowrap;
}
.benefits-scroll thead th {
  border-top: 0;
  background: var(--surface);
  color: var(--muted);
  font-weight: 800;
}
.benefits-scroll th:first-child,
.benefits-scroll td:first-child { text-align: left; }
.benefits-scroll tbody th { color: var(--ink); font-weight: 820; }
.benefits-scroll .price-row th,
.benefits-scroll .price-row td {
  color: var(--brand-deep);
  background: color-mix(in srgb, var(--brand) 7%, var(--panel));
  font-weight: 840;
}

.note {
  margin: 0;
  color: var(--muted);
  font-size: 0.76rem;
  font-weight: 700;
  line-height: 1.5;
}

.cta-row {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
.cta {
  flex: 1 1 160px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 10px 16px;
  border-radius: 7px;
  font-size: 0.9rem;
  font-weight: 820;
  text-decoration: none;
}
.cta.primary { background: var(--brand); color: #fff; }
.cta.primary:hover { background: var(--brand-deep); }
.cta.ghost { border: 1px solid var(--line); background: var(--panel); color: var(--ink); }
.cta.ghost:hover { border-color: var(--brand); color: var(--brand); }
</style>
