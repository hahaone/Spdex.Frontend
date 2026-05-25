<script setup lang="ts">
/**
 * 行展开面板 — 显示 Back / Lay / Traded 三列表格。
 * 包含当前记录、前一条记录、差额三个数据层。
 * cs3 和 cs4 detail 页面共用。
 */

import type { PriceSizeRow } from '~/types/bighold'
import { formatMoney } from '~/utils/formatters'
import { priceBgClass, tradedClass } from '~/utils/styleHelpers'

defineProps<{
  currentRows: PriceSizeRow[]
  previousRows: PriceSizeRow[]
  diffRows: PriceSizeRow[]
  loading: boolean
  failed: boolean
}>()

const emit = defineEmits<{
  'retry': []
}>()
</script>

<template>
  <div class="expand-content">
    <!-- 当前记录 -->
    <div class="detail-panel">
      <div class="panel-title">当前记录</div>
      <table v-if="currentRows.length > 0" class="detail-table">
        <thead>
          <tr>
            <th>价位</th>
            <th>Back</th>
            <th>Lay</th>
            <th>成交</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in currentRows" :key="i" :class="priceBgClass(row)">
            <td>{{ row.price.toFixed(2) }}</td>
            <td>{{ row.toBack > 0 ? formatMoney(row.toBack) : '' }}</td>
            <td>{{ row.toLay > 0 ? formatMoney(row.toLay) : '' }}</td>
            <td :class="tradedClass(row)">{{ row.traded > 0 ? formatMoney(row.traded) : '' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="panel-empty">无数据</div>
    </div>

    <!-- 前一条记录 -->
    <div class="detail-panel">
      <div class="panel-title">前一条记录</div>
      <div v-if="loading" class="panel-loading">
        <span class="spinner" />加载中...
      </div>
      <div v-else-if="failed" class="panel-error">
        加载失败
        <a class="retry-link" @click.prevent="emit('retry')">重试</a>
      </div>
      <table v-else-if="previousRows.length > 0" class="detail-table">
        <thead>
          <tr>
            <th>价位</th>
            <th>Back</th>
            <th>Lay</th>
            <th>成交</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in previousRows" :key="i" :class="priceBgClass(row)">
            <td>{{ row.price.toFixed(2) }}</td>
            <td>{{ row.toBack > 0 ? formatMoney(row.toBack) : '' }}</td>
            <td>{{ row.toLay > 0 ? formatMoney(row.toLay) : '' }}</td>
            <td :class="tradedClass(row)">{{ row.traded > 0 ? formatMoney(row.traded) : '' }}</td>
          </tr>
        </tbody>
      </table>
      <div v-else class="panel-empty">无前一条记录</div>
    </div>

    <!-- 差额 -->
    <div class="detail-panel">
      <div class="panel-title">差额</div>
      <table v-if="diffRows.length > 0" class="detail-table">
        <thead>
          <tr>
            <th>价位</th>
            <th>Back</th>
            <th>Lay</th>
            <th>成交</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in diffRows" :key="i">
            <td>{{ row.price.toFixed(2) }}</td>
            <td :class="{ 'text-pos': row.toBack > 0, 'text-neg': row.toBack < 0 }">
              {{ row.toBack !== 0 ? formatMoney(row.toBack) : '' }}
            </td>
            <td :class="{ 'text-pos': row.toLay > 0, 'text-neg': row.toLay < 0 }">
              {{ row.toLay !== 0 ? formatMoney(row.toLay) : '' }}
            </td>
            <td :class="{ 'text-pos': row.traded > 0, 'text-neg': row.traded < 0 }">
              {{ row.traded !== 0 ? formatMoney(row.traded) : '' }}
            </td>
          </tr>
        </tbody>
      </table>
      <div v-else class="panel-empty">{{ previousRows.length === 0 ? '需要前一条记录' : '无差额' }}</div>
    </div>
  </div>
</template>

<style scoped>
.expand-content {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  padding: 0.75rem;
  background: #f8fafc;
  animation: slideDown 0.2s ease-out;
}

@keyframes slideDown {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 600px; }
}

.detail-panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.panel-title {
  padding: 0.4rem 0.6rem;
  background: #f1f5f9;
  font-size: 0.78rem;
  font-weight: 600;
  color: #475569;
  border-bottom: 1px solid #e2e8f0;
}

.detail-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.75rem;
}

.detail-table th {
  padding: 0.3rem 0.5rem;
  text-align: right;
  font-weight: 600;
  color: #64748b;
  border-bottom: 1px solid #e2e8f0;
  background: #fafafa;
}

.detail-table th:first-child {
  text-align: left;
}

.detail-table td {
  padding: 0.25rem 0.5rem;
  text-align: right;
  border-bottom: 1px solid #f1f5f9;
}

.detail-table td:first-child {
  text-align: left;
  font-weight: 500;
}

.bg-back { background: #dbeafe; }
.bg-lay { background: #fce7f3; }

.text-traded-2x { color: #ea580c; font-weight: 600; }
.text-traded-3x { color: #dc2626; font-weight: 700; }
.text-pos { color: #16a34a; }
.text-neg { color: #dc2626; }

.panel-empty,
.panel-loading,
.panel-error {
  padding: 1.5rem;
  text-align: center;
  font-size: 0.8rem;
  color: #94a3b8;
}

.panel-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.panel-error {
  color: #ef4444;
}

.retry-link {
  color: #2563eb;
  cursor: pointer;
  margin-left: 0.5rem;
  text-decoration: underline;
}

.spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
