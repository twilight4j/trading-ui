import { delay, EVAL_BALANCE_NEXT_PAGE_DELAY_MS } from './kiwoomRateLimit.js'

const MAX_REALIZED_BY_PERIOD_PAGES = 100

/**
 * ka10073 일자별종목별실현손익 기간 조회 (연속조회 포함, dt_stk_rlzt_pl 병합).
 */
export async function fetchRealizedProfitByPeriod(
  kiwoomRequestJson,
  { accountId, strtDt, endDt, stkCd = '' },
) {
  let response = await kiwoomRequestJson('POST', '/stk/acnt/realized-profit-by-period', {
    params: {
      account_id: accountId,
      cont_yn: 'N',
      next_key: '',
    },
    body: {
      strt_dt: strtDt,
      end_dt: endDt,
      stk_cd: stkCd,
    },
  })

  let allRows = Array.isArray(response?.dt_stk_rlzt_pl) ? response.dt_stk_rlzt_pl : []
  let pagingMeta = response?._paging || {}
  let contYnValue = String(pagingMeta?.cont_yn || 'N').toUpperCase()
  let nextKeyValue = String(pagingMeta?.next_key || '')
  let pages = 1

  while (contYnValue === 'Y' && nextKeyValue.length > 0 && pages < MAX_REALIZED_BY_PERIOD_PAGES) {
    await delay(EVAL_BALANCE_NEXT_PAGE_DELAY_MS)
    response = await kiwoomRequestJson('POST', '/stk/acnt/realized-profit-by-period', {
      params: {
        account_id: accountId,
        cont_yn: 'Y',
        next_key: nextKeyValue,
      },
      body: {
        strt_dt: strtDt,
        end_dt: endDt,
        stk_cd: stkCd,
      },
    })
    const nextChunk = Array.isArray(response?.dt_stk_rlzt_pl) ? response.dt_stk_rlzt_pl : []
    allRows = [...allRows, ...nextChunk]
    pagingMeta = response?._paging || {}
    contYnValue = String(pagingMeta?.cont_yn || 'N').toUpperCase()
    nextKeyValue = String(pagingMeta?.next_key || '')
    pages += 1
  }

  return {
    rows: allRows,
    truncated: pages >= MAX_REALIZED_BY_PERIOD_PAGES && contYnValue === 'Y' && nextKeyValue.length > 0,
  }
}
