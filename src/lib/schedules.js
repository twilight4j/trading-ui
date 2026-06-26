import { requestJson } from './api.js'

export function fetchSchedules() {
  return requestJson('GET', '/schedules')
}

export function patchSchedule(jobKey, body) {
  return requestJson('PATCH', `/schedules/${encodeURIComponent(jobKey)}`, { body })
}

export function runCollectionPipelineOnce({ accountId, stockCode, sleepSeconds = 0.3 } = {}) {
  return requestJson('POST', '/crawling/collection-pipeline/run-once', {
    params: {
      account_id: accountId,
      stock_code: stockCode || undefined,
      sleep_seconds: sleepSeconds,
    },
  })
}

export function fetchCollectionPipelineStatus({ accountId } = {}) {
  return requestJson('GET', '/crawling/collection-pipeline/status', {
    params: {
      account_id: accountId,
    },
    cache: 'no-store',
  })
}

export function formatNextRunTime(isoString) {
  if (!isoString) {
    return '—'
  }
  try {
    const d = new Date(isoString)
    if (Number.isNaN(d.getTime())) {
      return isoString
    }
    return d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  } catch {
    return isoString
  }
}
