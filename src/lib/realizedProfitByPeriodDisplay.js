import { formatBuyOrdDt, normalizeEvaluationStkCd } from './evaluationDisplay.js'
import { formatApiAmount, formatApiNumber, formatApiPercent, getToneByNumericString } from './formatApi.js'

const REALIZED_BY_PERIOD_SORT_FIELD_LABELS = {
  dt: '일자',
  tdy_sel_pl: '당일매도손익',
  pl_rt: '손익율',
}

export function getRealizedByPeriodRowDisplay(item) {
  const stockCode = normalizeEvaluationStkCd(item?.stk_cd)
  return {
    stockName: item?.stk_nm || '-',
    stockCode,
    dtText: formatBuyOrdDt(item?.dt),
    cntrQtyText: formatApiNumber(item?.cntr_qty),
    buyUvText: formatApiAmount(item?.buy_uv),
    cntrPricText: formatApiAmount(item?.cntr_pric),
    pnlTone: getToneByNumericString(item?.tdy_sel_pl),
    profitTone: getToneByNumericString(item?.pl_rt),
    tdySelPlText: formatApiAmount(item?.tdy_sel_pl),
    plRtText: formatApiPercent(item?.pl_rt),
    trdeCmsnText: formatApiAmount(item?.tdy_trde_cmsn),
    trdeTaxText: formatApiAmount(item?.tdy_trde_tax),
  }
}

export function getRealizedByPeriodDtSortKey(item) {
  const s = String(item?.dt || '').trim()
  if (s.length !== 8 || !/^\d{8}$/.test(s)) {
    return null
  }
  return Number(s)
}

export function realizedByPeriodSortControlMeta(field, sortState) {
  const name = REALIZED_BY_PERIOD_SORT_FIELD_LABELS[field] || field
  const active = sortState?.field === field
  const phase = !active ? '미적용' : sortState.dir === 'desc' ? '내림차순' : '오름차순'
  const icon = active ? (sortState.dir === 'desc' ? ' ▼' : ' ▲') : ''
  return {
    name,
    ariaLabel: `${name} 정렬, 현재 ${phase}. 누르면 내림차순, 오름차순, 원래 순서가 순환합니다.`,
    icon,
    ariaPressed: active,
  }
}
