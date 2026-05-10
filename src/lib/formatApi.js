import { parseNumericString } from './numbers.js'

export function formatApiAmount(value) {
  const parsed = parseNumericString(value)
  if (parsed === null) {
    return '-'
  }
  return `${new Intl.NumberFormat('ko-KR').format(Math.trunc(parsed))}원`
}

export function formatApiNumber(value) {
  const parsed = parseNumericString(value)
  if (parsed === null) {
    return '-'
  }
  return new Intl.NumberFormat('ko-KR').format(Math.trunc(parsed))
}

export function formatApiPercent(value) {
  const parsed = parseNumericString(value)
  if (parsed === null) {
    return '-'
  }
  return `${parsed > 0 ? '+' : ''}${parsed.toFixed(2)}%`
}

export function getToneByNumericString(value) {
  const parsed = parseNumericString(value)
  if (parsed === null || parsed === 0) {
    return ''
  }
  return parsed > 0 ? 'up' : 'down'
}
