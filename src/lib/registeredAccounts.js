/**
 * GET /strategies/accounts 행 정규화 (entry_filter_signal_* 는 API 확장 필드).
 * @param {unknown} raw
 * @returns {{ account_id: string, account_nm: string, entry_filter_signal_name: string, entry_filter_signal_sec: string, entry_filter_active_from: string, active_strategy_id: string } | null}
 */
export function normalizeRegisteredAccountRow(raw) {
  if (!raw || !String(raw.account_id || '').trim()) {
    return null
  }
  return {
    account_id: String(raw.account_id).trim(),
    account_nm: String(raw.account_nm || '').trim(),
    entry_filter_signal_name: String(raw.entry_filter_signal_name || '').trim(),
    entry_filter_signal_sec: String(raw.entry_filter_signal_sec || '').trim(),
    entry_filter_active_from: String(raw.entry_filter_active_from || '').trim(),
    active_strategy_id: String(raw.active_strategy_id || '').trim(),
  }
}

/**
 * 셀렉트·체크박스 등 목록에 표시할 한 줄 라벨.
 * @param {{ account_id: string, account_nm?: string, entry_filter_signal_name?: string, entry_filter_signal_sec?: string }} account
 */
export function formatRegisteredAccountListLabel(account) {
  const parts = [account.account_id]
  if (account.account_nm) {
    parts.push(account.account_nm)
  }
  if (account.entry_filter_signal_name) {
    parts.push(account.entry_filter_signal_name)
  } else if (account.entry_filter_signal_sec) {
    parts.push(`조건식 ${account.entry_filter_signal_sec}`)
  }
  if (account.entry_filter_active_from) {
    parts.push(`${account.entry_filter_active_from}~`)
  }
  return parts.join(' · ')
}

/**
 * 보조 설명 한 줄 (이름 없이 진입 조건만).
 * @param {{ entry_filter_signal_name?: string, entry_filter_signal_sec?: string }} account
 */
export function formatRegisteredAccountEntrySignal(account) {
  if (!account) {
    return ''
  }
  if (account.entry_filter_signal_name) {
    return account.entry_filter_signal_name
  }
  if (account.entry_filter_signal_sec) {
    return `조건식 ${account.entry_filter_signal_sec}`
  }
  return ''
}

/**
 * 스냅샷 계좌 검색 (소문자 query, trim된 값을 넘기면 처리 중복을 줄일 수 있음).
 * @param {{ account_id: string, account_nm?: string, entry_filter_signal_name?: string, entry_filter_signal_sec?: string, active_strategy_id?: string }} account
 * @param {string} queryLower trim 후 toLowerCase()
 */
export function registeredAccountMatchesSearch(account, queryLower) {
  const q = String(queryLower || '').trim().toLowerCase()
  if (!q) {
    return true
  }
  const chunks = [
    account.account_id,
    account.account_nm,
    account.entry_filter_signal_name,
    account.entry_filter_signal_sec,
    account.active_strategy_id,
    formatRegisteredAccountListLabel(account),
  ].map((s) => String(s || '').toLowerCase())
  return chunks.some((c) => c.includes(q))
}
