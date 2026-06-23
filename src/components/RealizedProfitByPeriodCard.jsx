import { useMemo, useState } from 'react'
import { parseNumericString } from '../lib/numbers.js'
import {
  formatProfitTrackingStartDate,
  getKstTodayYmd,
  PROFIT_TRACKING_START_DATE,
} from '../lib/accountProfitOverview.js'
import {
  getRealizedByPeriodDtSortKey,
  getRealizedByPeriodRowDisplay,
  realizedByPeriodSortControlMeta,
} from '../lib/realizedProfitByPeriodDisplay.js'
import InfoHelpTooltip from './InfoHelpTooltip.jsx'

function RealizedByPeriodMobileCard({ item }) {
  const d = getRealizedByPeriodRowDisplay(item)
  return (
    <li className="evaluation-balance-card">
      <div className="evaluation-balance-card-title">
        <span className="stock-name-with-code" data-code={d.stockCode}>
          {d.stockName}
        </span>
      </div>
      <div className="evaluation-balance-card-fields">
        <div className="evaluation-balance-card-row">
          <span className="evaluation-balance-card-label">당일매도손익</span>
          <span className={`evaluation-balance-card-value num ${d.pnlTone ? `delta ${d.pnlTone}` : ''}`}>
            {d.tdySelPlText}
          </span>
        </div>
        <div className="evaluation-balance-card-row">
          <span className="evaluation-balance-card-label">손익율</span>
          <span className={`evaluation-balance-card-value num ${d.profitTone ? `delta ${d.profitTone}` : ''}`}>
            {d.plRtText}
          </span>
        </div>
        <div className="evaluation-balance-card-row">
          <span className="evaluation-balance-card-label">매도일</span>
          <span className="evaluation-balance-card-value">{d.dtText}</span>
        </div>
        <div className="evaluation-balance-card-row">
          <span className="evaluation-balance-card-label">매입단가</span>
          <span className="evaluation-balance-card-value num">{d.buyUvText}</span>
        </div>
        <div className="evaluation-balance-card-row">
          <span className="evaluation-balance-card-label">체결량</span>
          <span className="evaluation-balance-card-value num">{d.cntrQtyText}</span>
        </div>
      </div>
    </li>
  )
}

export default function RealizedProfitByPeriodCard({
  rows = [],
  isLoading = false,
  error = '',
  truncated = false,
  embedded = false,
  hasFetched = true,
}) {
  const [sort, setSort] = useState(null)
  const periodLabel = `${formatProfitTrackingStartDate(PROFIT_TRACKING_START_DATE)} ~ ${formatProfitTrackingStartDate(getKstTodayYmd())}`

  const sortedRows = useMemo(() => {
    if (!sort) {
      return rows
    }
    const { field, dir } = sort
    const resolveSortValue = (item) => {
      if (field === 'dt') {
        return getRealizedByPeriodDtSortKey(item)
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
  }, [rows, sort])

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

  const sortMetaDt = realizedByPeriodSortControlMeta('dt', sort)
  const sortMetaPnl = realizedByPeriodSortControlMeta('tdy_sel_pl', sort)
  const sortMetaPrft = realizedByPeriodSortControlMeta('pl_rt', sort)

  const content = (
    <>
      {!embedded ? (
        <div className="section-header evaluation-list-section-header">
          <div className="snapshot-chart-title-row">
            <h2>일자별·종목별 실현손익</h2>
            <InfoHelpTooltip ariaLabel="일자별·종목별 실현손익 설명">
              <p className="subtle snapshot-chart-help-text">
                시작일({formatProfitTrackingStartDate(PROFIT_TRACKING_START_DATE)})~오늘 기간의 매도 확정 실현손익
                내역입니다. 전체 종목 기준이며 체결 단위 행으로 표시됩니다.
                <br />
                사용 API: <code>ka10073</code> (일자별종목별실현손익요청_기간)
              </p>
            </InfoHelpTooltip>
          </div>
          <span className="caption">
            {periodLabel} · 총 {rows.length}건
          </span>
        </div>
      ) : null}

      {truncated ? (
        <p className="subtle">연속 페이지가 많아 일부 내역만 불러왔습니다.</p>
      ) : null}
      {error ? <p className="error-text">실현손익 내역 조회 실패: {error}</p> : null}
      {isLoading ? <p className="subtle">데이터를 조회하는 중입니다...</p> : null}
      {!isLoading && !error && hasFetched && rows.length === 0 ? (
        <p className="subtle">조회된 실현손익 내역이 없습니다.</p>
      ) : null}
      {!isLoading && !error && hasFetched && rows.length > 0 ? (
        <>
          <div className="table-scroll evaluation-table-desktop-wrap">
            <table className="data-table evaluation-table evaluation-table--realized-period">
              <colgroup>
                <col className="col-name" />
                <col className="col-buy-date" />
                <col className="col-pl" />
                <col className="col-rate" />
                <col className="col-price" />
                <col className="col-qty" />
              </colgroup>
              <thead>
                <tr>
                  <th className="col-name">종목명</th>
                  <th
                    className="col-buy-date th-sortable"
                    aria-sort={
                      sort?.field === 'dt' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => cycleSort('dt')}
                      title="클릭: 최근순 → 과거순 → 원래 순서"
                    >
                      매도일
                      <span className="th-sort-icons" aria-hidden="true">
                        {sort?.field === 'dt' ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : ''}
                      </span>
                    </button>
                  </th>
                  <th
                    className="col-pl num th-sortable"
                    aria-sort={
                      sort?.field === 'tdy_sel_pl'
                        ? sort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => cycleSort('tdy_sel_pl')}
                      title="클릭: 높은순 → 낮은순 → 원래 순서"
                    >
                      당일매도손익
                      <span className="th-sort-icons" aria-hidden="true">
                        {sort?.field === 'tdy_sel_pl' ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : ''}
                      </span>
                    </button>
                  </th>
                  <th
                    className="col-rate num th-sortable"
                    aria-sort={
                      sort?.field === 'pl_rt' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => cycleSort('pl_rt')}
                      title="클릭: 높은순 → 낮은순 → 원래 순서"
                    >
                      손익율
                      <span className="th-sort-icons" aria-hidden="true">
                        {sort?.field === 'pl_rt' ? (sort.dir === 'desc' ? ' ▼' : ' ▲') : ''}
                      </span>
                    </button>
                  </th>
                  <th className="col-price num">매입단가</th>
                  <th className="col-qty num">체결량</th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((item, index) => {
                  const d = getRealizedByPeriodRowDisplay(item)
                  return (
                    <tr key={`${item?.dt || 'dt'}-${item?.stk_cd || 'stk'}-${index}`}>
                      <td className="col-name">
                        <span className="stock-name-with-code" data-code={d.stockCode}>
                          {d.stockName}
                        </span>
                      </td>
                      <td className="col-buy-date">{d.dtText}</td>
                      <td className={`col-pl num ${d.pnlTone ? `delta ${d.pnlTone}` : ''}`}>{d.tdySelPlText}</td>
                      <td className={`col-rate num ${d.profitTone ? `delta ${d.profitTone}` : ''}`}>{d.plRtText}</td>
                      <td className="col-price num">{d.buyUvText}</td>
                      <td className="col-qty num">{d.cntrQtyText}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="evaluation-balance-mobile-block">
            <div className="evaluation-mobile-sort-bar" role="toolbar" aria-label="실현손익 내역 정렬">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => cycleSort('dt')}
                aria-pressed={sortMetaDt.ariaPressed}
                aria-label={sortMetaDt.ariaLabel}
              >
                {sortMetaDt.name}
                <span aria-hidden="true">{sortMetaDt.icon}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => cycleSort('tdy_sel_pl')}
                aria-pressed={sortMetaPnl.ariaPressed}
                aria-label={sortMetaPnl.ariaLabel}
              >
                {sortMetaPnl.name}
                <span aria-hidden="true">{sortMetaPnl.icon}</span>
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => cycleSort('pl_rt')}
                aria-pressed={sortMetaPrft.ariaPressed}
                aria-label={sortMetaPrft.ariaLabel}
              >
                {sortMetaPrft.name}
                <span aria-hidden="true">{sortMetaPrft.icon}</span>
              </button>
            </div>
            <ul className="evaluation-balance-list-mobile">
              {sortedRows.map((item, index) => (
                <RealizedByPeriodMobileCard
                  key={`${item?.dt || 'dt'}-${item?.stk_cd || 'stk'}-m-${index}`}
                  item={item}
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
