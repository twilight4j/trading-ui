import { formatApiAmount, formatApiNumber, formatApiPercent, getToneByNumericString } from './formatApi.js'

export function formatBuyOrdDt(yyyymmdd) {
  const s = String(yyyymmdd || '').trim()
  if (s.length !== 8 || !/^\d{8}$/.test(s)) {
    return '-'
  }
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
}

export function normalizeEvaluationStkCd(stkCd) {
  return String(stkCd || '').trim().replace(/^A/i, '')
}

/** 정렬용 매수일 키 (KST YYYYMMDD → number). 없으면 null */
export function getBuyOrdDtSortKey(item, buyDates = null) {
  const stockCode = normalizeEvaluationStkCd(item?.stk_cd)
  const raw = buyDates && typeof buyDates === 'object' ? buyDates[stockCode] : undefined
  const s = String(raw || '').trim()
  if (s.length !== 8 || !/^\d{8}$/.test(s)) {
    return null
  }
  return Number(s)
}

const EVAL_BALANCE_SORT_FIELD_LABELS = {
  evltv_prft: '평가손익',
  prft_rt: '수익률',
  buy_ord_dt: '매수일',
}

export function getEvaluationBalanceRowDisplay(item, buyDates = null) {
  const stockCode = normalizeEvaluationStkCd(item?.stk_cd)
  const buyOrdDtRaw =
    buyDates && typeof buyDates === 'object' ? buyDates[stockCode] : undefined
  return {
    stockName: item?.stk_nm || '-',
    stockCode,
    buyOrdDtText: formatBuyOrdDt(buyOrdDtRaw),
    pnlTone: getToneByNumericString(item?.evltv_prft),
    profitTone: getToneByNumericString(item?.prft_rt),
    evltvPrftText: formatApiAmount(item?.evltv_prft),
    prftRtText: formatApiPercent(item?.prft_rt),
    purPricText: formatApiAmount(item?.pur_pric),
    rmndQtyText: formatApiNumber(item?.rmnd_qty),
    curPrcText: formatApiAmount(item?.cur_prc),
    purAmtText: formatApiAmount(item?.pur_amt),
    evltAmtText: formatApiAmount(item?.evlt_amt),
    possRtText: formatApiPercent(item?.poss_rt),
  }
}

export function evalBalanceSortControlMeta(field, evalBalanceSort) {
  const name = EVAL_BALANCE_SORT_FIELD_LABELS[field] || field
  const active = evalBalanceSort?.field === field
  const phase = !active ? '미적용' : evalBalanceSort.dir === 'desc' ? '내림차순' : '오름차순'
  const icon = active ? (evalBalanceSort.dir === 'desc' ? ' ▼' : ' ▲') : ''
  return {
    name,
    ariaLabel: `${name} 정렬, 현재 ${phase}. 누르면 내림차순, 오름차순, 원래 순서가 순환합니다.`,
    icon,
    ariaPressed: active,
  }
}
