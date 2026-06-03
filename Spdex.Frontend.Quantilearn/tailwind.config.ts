import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{vue,js,jsx,mjs,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        subtle: 'var(--subtle)',
        panel: 'var(--panel)',
        line: 'var(--line)',
        surface: 'var(--surface)',
        canvas: 'var(--canvas)',
        teal: 'var(--teal)',
        amber: 'var(--amber)',
        rose: 'var(--rose)',
        blue: 'var(--blue)',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config
