import type { Config } from 'tailwindcss'

export default {
  content: ['./app/**/*.{vue,js,jsx,mjs,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1a2233',
        muted: '#6b7280',
        soft: '#9aa3b0',
        panel: '#ffffff',
        line: '#dde2eb',
        divider: '#eaeef4',
        surface: '#f3f6fb',
        canvas: '#eef1f6',
        brand: '#1a8cd3',
        'brand-deep': '#1672b3',
        'brand-tint': '#e2f1fa',
        accent: '#6e5aaf',
        'accent-deep': '#4f3f86',
        lavender: '#ece5f4',
        'lavender-strong': '#dcd2ed',
        'home-bg': '#dceefd',
        'home-strong': '#c4dff8',
        'draw-bg': '#e0f1e0',
        'draw-strong': '#c8e6c9',
        'away-bg': '#fff3d5',
        'away-strong': '#fce4a8',
        buy: '#d6324c',
        sell: '#2e9c5f',
        pump: '#06a7c1',
        up: '#2e9c5f',
        down: '#d6324c',
        warn: '#b08113',
        signal: '#c2410c',
        member: '#0f766e',
        quant: '#6e5aaf',
        poly: '#6e5aaf',
      },
      fontSize: {
        xxs: '0.66rem',
        xs: ['0.74rem', { lineHeight: '1.2' }],
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', '"SF Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        soft: '0 6px 18px rgba(26, 34, 51, 0.06)',
        elev: '0 2px 8px rgba(26, 34, 51, 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config
