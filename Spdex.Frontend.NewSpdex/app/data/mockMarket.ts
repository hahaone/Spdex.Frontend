import type { MarketDetail } from '~/types/market'
import { footballMatches } from './mockMatches'

export const marketDetail: MarketDetail = {
  match: footballMatches[0]!,
  standard: [
    { key: 'home', selection: '主', price: '3.50', turnover: '2.50M', bfIndex: 20, ratio: '35%', pnl: -10, listing: '4.36%', heat: -1.67, euroAvg: 3.05, variance: 8, asian: '' },
    { key: 'draw', selection: '平', price: '3.20', turnover: '0.55M', bfIndex: 15, ratio: '15%', pnl: -5, listing: '1.97%', heat: 3.15, euroAvg: 3.27, variance: 14, asian: '-14.50%' },
    { key: 'away', selection: '客', price: '2.00', turnover: '3.50M', bfIndex: 65, ratio: '50%', pnl: 20, listing: '5.04%', heat: 9.63, euroAvg: 2.26, variance: 4, asian: '' },
  ],
  poly: [
    { key: 'home', selection: '主', price: '3.50', turnover: '$1.20M', polyIndex: 4, ratio: '-' },
    { key: 'draw', selection: '平', price: '3.20', turnover: '$500K', polyIndex: 1, ratio: '0.22' },
    { key: 'away', selection: '客', price: '2.00', turnover: '$3.20M', polyIndex: 92, ratio: '-' },
  ],
  goals: [
    { key: 'over', selection: '大', price: '1.95', turnover: '500K', bfIndex: 45, ratio: '50%', listing: '4.36%', balance: '5.75' },
    { key: 'line', selection: '盘口', price: '>2.5', turnover: '', ratio: '', listing: '' },
    { key: 'under', selection: '小', price: '2.00', turnover: '300K', bfIndex: 55, ratio: '50%', listing: '5.04%', balance: '-' },
  ],
  handicap: [
    { key: 'home', selection: '主', price: '1.74', turnover: '15,000', bfIndex: 20, ratio: '30%', listing: '4.36%' },
    { key: 'draw', selection: '盘口', price: '-0.75', turnover: '30,000', bfIndex: 20, ratio: '20%', listing: '1.47%' },
    { key: 'away', selection: '客', price: '5.40', turnover: '50,000', bfIndex: 60, ratio: '50%', listing: '5.04%' },
  ],
  cs: [],
  corner: [],
}
