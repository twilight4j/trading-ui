import { useEffect, useMemo, useState } from 'react'
import { parseNumericString } from '../lib/numbers.js'
import {
  evalBalanceSortControlMeta,
  getBuyOrdDtSortKey,
  getEvaluationBalanceRowDisplay,
} from '../lib/evaluationDisplay.js'
import EvaluationBalanceMobileCard from './EvaluationBalanceMobileCard.jsx'
import InfoHelpTooltip from './InfoHelpTooltip.jsx'

export default function EvaluationBalanceListCard({
  rows = [],
  buyDatesByStkCd = {},
  isLoading = false,
  embedded = false,
}) {
  const [sort, setSort] = useState(null)

  useEffect(() => {
    setSort(null)
  }, [rows])

  const sortedRows = useMemo(() => {
    if (!sort) {
      return rows
    }
    const { field, dir } = sort
    const resolveSortValue = (item) => {
      if (field === 'buy_ord_dt') {
        return getBuyOrdDtSortKey(item, buyDatesByStkCd)
      }
      return parseNumericString(item?.[field])
    }
    return [...rows].sort((a, b) => {
      const va = resolveSortValue(a)
      const vb = resolveSortValue(b)
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return dir === 'asc' ? va - vb : vb - va
    })
  }, [rows, sort, buyDatesByStkCd])

  function cycleSort(field) {
    setSort((prev) => {
      if (!prev || prev.field !== field) {
        return { field, dir: 'desc' }
      }
      if (prev.dir === 'desc') {
        return { field, dir: 'asc' }
      }
      return null
    })
  }

  const sortMetaBuyDt = evalBalanceSortControlMeta('buy_ord_dt', sort)
  const sortMetaPnl = evalBalanceSortControlMeta('evltv_prft', sort)
  const sortMetaPrft = evalBalanceSortControlMeta('prft_rt', sort)

  const content = (
    <>
      {!embedded ? (
        <div className="section-header evaluation-list-section-header">
          <div className="snapshot-chart-title-row">
            <h2>종목별 평가잔고 목록</h2>
            <InfoHelpTooltip ariaLabel="종목별 평가잔고 목록 설명">
              <p className="subtle snapshot-chart-help-text">
                선택한 계좌·조회구분·거래소 기준 보유 종목별 평가잔고입니다. 연속조회 응답을 합쳐 목록을
                구성합니다.
                <br />
                사용 API: <code>kt00018</code> (계좌평가잔고내역요청)
              </p>
            </InfoHelpTooltip>
          </div>
          <span className="caption">총 {rows.length}건</span>
        </div>
      ) : null}

      {isLoading ? <p className="subtle">데이터를 조회하는 중입니다...</p> : null}
      {!isLoading && rows.length === 0 ? (
        <p className="subtle">조회된 평가잔고 데이터가 없습니다.</p>
      ) : null}
      {!isLoading && rows.length > 0 ? (
        <>
          <div className="table-scroll evaluation-table-desktop-wrap">
            <table className="data-table evaluation-table evaluation-table--balance-list">
              <colgroup>
                <col className="col-name" />
                <col className="col-buy-date" />
                <col className="col-pl" />
                <col className="col-rate" />
                <col className="col-price" />
                <col className="col-qty" />
                <col className="col-price" />
              </colgroup>
              <thead>
                <tr>
                  <th>종목명</th>
                  <th
                    className="col-buy-date th-sortable"
                    aria-sort={
                      sort?.field === 'buy_ord_dt'
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => cycleSort('buy_ord_dt')}
                      title="클릭: 최근순 → 과거순 → 원래 순서"
                    >
                      매수일
                      <span className="th-sort-icons" aria-hidden="true">
                        {sort?.field === 'buy_ord_dt' ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : ''}
                      </span>
                    </button>
                  </th>
                  <th
                    className="num th-sortable"
                    aria-sort={
                      sort?.field === 'evltv_prft'
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => cycleSort('evltv_prft')}
                      title="클릭: 높은순 → 낮은순 → 원래 순서"
                    >
                      평가손익
                      <span className="th-sort-icons" aria-hidden="true">
                        {sort?.field === 'evltv_prft' ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : ''}
                      </span>
                    </button>
                  </th>
                  <th
                    className="num th-sortable"
                    aria-sort={
                      sort?.field === 'prft_rt'
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => cycleSort('prft_rt')}
                      title="클릭: 높은순 → 낮은순 → 원래 순서"
                    >
                      수익률
                      <span className="th-sort-icons" aria-hidden="true">
                        {sort?.field === 'prft_rt' ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : ''}
                      </span>
                    </button>
                  </th>
                  <th className="num">매입가</th>
                  <th className="num">보유수량</th>
                  <th className="num">현재가</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((item, index) => {
                  const d = getEvaluationBalanceRowDisplay(item, buyDatesByStkCd)
                  return (
                    <tr key={`${item?.stk_cd || 'stk'}-${index}`}>
                      <td>
                        <span className="stock-name-with-code" data-code={d.stockCode}>
                          {d.stockName}
                        </span>
                      </td>
                      <td className="col-buy-date">{d.buyOrdDtText}</td>
                      <td className={`num ${d.pnlTone ? `delta ${d.pnlTone}` : ''}`}>{d.evltvPrftText}</td>
                      <td className={`num ${d.profitTone ? `delta ${d.profitTone}` : ''}`}>{d.prftRtText}</td>
                      <td className="num">{d.purPricText}</td>
                      <td className="num">{d.rmndQtyText}</td>
                      <td className="num">{d.curPrcText}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="evaluation-balance-mobile-block">
            <div className="evaluation-mobile-sort-bar" role="toolbar" aria-label="종목 목록 정렬">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => cycleSort('buy_ord_dt')}
                aria-pressed={sortMetaBuyDt.ariaPressed}
                aria-label={sortMetaBuyDt.ariaLabel}
              >
                {sortMetaBuyDt.name}
                <span aria-hidden="true">{sortMetaBuyDt.icon}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => cycleSort('evltv_prft')}
                aria-pressed={sortMetaPnl.ariaPressed}
                aria-label={sortMetaPnl.ariaLabel}
              >
                {sortMetaPnl.name}
                <span aria-hidden="true">{sortMetaPnl.icon}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => cycleSort('prft_rt')}
                aria-pressed={sortMetaPrft.ariaPressed}
                aria-label={sortMetaPrft.ariaLabel}
              >
                {sortMetaPrft.name}
                <span aria-hidden="true">{sortMetaPrft.icon}</span>
              </button>
            </div>
            <ul className="evaluation-balance-list-mobile">
              {sortedRows.map((item, index) => (
                <EvaluationBalanceMobileCard
                  key={`${item?.stk_cd || 'stk'}-m-${index}`}
                  item={item}
                  buyDatesByStkCd={buyDatesByStkCd}
                  showAmountFields={false}
                />
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </>
  )

  if (embedded) {
    return content
  }

  return <section className="card">{content}</section>
}
