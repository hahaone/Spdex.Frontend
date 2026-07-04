export type LivePeriod =
  | 'pre_match'
  | 'first_half'
  | 'halftime'
  | 'second_half'
  | 'extra_time'
  | 'finished'
  | 'unknown'

export type LiveClockSource = 'bsw' | 'elapsed-fallback' | 'match-table'
