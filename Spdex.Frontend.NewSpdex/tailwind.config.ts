import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{vue,js,jsx,mjs,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      // Tokens resolve to CSS vars defined in app/assets/css/global.css
      // (:root = light, .dark = dark). One source of truth, theme-aware utilities.
      colors: {
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        soft: 'var(--soft)',
        panel: 'var(--panel)',
        line: 'var(--line)',
        divider: 'var(--divider)',
        surface: 'var(--surface)',
        canvas: 'var(--canvas)',
        brand: 'var(--brand)',
        'brand-deep': 'var(--brand-deep)',
        'brand-tint': 'var(--brand-tint)',
        accent: 'var(--accent)',
        'accent-deep': 'var(--accent-deep)',
        lavender: 'var(--lavender)',
        'lavender-strong': 'var(--lavender-strong)',
        'home-bg': 'var(--home-bg)',
        'home-strong': 'var(--home-strong)',
        'draw-bg': 'var(--draw-bg)',
        'draw-strong': 'var(--draw-strong)',
        'away-bg': 'var(--away-bg)',
        'away-strong': 'var(--away-strong)',
        buy: 'var(--buy)',
        sell: 'var(--sell)',
        pump: 'var(--pump)',
        up: 'var(--up)',
        down: 'var(--down)',
        warn: 'var(--warn)',
        signal: 'var(--signal)',
        member: 'var(--member)',
        quant: 'var(--quant)',
        poly: 'var(--poly)',
      },
      fontSize: {
        xxs: '0.66rem',
        xs: ['0.74rem', { lineHeight: '1.2' }],
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        elev: 'var(--shadow-elev)',
      },
    },
  },
  plugins: [],
} satisfies Config
