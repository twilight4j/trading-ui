import { delay, EVAL_BALANCE_NEXT_PAGE_DELAY_MS } from './kiwoomRateLimit.js'
import { parseNumericString } from './numbers.js'

export const PROFIT_TRACKING_START_DATE = '20260608'

export function getKstTodayYmd() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const day = parts.find((part) => part.type === 'day')?.value ?? ''
  return `${year}${month}${day}`
}

export function formatProfitTrackingStartDate(ymd = PROFIT_TRACKING_START_DATE) {
  if (!/^\d{8}$/.test(ymd)) {
    return ymd
  }
  return `${ymd.slice(0, 4)}.${ymd.slice(4, 6)}.${ymd.slice(6, 8)}`
}

function computeRealizedProfitRate(rlztPl, totSellAmt) {
  const profit = parseNumericString(rlztPl)
  const sellAmt = parseNumericString(totSellAmt)
  if (profit === null || sellAmt === null) {
    return null
  }
  const costBasis = sellAmt - profit
  if (costBasis === 0) {
    return null
  }
  return (profit / costBasis) * 100
}

/**
 * @param {{ evaluationSummary?: object|null, realizedSummary?: object|null }} params
 */
export function buildProfitOverview({ evaluationSummary, realizedSummary }) {
  const totEvltPl = evaluationSummary?.totEvltPl ?? null
  const totPrftRt = evaluationSummary?.totPrftRt ?? null
  const totPurAmt = evaluationSummary?.totPurAmt ?? null
  const totEvltAmt = evaluationSummary?.totEvltAmt ?? null
  const dbstBal = evaluationSummary?.dbstBal ?? null

  const rlztPl = realizedSummary?.rlztPl ?? null
  const totBuyAmt = realizedSummary?.totBuyAmt ?? null
  const totSellAmt = realizedSummary?.totSellAmt ?? null
  const trdeCmsn = realizedSummary?.trdeCmsn ?? null
  const trdeTax = realizedSummary?.trdeTax ?? null
  const realizedPrftRt = computeRealizedProfitRate(rlztPl, totSellAmt)

  const evltPlNum = parseNumericString(totEvltPl)
  const rlztPlNum = parseNumericString(rlztPl)
  const cumulativePl =
    evltPlNum !== null && rlztPlNum !== null ? String(evltPlNum + rlztPlNum) : null

  return {
    startDate: PROFIT_TRACKING_START_DATE,
    cumulativePl,
    evaluation: {
      pl: totEvltPl,
      prftRt: totPrftRt,
      totPurAmt,
      totEvltAmt,
      dbstBal,
    },
    realized: {
      pl: rlztPl,
      prftRt: realizedPrftRt !== null ? String(realizedPrftRt) : null,
      totBuyAmt,
      totSellAmt,
      trdeCmsn,
      trdeTax,
    },
  }
}

/**
 * ka10074 응답에서 UI 요약 필드 추출.
 * @param {object|null|undefined} response
 */
export function extractRealizedProfitSummary(response) {
  if (!response || typeof response !== 'object') {
    return null
  }
  return {
    rlztPl: response.rlzt_pl ?? null,
    totBuyAmt: response.tot_buy_amt ?? null,
    totSellAmt: response.tot_sell_amt ?? null,
    trdeCmsn: response.trde_cmsn ?? null,
    trdeTax: response.trde_tax ?? null,
  }
}

const MAX_REALIZED_PAGES = 100

/**
 * ka10074 일자별실현손익 요약 조회 (연속조회 포함, 합계 필드는 첫 페이지 사용).
 */
export async function fetchRealizedProfitDailySummary(kiwoomRequestJson) {
  const endDt = getKstTodayYmd()
  let response = await kiwoomRequestJson('POST', '/stk/acnt/realized-profit-daily', {
    params: { cont_yn: 'N', next_key: '' },
    body: {
      strt_dt: PROFIT_TRACKING_START_DATE,
      end_dt: endDt,
    },
  })

  const summary = extractRealizedProfitSummary(response)
  let pagingMeta = response?._paging || {}
  let contYnValue = String(pagingMeta?.cont_yn || 'N').toUpperCase()
  let nextKeyValue = String(pagingMeta?.next_key || '')
  let pages = 1

  while (contYnValue === 'Y' && nextKeyValue.length > 0 && pages < MAX_REALIZED_PAGES) {
    await delay(EVAL_BALANCE_NEXT_PAGE_DELAY_MS)
    response = await kiwoomRequestJson('POST', '/stk/acnt/realized-profit-daily', {
      params: { cont_yn: 'Y', next_key: nextKeyValue },
      body: {
        strt_dt: PROFIT_TRACKING_START_DATE,
        end_dt: endDt,
      },
    })
    pagingMeta = response?._paging || {}
    contYnValue = String(pagingMeta?.cont_yn || 'N').toUpperCase()
    nextKeyValue = String(pagingMeta?.next_key || '')
    pages += 1
  }

  return {
    summary,
    truncated: pages >= MAX_REALIZED_PAGES && contYnValue === 'Y' && nextKeyValue.length > 0,
  }
}
