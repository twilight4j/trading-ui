export const API_PREFIX = '/api/v1'

export class ApiError extends Error {
  constructor(message, status, requestUrl, detail) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.requestUrl = requestUrl
    this.detail = detail
  }
}

export function buildApiUrl(path, params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}` !== '') {
      query.set(key, String(value))
    }
  })
  const queryString = query.toString()
  return `${API_PREFIX}${path}${queryString ? `?${queryString}` : ''}`
}

export async function requestJson(method, path, { params, body, cache } = {}) {
  const requestUrl = buildApiUrl(path, params)
  const response = await fetch(requestUrl, {
    method,
    cache,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) {
    return null
  }

  const rawText = await response.text()
  let data = null
  if (rawText) {
    try {
      data = JSON.parse(rawText)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? data.detail
        : rawText || response.statusText
    throw new ApiError(
      `${response.status} ${requestUrl} | detail=${detail}`,
      response.status,
      requestUrl,
      detail,
    )
  }
  return data
}

export function fetchEstimateNetIncomeAnalysis(params = {}) {
  return requestJson('GET', '/crawling/estimate-net-income/analysis', { params })
}

export function fetchEstimateNetIncomeCrawlPreview(params = {}) {
  return requestJson('GET', '/crawling/estimate-net-income/crawl/preview', {
    params,
    cache: 'no-store',
  })
}

export function crawlEstimateNetIncome(params = {}) {
  return requestJson('POST', '/crawling/estimate-net-income/crawl', { params })
}

export function syncStockBase(params = {}) {
  return requestJson('POST', '/crawling/stock-base/sync', { params })
}

export function selectStockBaseTargets(params = {}) {
  return requestJson('POST', '/crawling/stock-base/select-targets', { params })
}

export function collectStockBaseDetails(params = {}) {
  return requestJson('POST', '/crawling/stock-base/collect-details', { params })
}
