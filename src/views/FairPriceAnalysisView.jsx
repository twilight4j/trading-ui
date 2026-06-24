import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, fetchEstimateNetIncomeAnalysis } from '../lib/api.js'

const ANALYSIS_PER = 10

function formatEstimatePeriodLabel(period) {
  const text = String(period ?? '').trim()
  if (text.length !== 6) {
    return 'E'
  }
  return `${text.slice(0, 4)}/${text.slice(4, 6)}(E)`
}

function formatApiErrorDetail(error) {
  if (error instanceof ApiError) {
    const detail = error.detail
    if (typeof detail === 'string') {
      return detail
    }
    if (detail != null) {
      return JSON.stringify(detail)
    }
  }
  return error instanceof Error ? error.message : String(error)
}

function formatNumber(value) {
  if (value === null || value === undefined || value === '') {
    return '—'
  }
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return '—'
  }
  return number.toLocaleString('ko-KR')
}

function truncateToOneDecimal(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return null
  }
  return Math.trunc(number * 10) / 10
}

function computeUpsideRate(marketCap, fairMarketCap) {
  const p = Number(marketCap)
  const k = Number(fairMarketCap)
  if (!Number.isFinite(p) || !Number.isFinite(k) || p <= 0) {
    return null
  }
  const upsideRate = ((k / p) - 1) * 100
  return Number.isFinite(upsideRate) ? upsideRate : null
}

function formatUpsideRate(value) {
  const upsideRate = Number(value)
  if (!Number.isFinite(upsideRate)) {
    return '—'
  }
  const truncated = truncateToOneDecimal(upsideRate)
  if (truncated == null) {
    return '—'
  }
  return `${truncated.toFixed(1)}%`
}

function resolveUpsideRate(row) {
  const fromApi = Number(row?.upside_rate)
  if (Number.isFinite(fromApi)) {
    return fromApi
  }
  const fallback = computeUpsideRate(row?.market_cap, row?.fair_market_cap)
  return Number.isFinite(fallback) ? fallback : null
}

function gapRateTone(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return ''
  }
  if (number > 0) {
    return 'up'
  }
  if (number < 0) {
    return 'down'
  }
  return ''
}

export default function FairPriceAnalysisView() {
  const [stockNameInput, setStockNameInput] = useState('')
  const [stockName, setStockName] = useState('')
  const [upNameInput, setUpNameInput] = useState('')
  const [upName, setUpName] = useState('')
  const [marketScopeInput, setMarketScopeInput] = useState('kospi')
  const [marketScope, setMarketScope] = useState('kospi')
  const [marketCapMinInput, setMarketCapMinInput] = useState('')
  const [marketCapMin, setMarketCapMin] = useState(null)
  const [estimatePeriod, setEstimatePeriod] = useState('')
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const pageSize = 50
  const [sortBy, setSortBy] = useState('upside_rate')
  const [sortOrder, setSortOrder] = useState('desc')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [manualReloadTick, setManualReloadTick] = useState(0)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize) || 1), [pageSize, total])
  const isUpsideRateSort = sortBy === 'upside_rate'
  const upsideRateSortIcon = isUpsideRateSort ? (sortOrder === 'desc' ? '▼' : '▲') : '⇅'
  const upsideRateSortLabel = isUpsideRateSort
    ? sortOrder === 'desc'
      ? '상승여력 높은순'
      : '상승여력 낮은순'
    : '상승여력 정렬'
  const tableColumns = useMemo(
    () => [
      { key: 'stock_name', label: '종목명', colClass: 'col-name', sortable: true },
      { key: 'market_name', label: '마켓', colClass: 'col-market', sortable: false },
      { key: 'up_name', label: '업종', colClass: 'col-up-name', sortable: false },
      { key: 'estimate_202812', label: formatEstimatePeriodLabel(estimatePeriod), colClass: 'col-price', sortable: true },
      { key: 'market_cap', label: '시가총액', colClass: 'col-pl', sortable: true },
      { key: 'fair_market_cap', label: '적정시가총액', colClass: 'col-pl', sortable: true },
      { key: 'upside_rate', label: '상승여력(%)', colClass: 'col-rate', sortable: true },
    ],
    [estimatePeriod],
  )

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchEstimateNetIncomeAnalysis({
        per: ANALYSIS_PER,
        stock_name: stockName || undefined,
        up_name: upName || undefined,
        market_scope: marketScope,
        market_cap_min: marketCapMin ?? undefined,
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      })
      setRows(Array.isArray(data?.rows) ? data.rows : [])
      setTotal(Number(data?.total) || 0)
      setEstimatePeriod(String(data?.estimate_period ?? ''))
      if (data?.page) {
        setPage(Number(data.page) || 1)
      }
    } catch (loadError) {
      setRows([])
      setTotal(0)
      setError(formatApiErrorDetail(loadError))
    } finally {
      setLoading(false)
    }
  }, [stockName, upName, marketScope, marketCapMin, page, pageSize, sortBy, sortOrder])

  useEffect(() => {
    loadData()
  }, [loadData, manualReloadTick])

  function applyFilters(event) {
    event.preventDefault()
    const nextStockName = stockNameInput.trim()
    const nextUpName = upNameInput.trim()
    const marketCapMinText = marketCapMinInput.trim()
    let nextMarketCapMin = null
    if (marketCapMinText !== '') {
      const parsed = Number(marketCapMinText)
      if (!Number.isFinite(parsed) || parsed < 0) {
        setError('시가총액 필터는 0 이상의 숫자로 입력하세요.')
        return
      }
      nextMarketCapMin = Math.floor(parsed)
    }
    const shouldManualReload =
      nextStockName === stockName &&
      nextUpName === upName &&
      marketScopeInput === marketScope &&
      nextMarketCapMin === marketCapMin &&
      page === 1
    setError('')
    setStockName(nextStockName)
    setUpName(nextUpName)
    setMarketScope(marketScopeInput)
    setMarketCapMin(nextMarketCapMin)
    setPage(1)
    if (shouldManualReload) {
      setManualReloadTick((prev) => prev + 1)
    }
  }

  function resetFilters() {
    const shouldManualReload =
      stockNameInput === '' &&
      stockName === '' &&
      upNameInput === '' &&
      upName === '' &&
      marketScopeInput === 'kospi' &&
      marketScope === 'kospi' &&
      marketCapMinInput === '' &&
      marketCapMin == null &&
      page === 1 &&
      sortBy === 'upside_rate' &&
      sortOrder === 'desc'
    setError('')
    setStockName('')
    setStockNameInput('')
    setUpName('')
    setUpNameInput('')
    setMarketScope('kospi')
    setMarketScopeInput('kospi')
    setMarketCapMin(null)
    setMarketCapMinInput('')
    setPage(1)
    setSortBy('upside_rate')
    setSortOrder('desc')
    if (shouldManualReload) {
      setManualReloadTick((prev) => prev + 1)
    }
  }

  function toggleSort(columnKey) {
    if (sortBy === columnKey) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(columnKey)
      setSortOrder(columnKey === 'upside_rate' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  function goPage(nextPage) {
    const clamped = Math.min(Math.max(1, nextPage), totalPages)
    setPage(clamped)
  }

  return (
    <section className="dashboard">
      <section className="card fair-price-analysis-card">
        <div className="benchmark-head">
          <p className="caption">분석 &gt; 적정주가 분석</p>
          <div className="snapshot-chart-title-row">
            <h2 className="snapshot-chart-title">종목별 적정주가 분석</h2>
          </div>
        </div>

        <form className="evaluation-control-grid" onSubmit={applyFilters}>
          <div className="form-field">
            <label htmlFor="fp-market-scope">시장 구분</label>
            <select id="fp-market-scope" value={marketScopeInput} onChange={(e) => setMarketScopeInput(e.target.value)}>
              <option value="all">전체</option>
              <option value="kospi">코스피</option>
              <option value="kosdaq">코스닥</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="fp-stock">종목명/코드</label>
            <input
              id="fp-stock"
              type="search"
              value={stockNameInput}
              onChange={(e) => setStockNameInput(e.target.value)}
              placeholder="부분 검색"
            />
          </div>
          <div className="form-field">
            <label htmlFor="fp-up-name">업종명</label>
            <input
              id="fp-up-name"
              type="search"
              value={upNameInput}
              onChange={(e) => setUpNameInput(e.target.value)}
              placeholder="부분 검색"
            />
          </div>
          <div className="form-field">
            <label htmlFor="fp-market-cap-min">시가총액(억원) 이상</label>
            <input
              id="fp-market-cap-min"
              type="number"
              min={0}
              step={1}
              value={marketCapMinInput}
              onChange={(e) => setMarketCapMinInput(e.target.value)}
              placeholder="미입력 시 전체"
            />
          </div>
          <div className="form-field form-field-actions">
            <span className="form-field-label-spacer" aria-hidden="true">
              &nbsp;
            </span>
            <div className="fair-price-action-row">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                조회
              </button>
              <button type="button" className="btn" onClick={resetFilters} disabled={loading}>
                초기화
              </button>
            </div>
          </div>
        </form>

        <div className="fair-price-analysis-table-section">
          <p className="caption fair-price-analysis-table-meta">
            총 {total.toLocaleString('ko-KR')}건 · {page}/{totalPages}페이지 · 단위: 억원 · PER {ANALYSIS_PER} 고정
          </p>

          {error ? <p className="error-text">{error}</p> : null}
          {loading ? <p className="subtle">데이터를 조회하는 중입니다...</p> : null}
          {!loading && rows.length === 0 && !error ? (
            <>
              <p className="subtle">조회된 데이터가 없습니다.</p>
              <p className="subtle">분석 대상 선정/상세수집/순이익(E) 크롤 이후 다시 조회해 주세요.</p>
            </>
          ) : null}

          {rows.length > 0 ? (
            <>
              <div className="table-scroll evaluation-table-desktop-wrap">
                <table className="data-table evaluation-table evaluation-table--fair-price">
                  <colgroup>
                    <col className="col-name" />
                    <col className="col-market" />
                    <col className="col-up-name" />
                    <col className="col-price" />
                    <col className="col-pl" />
                    <col className="col-pl" />
                    <col className="col-rate" />
                  </colgroup>
                  <thead>
                    <tr>
                      {tableColumns.map((col) =>
                        col.sortable ? (
                          <th
                            key={col.key}
                            className={`${col.colClass} ${col.key === 'stock_name' ? 'th-sortable' : 'num th-sortable'}`}
                            aria-sort={
                              sortBy === col.key ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
                            }
                          >
                            <button type="button" className="th-sort-btn" onClick={() => toggleSort(col.key)} title="정렬">
                              {col.label}
                              <span className="th-sort-icons" aria-hidden="true">
                                {sortBy === col.key ? (sortOrder === 'desc' ? ' ▼' : ' ▲') : ''}
                              </span>
                            </button>
                          </th>
                        ) : (
                          <th key={col.key} className={col.colClass} scope="col">
                            {col.label}
                          </th>
                        ),
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const upsideRate = resolveUpsideRate(row)
                      const upsideTone = gapRateTone(upsideRate)
                      return (
                        <tr key={row.stock_code}>
                          <td className="col-name">{row.stock_name || '—'}</td>
                          <td className="col-market">{row.market_name || '—'}</td>
                          <td className="col-up-name">{row.up_name || '—'}</td>
                          <td className="col-price num">{formatNumber(row.estimate_202812)}</td>
                          <td className="col-pl num">{formatNumber(row.market_cap)}</td>
                          <td className="col-pl num">{formatNumber(row.fair_market_cap)}</td>
                          <td className={`col-rate num ${upsideTone ? `delta ${upsideTone}` : ''}`}>
                            {formatUpsideRate(upsideRate)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="fair-price-mobile-block">
                <div className="fair-price-mobile-sort-bar" role="toolbar" aria-label="종목 목록 정렬">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => toggleSort('upside_rate')}
                    disabled={loading}
                    aria-pressed={isUpsideRateSort}
                    aria-label={`상승여력 정렬 (${upsideRateSortLabel})`}
                  >
                    상승여력
                    <span aria-hidden="true"> {upsideRateSortIcon}</span>
                  </button>
                </div>
                <ul className="fair-price-mobile-list">
                  {rows.map((row) => {
                    const upsideRate = resolveUpsideRate(row)
                    const upsideTone = gapRateTone(upsideRate)
                    return (
                      <li key={`${row.stock_code}-m`} className="fair-price-mobile-item">
                        <div className="fair-price-mobile-head">
                          <p className="fair-price-mobile-name">{row.stock_name || '—'}</p>
                          <p className="fair-price-mobile-meta">
                            {row.stock_code}
                            {row.market_name ? ` · ${row.market_name}` : ''}
                            {row.up_name ? ` · ${row.up_name}` : ''}
                          </p>
                        </div>
                        <dl className="fair-price-mobile-grid">
                          <div>
                            <dt>{formatEstimatePeriodLabel(estimatePeriod)}</dt>
                            <dd>{formatNumber(row.estimate_202812)}</dd>
                          </div>
                          <div>
                            <dt>시가총액</dt>
                            <dd>{formatNumber(row.market_cap)}</dd>
                          </div>
                          <div>
                            <dt>적정시가총액</dt>
                            <dd>{formatNumber(row.fair_market_cap)}</dd>
                          </div>
                          <div>
                            <dt>상승여력</dt>
                            <dd className={upsideTone ? `delta ${upsideTone}` : ''}>
                              {formatUpsideRate(upsideRate)}
                            </dd>
                          </div>
                        </dl>
                      </li>
                    )
                  })}
                </ul>
              </div>

              <nav className="evaluation-pagination" aria-label="목록 페이지">
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={page <= 1 || loading}
                  onClick={() => goPage(page - 1)}
                >
                  이전
                </button>
                <span className="pagination-status" aria-live="polite">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  className="pagination-btn"
                  disabled={page >= totalPages || loading}
                  onClick={() => goPage(page + 1)}
                >
                  다음
                </button>
              </nav>
            </>
          ) : null}
        </div>
      </section>
    </section>
  )
}
