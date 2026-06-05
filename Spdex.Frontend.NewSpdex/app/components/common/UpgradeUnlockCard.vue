<script setup lang="ts">
import { ChevronRight, Lock } from '@lucide/vue'

// 把"未对当前会籍开放"的散落锁定卡合并成一张升级卡：
//   模糊预览骨架（示意有丰富数据，不伪造具体数值）+ 锁定项 chips + 升级 CTA。
//   variant=hero  ：大块居中，用于全锁（免费会籍）——主区不再散落空卡。
//   variant=inline：网格内整行合并条，用于部分解锁——只补一条，不松散。
withDefaults(defineProps<{
  features?: string[]
  variant?: 'hero' | 'inline'
  headline?: string
  subline?: string
}>(), {
  features: () => [],
  variant: 'inline',
  headline: '升级解锁更多数据',
  subline: '',
})
</script>

<template>
  <NuxtLink to="/account/upgrade" :class="['unlock-card', variant, 'focus-ring']" aria-label="升级会籍解锁更多数据">
    <!-- 模糊预览骨架（aria-hidden，纯装饰） -->
    <div class="pv" aria-hidden="true">
      <div class="pv-rows">
        <span
          v-for="i in (variant === 'hero' ? 5 : 3)"
          :key="i"
          class="pv-row"
          :style="{ width: `${52 + (i * 53 % 40)}%` }"
        />
      </div>
      <svg class="pv-spark" viewBox="0 0 120 40" preserveAspectRatio="none">
        <path d="M0 31 L18 24 L36 27 L54 13 L72 19 L90 7 L108 15 L120 10" fill="none" stroke="currentColor" stroke-width="2" />
      </svg>
    </div>

    <div class="ov">
      <span class="ov-badge"><Lock :size="variant === 'hero' ? 20 : 15" /></span>
      <div class="ov-text">
        <b class="ov-head">{{ headline }}</b>
        <span v-if="subline" class="ov-sub">{{ subline }}</span>
        <div v-if="features.length" class="ov-chips">
          <span v-for="f in features" :key="f" class="ov-chip">{{ f }}</span>
        </div>
      </div>
      <span class="ov-cta">
        <span>升级会籍</span>
        <ChevronRight :size="15" />
      </span>
    </div>
  </NuxtLink>
</template>

<style scoped>
.unlock-card {
  position: relative;
  display: block;
  overflow: hidden;
  border: 1px solid var(--brand-tint-strong);
  border-radius: 8px;
  background: var(--panel);
  isolation: isolate;
}

@media (hover: hover) {
  .unlock-card { transition: border-color 0.15s ease, box-shadow 0.15s ease; }
  .unlock-card:hover { border-color: var(--brand); box-shadow: 0 6px 18px rgba(124, 92, 250, 0.18); }
}

/* 模糊预览层 */
.pv {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 14px 16px;
  color: var(--brand);
  filter: blur(3px);
  opacity: 0.3;
  pointer-events: none;
}
.pv-rows { display: grid; gap: 9px; }
.pv-row {
  height: 11px;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--brand-tint-strong), var(--lavender-strong));
}
.pv-spark { width: 100%; height: 38px; margin-top: auto; opacity: 0.8; }

/* 前景内容（半透明面板做底，保证可读，主题感知） */
.ov {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px 16px;
  background: linear-gradient(180deg,
    color-mix(in srgb, var(--panel) 62%, transparent) 0%,
    color-mix(in srgb, var(--panel) 86%, transparent) 100%);
}

.ov-badge {
  display: inline-grid;
  flex: 0 0 auto;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--brand-tint);
  color: var(--brand-deep);
}

.ov-text { display: flex; flex: 1 1 auto; flex-direction: column; gap: 5px; min-width: 0; }
.ov-head { font-size: 0.9rem; font-weight: 840; color: var(--ink); }
.ov-sub { font-size: 0.76rem; font-weight: 700; color: var(--muted); }
.ov-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.ov-chip {
  padding: 1px 8px;
  border-radius: 999px;
  background: var(--brand-tint);
  color: var(--brand-deep);
  font-size: 0.7rem;
  font-weight: 760;
}

.ov-cta {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  padding: 7px 14px;
  border-radius: 6px;
  background: var(--brand);
  color: #fff;
  font-size: 0.82rem;
  font-weight: 820;
  white-space: nowrap;
}
.unlock-card:hover .ov-cta { background: var(--brand-deep); }

/* hero：大块居中（全锁/免费会籍） */
.unlock-card.hero .ov {
  flex-direction: column;
  flex-wrap: nowrap;
  justify-content: center;
  text-align: center;
  gap: 12px;
  padding: 30px 20px;
  min-height: 180px;
}
.unlock-card.hero .ov-badge { width: 48px; height: 48px; }
.unlock-card.hero .ov-text { flex: 0 0 auto; align-items: center; gap: 7px; }
.unlock-card.hero .ov-head { font-size: 1.1rem; }
.unlock-card.hero .ov-sub { font-size: 0.84rem; max-width: 30em; }
.unlock-card.hero .ov-chips { justify-content: center; }
.unlock-card.hero .ov-cta { margin-left: 0; padding: 9px 22px; font-size: 0.88rem; }
</style>
