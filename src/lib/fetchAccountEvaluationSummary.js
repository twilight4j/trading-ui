import {
  EVAL_BALANCE_NEXT_PAGE_DELAY_MS,
  delay,
  kiwoomRequestJson,
} from './kiwoomRateLimit.js'
import { parseNumericString } from './numbers.js'

export { EVAL_BALANCE_NEXT_PAGE_DELAY_MS } from './kiwoomRateLimit.js'

const MAX_PAGES = 100
const DEFAULT_QRY_TP = '1'
const DEFAULT_DMST_STEX_TP = 'KRX'

function countHoldingsWithQuantity(rows) {
  if (!Array.isArray(rows)) {
    return 0
  }
  return rows.filter((row) => {
    const qty = parseNumericString(row?.rmnd_qty)
    return qty !== null && qty > 0
  }).length
}

/**
 * 계좌 평가잔고 요약 + 보유 종목 수 (전 페이지 합산).
 * @param {string} accountId
 */
export async function fetchAccountEvaluationSummary(accountId) {
  if (!accountId) {
    throw new Error('계좌 ID가 없습니다.')
  }

  await kiwoomRequestJson('POST', '/auth/active', { params: { account_id: accountId } })

  let response = await kiwoomRequestJson('POST', '/stk/acnt/evaluation-balance', {
    params: { cont_yn: 'N', next_key: '' },
    body: { qry_tp: DEFAULT_QRY_TP, dmst_stex_tp: DEFAULT_DMST_STEX_TP },
  })

  let allRows = Array.isArray(response?.acnt_evlt_remn_indv_tot) ? response.acnt_evlt_remn_indv_tot : []
  const summary = {
    totPurAmt: response?.tot_pur_amt ?? null,
    totEvltAmt: response?.tot_evlt_amt ?? null,
    totEvltPl: response?.tot_evlt_pl ?? null,
    totPrftRt: response?.tot_prft_rt ?? null,
  }

  let pagingMeta = response?._paging || {}
  let contYnValue = String(pagingMeta?.cont_yn || 'N').toUpperCase()
  let nextKeyValue = String(pagingMeta?.next_key || '')
  let pages = 1

  while (contYnValue === 'Y' && nextKeyValue.length > 0 && pages < MAX_PAGES) {
    await delay(EVAL_BALANCE_NEXT_PAGE_DELAY_MS)
    response = await kiwoomRequestJson('POST', '/stk/acnt/evaluation-balance', {
      params: { cont_yn: 'Y', next_key: nextKeyValue },
      body: { qry_tp: DEFAULT_QRY_TP, dmst_stex_tp: DEFAULT_DMST_STEX_TP },
    })
    const nextChunk = Array.isArray(response?.acnt_evlt_remn_indv_tot) ? response.acnt_evlt_remn_indv_tot : []
    allRows = [...allRows, ...nextChunk]
    pagingMeta = response?._paging || {}
    contYnValue = String(pagingMeta?.cont_yn || 'N').toUpperCase()
    nextKeyValue = String(pagingMeta?.next_key || '')
    pages++
  }

  return {
    holdingCount: countHoldingsWithQuantity(allRows),
    ...summary,
    truncated: pages >= MAX_PAGES && contYnValue === 'Y' && nextKeyValue.length > 0,
  }
}
