<script setup lang="ts">
import { Activity, BarChart3, ChevronLeft, ChevronRight, Crown, Sparkles, Trophy, X } from '@lucide/vue'

const { open, dismiss } = useOnboarding()

const steps = [
  { icon: Sparkles, title: '今日异动指标', text: '首页实时聚合必发成交、必发指数、POLY 成交 / 指数与双红信号，点任意指标直达对应赛事筛选。' },
  { icon: Trophy, title: '赛事卡 · 中文呈现', text: '赛事卡显示中文队名、必发价位、大额成交与信号标签，点击进入完整指数详情。' },
  { icon: BarChart3, title: '走势图矩阵', text: '详情页走势图覆盖标盘 / 进球 / 让分 / 欧赔 等盘口 × 价位 / 指数 / 成交 / 凯利 等指标的完整组合。' },
  { icon: Activity, title: '实时赛事', text: '「实时赛事」只呈现 SPdex 赛程中正在进行的比赛；BSW / Poly 的数据在赛事详情里匹配呈现。' },
  { icon: Crown, title: '会员与夜间模式', text: '会员中心管理会籍与升级；右上角可一键切换日间 / 夜间模式。' },
]

const step = ref(0)
const isLast = computed(() => step.value === steps.length - 1)

watch(open, (v) => {
  if (v) step.value = 0
})

function next() {
  if (isLast.value) dismiss()
  else step.value += 1
}
function prev() {
  if (step.value > 0) step.value -= 1
}
</script>

<template>
  <Teleport to="body">
    <Transition name="ob-fade">
      <div v-if="open" class="ob-overlay" @click.self="dismiss">
        <div class="ob-card" role="dialog" aria-modal="true" aria-label="新手引导">
          <button class="ob-close focus-ring" aria-label="跳过引导" @click="dismiss">
            <X :size="18" />
          </button>

          <div class="ob-icon">
            <component :is="steps[step]!.icon" :size="30" />
          </div>
          <h2 class="ob-title">{{ steps[step]!.title }}</h2>
          <p class="ob-text">{{ steps[step]!.text }}</p>

          <div class="ob-dots" aria-hidden="true">
            <span v-for="(s, i) in steps" :key="i" :class="['ob-dot', { active: i === step }]" />
          </div>

          <div class="ob-actions">
            <button v-if="step > 0" class="ob-btn ghost focus-ring" @click="prev">
              <ChevronLeft :size="15" /> 上一步
            </button>
            <button v-else class="ob-btn ghost focus-ring" @click="dismiss">跳过</button>

            <button class="ob-btn primary focus-ring" @click="next">
              <template v-if="isLast">开始使用</template>
              <template v-else>下一步 <ChevronRight :size="15" /></template>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.ob-overlay {
  position: fixed;
  inset: 0;
  z-index: 200;
  display: grid;
  place-items: center;
  padding: 20px;
  background: rgba(8, 12, 20, 0.55);
  backdrop-filter: blur(2px);
}

.ob-card {
  position: relative;
  width: 100%;
  max-width: 340px;
  display: grid;
  gap: 10px;
  padding: 22px 20px 18px;
  text-align: center;
  background: var(--panel);
  color: var(--ink);
  border: 1px solid var(--line);
  border-radius: 14px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3);
}

.ob-close {
  position: absolute;
  top: 8px;
  right: 8px;
  display: inline-grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
}

.ob-icon {
  justify-self: center;
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 16px;
  background: var(--brand-tint);
  color: var(--brand);
}

.ob-title {
  margin: 2px 0 0;
  font-size: 1.06rem;
  font-weight: 820;
}

.ob-text {
  margin: 0;
  color: var(--muted);
  font-size: 0.84rem;
  line-height: 1.55;
}

.ob-dots {
  display: inline-flex;
  justify-content: center;
  gap: 6px;
  margin: 4px 0 2px;
}

.ob-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--line);
  transition: all 0.2s ease;
}

.ob-dot.active {
  width: 18px;
  border-radius: 3px;
  background: var(--brand);
}

.ob-actions {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.ob-btn {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 38px;
  border-radius: 9px;
  font-size: 0.86rem;
  font-weight: 780;
  border: 0;
  cursor: pointer;
}

.ob-btn.ghost {
  background: var(--surface);
  color: var(--muted);
}

.ob-btn.primary {
  background: var(--brand);
  color: #fff;
}

.ob-fade-enter-active,
.ob-fade-leave-active {
  transition: opacity 0.2s ease;
}

.ob-fade-enter-from,
.ob-fade-leave-to {
  opacity: 0;
}
</style>
