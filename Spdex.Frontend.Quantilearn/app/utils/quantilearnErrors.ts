const errorText = (error: unknown) => {
  if (!error) return ''
  if (error instanceof Error) return error.message
  if (typeof error === 'object' && 'message' in error) return String((error as { message?: unknown }).message ?? '')
  return String(error)
}

export const toQuantilearnUserError = (error: unknown) => {
  const text = errorText(error).trim()
  if (!text) return ''

  if (/请先登录|newspdex token is invalid|unauthorized|\b401\b/i.test(text)) {
    return '登录状态已失效，请重新登录。'
  }

  if (text.includes('/api/quantilearn')) {
    if (/\b404\b/.test(text)) return '请求的数据暂不可用，请刷新后重试。'
    return '数据读取失败，请稍后重试。'
  }

  return text
}
