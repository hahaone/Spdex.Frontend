import type { ChartPoint } from '~/types/market'

export const chartSeries: ChartPoint[] = [
  { time: '12:00', home: 3.9, draw: 3.1, away: 1.92, volume: 18 },
  { time: '13:00', home: 3.72, draw: 3.18, away: 1.98, volume: 36 },
  { time: '14:00', home: 3.63, draw: 3.22, away: 2.06, volume: 22 },
  { time: '15:00', home: 3.55, draw: 3.2, away: 2.08, volume: 44 },
  { time: '16:00', home: 3.5, draw: 3.2, away: 2.0, volume: 61 },
  { time: '17:00', home: 3.44, draw: 3.16, away: 2.12, volume: 28 },
  { time: '18:00', home: 3.52, draw: 3.26, away: 2.02, volume: 40 },
]

export const chartSeriesAlt: Record<string, ChartPoint[]> = {
  'trending-down': [
    { time: '10:00', home: 4.6, draw: 3.4, away: 1.78, volume: 12 },
    { time: '11:00', home: 4.4, draw: 3.36, away: 1.82, volume: 18 },
    { time: '12:00', home: 4.2, draw: 3.32, away: 1.86, volume: 22 },
    { time: '13:00', home: 3.95, draw: 3.28, away: 1.92, volume: 34 },
    { time: '14:00', home: 3.7, draw: 3.24, away: 1.98, volume: 48 },
    { time: '15:00', home: 3.5, draw: 3.2, away: 2.05, volume: 72 },
    { time: '16:00', home: 3.32, draw: 3.18, away: 2.12, volume: 56 },
  ],
  'trending-up': [
    { time: '10:00', home: 2.4, draw: 3.1, away: 3.0, volume: 16 },
    { time: '11:00', home: 2.55, draw: 3.12, away: 2.86, volume: 22 },
    { time: '12:00', home: 2.7, draw: 3.16, away: 2.7, volume: 30 },
    { time: '13:00', home: 2.85, draw: 3.18, away: 2.58, volume: 42 },
    { time: '14:00', home: 3.0, draw: 3.2, away: 2.46, volume: 58 },
    { time: '15:00', home: 3.18, draw: 3.22, away: 2.32, volume: 74 },
    { time: '16:00', home: 3.4, draw: 3.24, away: 2.18, volume: 64 },
  ],
  'volatile': [
    { time: '10:00', home: 2.8, draw: 3.2, away: 2.6, volume: 24 },
    { time: '11:00', home: 3.4, draw: 3.4, away: 2.2, volume: 88 },
    { time: '12:00', home: 2.6, draw: 3.1, away: 2.8, volume: 32 },
    { time: '13:00', home: 3.2, draw: 3.3, away: 2.3, volume: 68 },
    { time: '14:00', home: 2.7, draw: 3.0, away: 2.7, volume: 40 },
    { time: '15:00', home: 3.6, draw: 3.5, away: 2.0, volume: 96 },
    { time: '16:00', home: 3.0, draw: 3.2, away: 2.5, volume: 52 },
  ],
  'low-volume': [
    { time: '10:00', home: 3.05, draw: 3.18, away: 2.4, volume: 4 },
    { time: '11:00', home: 3.08, draw: 3.16, away: 2.42, volume: 6 },
    { time: '12:00', home: 3.04, draw: 3.18, away: 2.44, volume: 5 },
    { time: '13:00', home: 3.1, draw: 3.2, away: 2.4, volume: 8 },
    { time: '14:00', home: 3.06, draw: 3.18, away: 2.42, volume: 4 },
    { time: '15:00', home: 3.09, draw: 3.16, away: 2.44, volume: 7 },
    { time: '16:00', home: 3.07, draw: 3.18, away: 2.42, volume: 5 },
  ],
  'big-trade': [
    { time: '10:00', home: 3.55, draw: 3.22, away: 2.02, volume: 22 },
    { time: '11:00', home: 3.54, draw: 3.22, away: 2.03, volume: 24 },
    { time: '12:00', home: 3.55, draw: 3.2, away: 2.02, volume: 26 },
    { time: '13:00', home: 3.32, draw: 3.18, away: 2.18, volume: 110 },
    { time: '14:00', home: 3.18, draw: 3.16, away: 2.32, volume: 88 },
    { time: '15:00', home: 3.1, draw: 3.16, away: 2.4, volume: 64 },
    { time: '16:00', home: 3.04, draw: 3.16, away: 2.44, volume: 32 },
  ],
}
