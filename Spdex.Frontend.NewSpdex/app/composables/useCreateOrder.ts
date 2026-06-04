/**
 * 下单 composable：3 种支付通道。
 *   - 微信扫码：返回 base64 二维码
 *   - 支付宝：返回 formHtml（前端自动 submit）
 *   - 锦囊扣点：即时生效，返回扣点结果
 */

import type { ApiResponse } from '~/types/auth'
import type {
  AlipayOrderResult,
  CreateOrderRequest,
  CustomerService,
  SilkBalance,
  SilkNeed,
  SilkOrderResult,
  SilkProduct,
  SilkRechargeChannel,
  SilkRechargeOrderResult,
  WxCodeOrderResult,
  YftOrderResult,
} from '~/types/billing'

// 客服配置 10 分钟 SWR 缓存（慢变，避免每次进个人中心重拉）
let csCache: { ts: number, value: CustomerService | null } | null = null
const CS_TTL_MS = 10 * 60_000

export function useCreateOrder() {
  async function createYftOrder(roleId: number, stageId: number): Promise<YftOrderResult | null> {
    const body: CreateOrderRequest = { roleId, stageId }
    const res = await $apiFetch<ApiResponse<YftOrderResult>>('/api/newspdex/billing/order/yft', {
      method: 'POST',
      body,
    })
    return res.code === 0 ? (res.data ?? null) : null
  }

  async function createWxCodeOrder(roleId: number, stageId: number): Promise<WxCodeOrderResult | null> {
    const body: CreateOrderRequest = { roleId, stageId }
    const res = await $apiFetch<ApiResponse<WxCodeOrderResult>>('/api/newspdex/billing/order/wxcode', {
      method: 'POST',
      body,
    })
    return res.code === 0 ? (res.data ?? null) : null
  }

  async function createAlipayOrder(roleId: number, stageId: number): Promise<AlipayOrderResult | null> {
    const body: CreateOrderRequest = { roleId, stageId }
    const res = await $apiFetch<ApiResponse<AlipayOrderResult>>('/api/newspdex/billing/order/alipay', {
      method: 'POST',
      body,
    })
    return res.code === 0 ? (res.data ?? null) : null
  }

  async function createSilkOrder(roleId: number, stageId: number): Promise<SilkOrderResult> {
    const body: CreateOrderRequest = { roleId, stageId }
    try {
      const res = await $apiFetch<ApiResponse<SilkOrderResult>>('/api/newspdex/billing/order/silk-local', {
        method: 'POST',
        body,
      })
      if (res.code === 0 && res.data) return res.data
      return {
        success: false,
        orderId: null,
        remainingSilk: 0,
        newEndDate: null,
        message: res.message || '锦囊扣点失败',
      }
    }
    catch (err: unknown) {
      const fetchErr = err as { data?: { message?: string } }
      return {
        success: false,
        orderId: null,
        remainingSilk: 0,
        newEndDate: null,
        message: fetchErr?.data?.message || '锦囊扣点失败',
      }
    }
  }

  async function getSilkBalance(): Promise<SilkBalance | null> {
    const res = await $apiFetch<ApiResponse<SilkBalance>>('/api/newspdex/billing/silk-balance')
    return res.code === 0 ? (res.data ?? null) : null
  }

  async function getSilkProduct(): Promise<SilkProduct | null> {
    const res = await $apiFetch<ApiResponse<SilkProduct>>('/api/newspdex/billing/silk-product')
    return res.code === 0 ? (res.data ?? null) : null
  }

  async function createSilkRechargeOrder(channel: SilkRechargeChannel, number: number): Promise<SilkRechargeOrderResult | null> {
    const res = await $apiFetch<ApiResponse<SilkRechargeOrderResult>>('/api/newspdex/billing/silk-recharge', {
      method: 'POST',
      body: { channel, number },
    })
    return res.code === 0 ? (res.data ?? null) : null
  }

  async function getSilkNeed(roleId: number, stageId: number): Promise<SilkNeed | null> {
    const res = await $apiFetch<ApiResponse<SilkNeed>>('/api/newspdex/billing/silk-need', {
      query: { roleId, stageId },
    })
    return res.code === 0 ? (res.data ?? null) : null
  }

  async function getCustomerService(): Promise<CustomerService | null> {
    if (csCache && Date.now() - csCache.ts < CS_TTL_MS) return csCache.value
    const res = await $apiFetch<ApiResponse<CustomerService>>('/api/newspdex/billing/customer-service')
    const value = res.code === 0 ? (res.data ?? null) : null
    csCache = { ts: Date.now(), value }
    return value
  }

  return {
    createYftOrder,
    createWxCodeOrder,
    createAlipayOrder,
    createSilkOrder,
    createSilkRechargeOrder,
    getSilkBalance,
    getSilkNeed,
    getSilkProduct,
    getCustomerService,
  }
}
