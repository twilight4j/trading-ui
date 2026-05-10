export function parseCommaInt(value) {
  const normalized = String(value || '')
    .replace(/,/g, '')
    .trim()
  if (!normalized) {
    return null
  }
  const parsed = Number.parseInt(normalized, 10)
  return Number.isNaN(parsed) ? null : parsed
}

export function toComma(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return ''
  }
  return new Intl.NumberFormat('ko-KR').format(Number(value))
}

export function parseNumericString(value) {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const normalized = String(value).replace(/,/g, '').trim()
  if (!normalized) {
    return null
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}
