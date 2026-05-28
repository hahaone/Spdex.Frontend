import type { HomeMetric } from '~/types/home'

export const homeMetrics: HomeMetric[] = [
  { id: 'bf-volume', title: '必发成交', threshold: '100万+', count: 6, tone: 'bf', to: '/football?metric=bf-volume' },
  { id: 'poly-volume', title: 'POLY成交', threshold: '200K+', count: 12, tone: 'poly', to: '/football?metric=poly-volume' },
  { id: 'bf-index', title: '必发指数', threshold: '60+', count: 5, tone: 'index', to: '/football?metric=bf-index' },
  { id: 'poly-index', title: 'POLY指数', threshold: '90+', count: 3, tone: 'index', to: '/football?metric=poly-index' },
  { id: 'double-red', title: '双红信号', threshold: '', count: 2, tone: 'signal', to: '/signals' },
]
