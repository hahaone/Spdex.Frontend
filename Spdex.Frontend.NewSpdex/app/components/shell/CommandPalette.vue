<script setup lang="ts">
/**
 * ⌘K / Ctrl+K 命令面板：桌面快速跳转主导航 + 切换主题。
 * 纯前端、无后端依赖；Teleport 到 body 避免层级问题。
 */
import { ArrowRight, Search } from '@lucide/vue'

const { open, hide } = useCommandPalette()
const { isDark, toggle: toggleTheme } = useTheme()
const router = useRouter()

const q = ref('')
const active = ref(0)
const inputRef = ref<HTMLInputElement | null>(null)

interface Cmd { label: string, hint?: string, to?: string, action?: () => void }

const commands = computed<Cmd[]>(() => [
  { label: '首页 · 今日异动', to: '/' },
  { label: '今日足球', to: '/football' },
  { label: '今日篮球', to: '/basketball' },
  { label: '实时赛事', to: '/live' },
  { label: '信号雷达', to: '/signals' },
  { label: '消息推送', to: '/push' },
  { label: '会员中心', to: '/account' },
  { label: '升级会员', to: '/account/upgrade' },
  { label: isDark.value ? '切换到日间模式' : '切换到夜间模式', hint: '主题', action: () => toggleTheme() },
])

const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  if (!s) return commands.value
  return commands.value.filter(c => c.label.toLowerCase().includes(s))
})

watch(filtered, () => { active.value = 0 })

function run(c?: Cmd) {
  const cmd = c ?? filtered.value[active.value]
  if (!cmd) return
  hide()
  if (cmd.action) cmd.action()
  else if (cmd.to) router.push(cmd.to)
}

watch(open, async (v) => {
  if (v) {
    q.value = ''
    active.value = 0
    await nextTick()
    inputRef.value?.focus()
  }
})

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    open.value = !open.value
    return
  }
  if (!open.value)
    return
  if (e.key === 'Escape') {
    e.preventDefault()
    hide()
  }
  else if (e.key === 'ArrowDown') {
    e.preventDefault()
    active.value = Math.min(active.value + 1, filtered.value.length - 1)
  }
  else if (e.key === 'ArrowUp') {
    e.preventDefault()
    active.value = Math.max(active.value - 1, 0)
  }
  else if (e.key === 'Enter') {
    e.preventDefault()
    run()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="cmd-overlay" @click.self="hide">
      <div class="cmd-panel" role="dialog" aria-label="命令面板" aria-modal="true">
        <div class="cmd-search">
          <Search :size="16" />
          <input
            ref="inputRef"
            v-model="q"
            type="text"
            placeholder="跳转到… (足球 / 实时 / 会员)"
            aria-label="命令搜索"
          >
          <kbd>ESC</kbd>
        </div>
        <ul class="cmd-list">
          <li v-if="!filtered.length" class="cmd-empty">无匹配项</li>
          <li
            v-for="(c, i) in filtered"
            :key="c.label"
            :class="['cmd-item', { active: i === active }]"
            @click="run(c)"
            @mousemove="active = i"
          >
            <span>{{ c.label }}</span>
            <span v-if="c.hint" class="cmd-hint">{{ c.hint }}</span>
            <ArrowRight v-else :size="14" class="cmd-go" />
          </li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.cmd-overlay {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding-top: 12vh;
  background: rgba(15, 19, 26, 0.45);
  backdrop-filter: blur(2px);
}

.cmd-panel {
  width: min(560px, 92vw);
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 12px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.cmd-search {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 14px;
  border-bottom: 1px solid var(--divider);
  color: var(--muted);
}

.cmd-search input {
  flex: 1;
  border: 0;
  background: transparent;
  outline: none;
  color: var(--ink);
  font-size: 0.95rem;
  font-weight: 600;
}

.cmd-search kbd {
  padding: 1px 6px;
  border: 1px solid var(--line);
  border-radius: 4px;
  font-size: 0.66rem;
  font-weight: 700;
  color: var(--muted);
}

.cmd-list {
  list-style: none;
  margin: 0;
  padding: 6px;
  max-height: 56vh;
  overflow-y: auto;
}

.cmd-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 9px 12px;
  border-radius: 7px;
  cursor: pointer;
  color: var(--ink);
  font-size: 0.9rem;
  font-weight: 640;
}

.cmd-item.active {
  background: var(--brand-tint);
  color: var(--brand-deep);
}

.cmd-hint {
  font-size: 0.7rem;
  color: var(--muted);
}

.cmd-go {
  color: var(--brand);
}

.cmd-empty {
  padding: 16px;
  text-align: center;
  color: var(--muted);
  font-size: 0.85rem;
}
</style>
