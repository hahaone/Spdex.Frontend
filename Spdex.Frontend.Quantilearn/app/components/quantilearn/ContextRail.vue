<script setup lang="ts">
import type { Component } from 'vue'
import {
  AlertTriangle,
  BarChart3,
  Clock,
  Flag,
  Layers,
  Pencil,
  Trophy,
  Workflow,
  XCircle,
  Zap,
} from '@lucide/vue'
import type { PermissionProfile, QuantModel, WorkspaceIcon, WorkspaceItem } from '~/data/quantilearnPrototype'
import { actionState } from '~/data/quantilearnPrototype'

defineProps<{
  model: QuantModel
  workspace: WorkspaceItem
  permissions: PermissionProfile
}>()

const iconMap: Record<WorkspaceIcon, Component> = {
  layers: Layers,
  workflow: Workflow,
  report: BarChart3,
  events: Zap,
  hall: Trophy,
}
</script>

<template>
  <aside class="context-rail">
    <section class="context-panel">
      <div class="panel-title">
        <div>
          <span class="eyebrow">Context</span>
          <h3>当前模型</h3>
        </div>
        <component :is="iconMap[workspace.icon]" :size="17" />
      </div>
      <div class="score-ring" :style="{ '--score': `${Math.round(model.distribution * 100)}%` }">
        <div>
          <strong class="num">{{ Math.round(model.distribution * 100) }}</strong>
          <span>Distribution</span>
        </div>
      </div>
      <div class="context-list">
        <div><span>最佳方向</span><strong>{{ model.bestSelection }}</strong></div>
        <div><span>平均赔率</span><strong class="num">{{ model.avgOdds.toFixed(2) }}</strong></div>
        <div><span>一年样本</span><strong class="num">{{ model.sample365 }}</strong></div>
        <div><span>订阅人数</span><strong class="num">{{ model.subscriptions }}</strong></div>
      </div>
    </section>

    <section class="context-panel">
      <div class="panel-title">
        <div>
          <span class="eyebrow">Guardrails</span>
          <h3>操作约束</h3>
        </div>
        <AlertTriangle :size="17" />
      </div>
      <div class="guard-list">
        <div :class="{ blocked: Boolean(actionState(model, 'edit', permissions)) }">
          <Pencil :size="14" />
          <span>编辑</span>
          <em>{{ actionState(model, 'edit', permissions) || '允许' }}</em>
        </div>
        <div :class="{ blocked: Boolean(actionState(model, 'publish', permissions)) }">
          <Flag :size="14" />
          <span>发布</span>
          <em>{{ actionState(model, 'publish', permissions) || '允许' }}</em>
        </div>
        <div :class="{ blocked: Boolean(actionState(model, 'unpublish', permissions)) }">
          <XCircle :size="14" />
          <span>取消发布</span>
          <em>{{ actionState(model, 'unpublish', permissions) || '允许' }}</em>
        </div>
      </div>
    </section>

    <section class="context-panel">
      <div class="panel-title">
        <div>
          <span class="eyebrow">Runtime</span>
          <h3>数据时效</h3>
        </div>
        <Clock :size="17" />
      </div>
      <div class="cache-stack">
        <div><span>我的模型</span><strong>30s</strong></div>
        <div><span>回测样本</span><strong>1h</strong></div>
        <div><span>当前赛事</span><strong>10s</strong></div>
        <div><span>模型广场</span><strong>10m</strong></div>
      </div>
    </section>
  </aside>
</template>

<style scoped>
.context-rail {
  display: grid;
  align-content: start;
  gap: 10px;
  min-width: 0;
}

.context-panel {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: var(--panel);
  box-shadow: var(--shadow);
}

.score-ring {
  display: grid;
  width: 118px;
  height: 118px;
  place-items: center;
  margin: 0 auto;
  border-radius: 999px;
  background:
    radial-gradient(circle at center, var(--panel) 0 58%, transparent 59%),
    conic-gradient(var(--teal) var(--score), #e8eef4 0);
}

.score-ring div {
  text-align: center;
}

.score-ring strong {
  display: block;
  font-size: 1.45rem;
  line-height: 1;
}

.score-ring span {
  color: var(--muted);
  font-size: 0.68rem;
}

.context-list,
.guard-list,
.cache-stack {
  display: grid;
  gap: 6px;
}

.context-list div,
.guard-list div,
.cache-stack div {
  display: grid;
  align-items: center;
  min-height: 30px;
  border-radius: 6px;
  background: var(--surface);
}

.context-list div,
.cache-stack div {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  padding: 0 8px;
}

.guard-list div {
  grid-template-columns: auto 58px minmax(0, 1fr);
  gap: 7px;
  padding: 0 8px;
  color: var(--teal);
}

.guard-list div.blocked {
  color: var(--rose);
}

.context-list span,
.cache-stack span,
.guard-list span,
.guard-list em {
  overflow: hidden;
  color: var(--muted);
  font-size: 0.73rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-list strong,
.cache-stack strong {
  font-size: 0.82rem;
}

.guard-list em {
  color: inherit;
  font-style: normal;
  text-align: right;
}
</style>
