<script setup lang="ts">
/**
 * 首页内联自定义面板：模块/指标 显隐+排序 + 4 指标自定义阈值。
 * 改动即时落 cookie + 防抖写后端（useHomeLayout.persist）。
 */
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, RotateCcw } from '@lucide/vue'
import type { HomeMetricId, HomeSectionId, HomeThresholds } from '~/composables/useHomeLayout'
import { THRESHOLD_BOUNDS } from '~/composables/useHomeLayout'

const { layout, editMode, toggleSection, moveSection, toggleMetric, moveMetric, setThreshold, reset } = useHomeLayout()

const SECTION_LABEL: Record<HomeSectionId, string> = {
  'big-trades': '🔥 大单',
  'metrics': '今日异动指标',
  'features': '快速入口',
  'info': '使用提示',
}
const METRIC_LABEL: Record<HomeMetricId, string> = {
  'bf-volume': '必发成交',
  'poly-volume': 'POLY成交',
  'bf-index': '必发指数',
  'poly-index': 'POLY指数',
  'double-red': '双红信号',
}

interface ThresholdItem { key: keyof HomeThresholds, label: string }
const THRESHOLD_ITEMS: ThresholdItem[] = [
  { key: 'bfVolume', label: '必发成交' },
  { key: 'polyVolume', label: 'POLY成交' },
  { key: 'bfIndex', label: '必发指数' },
  { key: 'polyIndex', label: 'POLY指数' },
]

function fmtThreshold(key: keyof HomeThresholds, v: number): string {
  if (key === 'bfVolume') return `${v / 10000}万`
  if (key === 'polyVolume') return `${v / 1000}K`
  return `${v}`
}
function bump(key: keyof HomeThresholds, dir: -1 | 1) {
  setThreshold(key, layout.value.thresholds[key] + dir * THRESHOLD_BOUNDS[key].step)
}
function atMin(key: keyof HomeThresholds) { return layout.value.thresholds[key] <= THRESHOLD_BOUNDS[key].min }
function atMax(key: keyof HomeThresholds) { return layout.value.thresholds[key] >= THRESHOLD_BOUNDS[key].max }

function done() { editMode.value = false }
</script>

<template>
  <div class="customizer">
    <div class="cz-head">
      <h2>自定义首页</h2>
      <span class="muted">显隐、排序、调阈值 — 改动即时生效</span>
    </div>

    <!-- 模块 -->
    <div class="cz-group">
      <div class="cz-group-title">模块（显隐 / 排序）</div>
      <div class="cz-list">
        <div
          v-for="(s, i) in layout.sections"
          :key="s.id"
          :class="['cz-row', { off: !s.visible }]"
        >
          <span class="cz-name">{{ SECTION_LABEL[s.id] }}</span>
          <div class="cz-ops">
            <button class="cz-mv focus-ring" :disabled="i === 0" aria-label="上移" @click="moveSection(s.id, -1)">
              <ChevronUp :size="16" />
            </button>
            <button class="cz-mv focus-ring" :disabled="i === layout.sections.length - 1" aria-label="下移" @click="moveSection(s.id, 1)">
              <ChevronDown :size="16" />
            </button>
            <button :class="['cz-eye focus-ring', { on: s.visible }]" :aria-label="s.visible ? '隐藏' : '显示'" @click="toggleSection(s.id)">
              <Eye v-if="s.visible" :size="16" />
              <EyeOff v-else :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 指标 -->
    <div class="cz-group">
      <div class="cz-group-title">异动指标（显隐 / 排序）</div>
      <div class="cz-list">
        <div
          v-for="(m, i) in layout.metrics"
          :key="m.id"
          :class="['cz-row', { off: !m.visible }]"
        >
          <span class="cz-name">{{ METRIC_LABEL[m.id] }}</span>
          <div class="cz-ops">
            <button class="cz-mv focus-ring" :disabled="i === 0" aria-label="上移" @click="moveMetric(m.id, -1)">
              <ChevronUp :size="16" />
            </button>
            <button class="cz-mv focus-ring" :disabled="i === layout.metrics.length - 1" aria-label="下移" @click="moveMetric(m.id, 1)">
              <ChevronDown :size="16" />
            </button>
            <button :class="['cz-eye focus-ring', { on: m.visible }]" :aria-label="m.visible ? '隐藏' : '显示'" @click="toggleMetric(m.id)">
              <Eye v-if="m.visible" :size="16" />
              <EyeOff v-else :size="16" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 阈值 -->
    <div class="cz-group">
      <div class="cz-group-title">指标阈值（达到才计入）</div>
      <div class="cz-list">
        <div v-for="t in THRESHOLD_ITEMS" :key="t.key" class="cz-row">
          <span class="cz-name">{{ t.label }}</span>
          <div class="cz-stepper">
            <button class="cz-step focus-ring" :disabled="atMin(t.key)" aria-label="减小" @click="bump(t.key, -1)">−</button>
            <b class="cz-val num">{{ fmtThreshold(t.key, layout.thresholds[t.key]) }}</b>
            <button class="cz-step focus-ring" :disabled="atMax(t.key)" aria-label="增大" @click="bump(t.key, 1)">+</button>
          </div>
        </div>
      </div>
    </div>

    <div class="cz-bar">
      <button class="cz-reset focus-ring" @click="reset">
        <RotateCcw :size="15" /> 重置默认
      </button>
      <button class="cz-done focus-ring" @click="done">
        <Check :size="16" /> 完成
      </button>
    </div>
  </div>
</template>

<style scoped>
.customizer {
  display: grid;
  gap: 12px;
  padding: 12px;
  padding-bottom: 76px; /* 给 sticky 操作条留位 */
}

.cz-head h2 {
  margin: 0;
  font-size: 0.96rem;
  font-weight: 840;
  color: var(--ink);
}
.cz-head .muted {
  font-size: 0.74rem;
  font-weight: 720;
}

.cz-group {
  display: grid;
  gap: 6px;
}

.cz-group-title {
  font-size: 0.78rem;
  font-weight: 800;
  color: var(--muted);
}

.cz-list {
  display: grid;
  gap: 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  overflow: hidden;
  background: var(--panel);
}

.cz-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 9px 11px;
  border-bottom: 1px solid var(--divider);
}
.cz-list .cz-row:last-child { border-bottom: none; }

.cz-row.off { opacity: 0.5; }

.cz-name {
  min-width: 0;
  overflow: hidden;
  font-size: 0.88rem;
  font-weight: 760;
  color: var(--ink);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.cz-ops {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.cz-mv,
.cz-eye {
  display: inline-grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--muted);
}
.cz-mv:disabled { opacity: 0.35; }
.cz-eye.on {
  border-color: var(--brand);
  background: var(--brand-tint);
  color: var(--brand-deep);
}

.cz-stepper {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.cz-step {
  display: inline-grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font-size: 1.1rem;
  font-weight: 800;
  line-height: 1;
}
.cz-step:disabled { opacity: 0.35; }

.cz-val {
  min-width: 56px;
  text-align: center;
  font-size: 0.92rem;
  font-weight: 820;
  color: var(--brand-deep);
}

.cz-bar {
  position: sticky;
  bottom: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 10px;
  margin: 4px -12px -12px;
  padding: 10px 12px;
  background: var(--panel);
  border-top: 1px solid var(--divider);
}

.cz-reset {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0 14px;
  height: 40px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--surface);
  color: var(--muted);
  font-size: 0.84rem;
  font-weight: 760;
}

.cz-done {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: var(--brand);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 820;
}

@media (min-width: 1024px) {
  .customizer {
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
  }
}
</style>
