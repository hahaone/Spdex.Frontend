export interface HomeMetric {
  id: string
  title: string
  threshold: string
  count: number
  tone: 'bf' | 'poly' | 'index' | 'signal'
  to: string
}
