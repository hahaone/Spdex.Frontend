/**
 * NewSpdex 会员/支付相关类型。后端 Models/NewSpdex/BillingDtos.cs 的镜像。
 */

export interface PriceStage {
  stageId: number
  stageName: string
  price: number
  month: number
  days: number
  originalPrice: number | null
  discountLabel: string | null
}

export interface PaymentPlan {
  roleId: number
  roleName: string
  roleDescription: string | null
  discountDes: string | null
  hot: number
  unit: string | null
  prices: PriceStage[]
}

export interface YftOrderResult {
  orderId: string
  qrCodeBase64: string
  payUrl: string | null
  expireAt: string | null
}

export interface AlipayOrderResult {
  orderId: string
  formHtml: string
  expireAt: string | null
}

export interface SilkOrderResult {
  success: boolean
  orderId: string | null
  remainingSilk: number
  newEndDate: string | null
  message: string | null
}

export interface SilkBalance {
  total: number
  payCount: number
  rewardCount: number
  shareCount: number
}

export interface SilkNeed {
  roleId: number
  stageId: number
  silkRequired: number
  sufficient: boolean
  price: number
  unitPrice: number
  totalSilkBalance: number
  reservedSilk: number
  availableSilk: number
  maxDeductibleSilk: number
}

export interface SilkProduct {
  productId: number
  unitPrice: number
  maxAmount: number
  maxNumber: number
  dailyLimit: number
}

export interface SilkRechargeOrderResult {
  channel: string
  orderId: string | null
  formHtml: string | null
  qrImageBase64: string | null
  totalFee: number
  number: number
}

export interface OrderRecord {
  orderId: string
  channel: string         // alipay / yft / silk / historical wxcode/wechat
  roleId: number
  roleName: string | null
  dueMonths: number
  amount: number
  status: number          // 0=未付 1=已付 2=失败 3=取消
  statusText: string | null
  createTime: string | null
  expireTime: string | null
}

export interface PaymentSyncResult {
  orderId: string
  status: number
  statusText: string
  paid: boolean
  paidTime: string | null
  newEndDate: string | null
  message: string | null
}

export interface AccountSummary {
  userId: number
  userName: string
  roleId: number
  roleName: string | null
  tier: string
  endDate: string | null
  silkBalance: SilkBalance | null
  email: string | null
  mobile: string | null
  lastActivityDate: string | null
  isTestAccount: boolean
}

export interface CustomerService {
  wechat: string
  qq: string
  phone: string
}

export interface CreateOrderRequest {
  roleId: number
  stageId: number
  silkAmount?: number
}

export type PaymentChannel = 'alipay' | 'yft' | 'silk'
export type SilkRechargeChannel = 'alipay'
