import { formatApiAmount, formatApiNumber, formatApiPercent, getToneByNumericString } from './formatApi.js'

export function getEvaluationBalanceRowDisplay(item) {
  const stockCode = String(item?.stk_cd || '').replace(/^A/, '')
  return {
    stockName: item?.stk_nm || '-',
    stockCode,
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
  const name = field === 'evltv_prft' ? '평가손익' : '수익률'
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
