import { requestJson } from './api.js'

export function fetchSchedules() {
  return requestJson('GET', '/schedules')
}

export function patchSchedule(jobKey, body) {
  return requestJson('PATCH', `/schedules/${encodeURIComponent(jobKey)}`, { body })
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
