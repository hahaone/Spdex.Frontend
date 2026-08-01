import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{vue,js,jsx,mjs,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        soft: 'var(--soft)',
        panel: 'var(--panel)',
        line: 'var(--line)',
        canvas: 'var(--canvas)',
        accent: 'var(--accent)',
        'accent-strong': 'var(--accent-strong)',
        amber: 'var(--amber)',
        plum: 'var(--plum)',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        page: '0 10px 30px rgba(20, 32, 46, 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config
