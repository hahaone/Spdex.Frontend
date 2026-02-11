import type { Config } from 'tailwindcss'

export default {
  content: [],  // @nuxtjs/tailwindcss 模块自动扫描
  theme: {
    extend: {
      colors: {
        // 项目自定义语义色
        'sigma-3': '#ffe0e0',    // 3σ 高亮背景
        'sigma-2': '#fff4cc',    // 2σ 高亮背景
        'top2': '#dc2626',       // Top2 金额文字
        'back': '#dbeafe',       // Back 背景（蓝）
        'lay': '#fce7f3',        // Lay 背景（粉）
        // PMark 徽章色
        'pmark-ps': '#f59e0b',
        'pmark-p': '#ef4444',
        'pmark-p0': '#f97316',
        'pmark-p1': '#eab308',
        'pmark-p2': '#84cc16',
        'pmark-p6': '#14b8a6',
        'pmark-p12': '#06b6d4',
      },
      fontSize: {
        'xxs': '0.65rem',       // 超小号文字
      },
    },
  },
  plugins: [],
} satisfies Config
