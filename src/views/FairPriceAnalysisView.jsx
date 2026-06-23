import { useCallback, useEffect, useMemo, useState } from 'react'
import InfoHelpTooltip from '../components/InfoHelpTooltip.jsx'
import { ApiError, crawlEstimateNetIncome, fetchEstimateNetIncomeAnalysis, fetchEstimateNetIncomeCrawlPreview } from '../lib/api.js'

const CRAWL_ACCOUNT_ID = '81279931'
const ANALYSIS_PER = 10

function formatEstimatedDuration(seconds) {
  const totalSeconds = Math.max(0, Math.round(Number(seconds) || 0))
  if (totalSeconds < 30) {
    return '30초 미만'
  }
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  if (hours > 0 && minutes > 0) {
    return `약 ${hours}시간 ${minutes}분`
  }
  if (hours > 0) {
    return `약 ${hours}시간`
  }
  return `약 ${Math.max(1, minutes)}분`
}

function buildAllCrawlConfirmMessage(preview, sleepSeconds) {
  const totalCount = Number(preview?.total_count) || 0
  const estimatedSeconds = Number(preview?.estimated_seconds) || 0
  const sleepLabel = Number.isFinite(Number(sleepSeconds)) ? String(sleepSeconds) : '-'
  return [
    '전체 크롤을 시작합니다.',
    '',
    `· 대상: ${totalCount.toLocaleString('ko-KR')}종목`,
    `· 예상 소요: ${formatEstimatedDuration(estimatedSeconds)}`,
    `· 요청 간 대기: ${sleepLabel}초`,
    '',
    '계속 진행할까요?',
  ].join('\n')
}

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

function formatGapRate(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return '—'
  }
  return `${number.toFixed(1)}%`
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

function getFailedCrawlItems(result) {
  if (!Array.isArray(result?.items)) {
    return []
  }
  return result.items.filter((item) => item?.status === 'failed')
}

function renderCrawlResultContent(result) {
  if (!result) {
    return null
  }

  const completedCount = Number(result.completed_count) || 0
  const totalCount = Number(result.total_count) || 0
  const linkedRowCount = Number(result.linked_row_count) || 0

  if (result.scope === 'all') {
    const failedItems = getFailedCrawlItems(result)
    const failedCount = failedItems.length > 0 ? failedItems.length : Math.max(0, totalCount - completedCount)
    return (
      <>
        <p className="net-income-crawl-result-summary">
          <span className="net-income-crawl-result-stat">
            연동완료 {completedCount.toLocaleString('ko-KR')}/{totalCount.toLocaleString('ko-KR')}종목
          </span>
          {linkedRowCount > 0 ? (
            <span className="net-income-crawl-result-meta">
              · 저장 {linkedRowCount.toLocaleString('ko-KR')}건
            </span>
          ) : null}
          {failedCount > 0 ? (
            <span className="net-income-crawl-result-meta net-income-crawl-result-meta--warn">
              · 실패 {failedCount.toLocaleString('ko-KR')}종목
            </span>
          ) : null}
        </p>
        {failedItems.length > 0 ? (
          <div className="net-income-crawl-failed-block">
            <p className="net-income-crawl-failed-title">실패 종목</p>
            <ul className="net-income-crawl-failed-list">
              {failedItems.map((item) => (
                <li key={item.stock_code} className="net-income-crawl-failed-item">
                  <span className="net-income-crawl-result-stat">{item.stock_code || '—'}</span>
                  <span className="net-income-crawl-result-meta"> · {item.error || '오류'}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </>
    )
  }

  const item = Array.isArray(result.items) ? result.items[0] : null
  if (!item) {
    return (
      <p className="net-income-crawl-result-summary">
        <span className="net-income-crawl-result-stat">
          연동완료 {completedCount.toLocaleString('ko-KR')}/{totalCount.toLocaleString('ko-KR')}종목
        </span>
      </p>
    )
  }

  if (item.status === 'failed') {
    return (
      <p className="net-income-crawl-result-summary net-income-crawl-result-summary--failed">
        <span className="net-income-crawl-result-stat">{item.stock_code}</span>
        <span className="net-income-crawl-result-meta"> · 연동 실패 · {item.error || '오류'}</span>
      </p>
    )
  }

  const namePart = item.stock_name ? ` ${item.stock_name}` : ''
  return (
    <p className="net-income-crawl-result-summary">
      <span className="net-income-crawl-result-stat">
        {item.stock_code}
        {namePart}
      </span>
      <span className="net-income-crawl-result-meta">
        {' '}
        · 연동완료 {formatNumber(item.linked_count)}건
        {item.market_cap != null ? ` · 시총 ${formatNumber(item.market_cap)}억원` : ''}
      </span>
    </p>
  )
}

export default function FairPriceAnalysisView() {
  const [crawlScope, setCrawlScope] = useState('single')
  const [stockCode, setStockCode] = useState('')
  const [sleepSeconds, setSleepSeconds] = useState('0.5')
  const [crawlLoading, setCrawlLoading] = useState(false)
  const [crawlError, setCrawlError] = useState('')
  const [crawlResult, setCrawlResult] = useState(null)
  const [crawlPreviewCache, setCrawlPreviewCache] = useState(null)

  const [stockNameInput, setStockNameInput] = useState('')
  const [stockName, setStockName] = useState('')
  const [estimatePeriod, setEstimatePeriod] = useState('')
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortBy, setSortBy] = useState('gap_rate')
  const [sortOrder, setSortOrder] = useState('desc')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [manualReloadTick, setManualReloadTick] = useState(0)

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize) || 1), [pageSize, total])
  const isGapRateSort = sortBy === 'gap_rate'
  const gapRateSortIcon = isGapRateSort ? (sortOrder === 'desc' ? '▼' : '▲') : '⇅'
  const gapRateSortLabel = isGapRateSort
    ? sortOrder === 'desc'
      ? '괴리율 높은순'
      : '괴리율 낮은순'
    : '괴리율 정렬'
  const tableColumns = useMemo(
    () => [
      { key: 'stock_name', label: '종목명', colClass: 'col-name', sortable: true },
      { key: 'market_name', label: '마켓', colClass: 'col-market', sortable: false },
      { key: 'estimate_202812', label: formatEstimatePeriodLabel(estimatePeriod), colClass: 'col-price', sortable: true },
      { key: 'market_cap', label: '시가총액', colClass: 'col-pl', sortable: true },
      { key: 'fair_market_cap', label: '적정시가총액', colClass: 'col-pl', sortable: true },
      { key: 'gap_rate', label: '괴리율(%)', colClass: 'col-rate', sortable: true },
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
  }, [stockName, page, pageSize, sortBy, sortOrder])

  useEffect(() => {
    loadData()
  }, [loadData, manualReloadTick])

  function applyFilters(event) {
    event.preventDefault()
    const nextStockName = stockNameInput.trim()
    const shouldManualReload = nextStockName === stockName && page === 1
    setStockName(nextStockName)
    setPage(1)
    if (shouldManualReload) {
      setManualReloadTick((prev) => prev + 1)
    }
  }

  function resetFilters() {
    const shouldManualReload =
      stockNameInput === '' && stockName === '' && page === 1 && sortBy === 'gap_rate' && sortOrder === 'desc'
    setStockName('')
    setStockNameInput('')
    setPage(1)
    setSortBy('gap_rate')
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
      setSortOrder(columnKey === 'gap_rate' ? 'desc' : 'asc')
    }
    setPage(1)
  }

  function goPage(nextPage) {
    const clamped = Math.min(Math.max(1, nextPage), totalPages)
    setPage(clamped)
  }

  async function runCrawl() {
    const stockCodeValue = stockCode.trim()
    const sleepValue = Number(sleepSeconds)
    if (crawlScope === 'single' && !/^\d{6}$/.test(stockCodeValue)) {
      setCrawlError('종목코드를 크롤할 때는 6자리 숫자로 입력하세요.')
      return
    }
    if (!Number.isFinite(sleepValue) || sleepValue < 0 || sleepValue > 3) {
      setCrawlError('요청 간 대기는 0~3초 사이로 입력하세요.')
      return
    }

    setCrawlLoading(true)
    setCrawlError('')
    setCrawlResult(null)
    try {
      if (crawlScope === 'all') {
        const previewKey = `${CRAWL_ACCOUNT_ID}:${sleepValue}`
        let preview =
          crawlPreviewCache?.key === previewKey ? crawlPreviewCache.data : null
        if (!preview) {
          preview = await fetchEstimateNetIncomeCrawlPreview({
            sleep_seconds: sleepValue,
            account_id: CRAWL_ACCOUNT_ID,
          })
          setCrawlPreviewCache({ key: previewKey, data: preview })
        }
        const confirmed = window.confirm(buildAllCrawlConfirmMessage(preview, sleepValue))
        if (!confirmed) {
          return
        }
      }

      const params = { sleep_seconds: sleepValue, account_id: CRAWL_ACCOUNT_ID }
      if (crawlScope === 'single') {
        params.stock_code = stockCodeValue
      }
      const data = await crawlEstimateNetIncome(params)
      setCrawlPreviewCache(null)
      setCrawlResult(data)
      setPage(1)
      await loadData()
    } catch (crawlErr) {
      setCrawlError(formatApiErrorDetail(crawlErr))
    } finally {
      setCrawlLoading(false)
    }
  }

  return (
    <section className="dashboard">
      <section className="card net-income-crawl-card">
        <div className="benchmark-head">
          <p className="caption">연간 순이익(E) 크롤 + MongoDB 저장</p>
          <div className="snapshot-chart-title-row">
            <h2 className="snapshot-chart-title">순이익(E) 크롤</h2>
            <InfoHelpTooltip ariaLabel="적정주가 크롤 설명">
              <p className="subtle snapshot-chart-help-text">
                전체 또는 종목코드 기준으로 연간 당기순이익(지배) 예상치와 시장 스냅샷을 수집해
                저장합니다. 순이익은 호출 시점 기준 당해·1년 후·2년 후 연간 예상치만 수집합니다.
                전체 크롤은 키움증권 조건검색 0번(코스피 시총 1200억+) 유니버스를 사용합니다.
              </p>
            </InfoHelpTooltip>
          </div>
        </div>

        <div className="net-income-crawl-panel">
          <div
            className={`net-income-crawl-controls${
              crawlScope === 'single' ? ' net-income-crawl-controls--single' : ''
            }`}
          >
            <div className="form-field net-income-crawl-account-field">
              <label htmlFor="fp-account-id">계좌번호</label>
              <input
                id="fp-account-id"
                className="net-income-crawl-account-input"
                type="text"
                value={CRAWL_ACCOUNT_ID}
                readOnly
                tabIndex={-1}
                aria-readonly="true"
              />
            </div>
            <div className="form-field net-income-crawl-scope-field">
              <label htmlFor="fp-crawl-scope">크롤 범위</label>
              <select
                id="fp-crawl-scope"
                value={crawlScope}
                disabled={crawlLoading}
                onChange={(e) => {
                  setCrawlScope(e.target.value)
                  setCrawlPreviewCache(null)
                }}
              >
                <option value="all">전체</option>
                <option value="single">종목코드</option>
              </select>
            </div>

            <div className="form-field net-income-crawl-stock-field">
              <label htmlFor="fp-stock-code">종목코드</label>
              <input
                id="fp-stock-code"
                className="net-income-crawl-stock-input"
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoComplete="off"
                value={stockCode}
                onChange={(e) => setStockCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="예: 005930"
                disabled={crawlLoading || crawlScope !== 'single'}
                aria-disabled={crawlScope !== 'single'}
              />
            </div>

            <div className="form-field net-income-crawl-sleep-field">
              <label htmlFor="fp-sleep">요청 간 대기(초)</label>
              <input
                id="fp-sleep"
                className="net-income-crawl-sleep"
                type="number"
                min={0}
                max={3}
                step={0.1}
                value={sleepSeconds}
                onChange={(e) => {
                  setSleepSeconds(e.target.value)
                  setCrawlPreviewCache(null)
                }}
                disabled={crawlLoading}
              />
            </div>

            <div className="form-field net-income-crawl-action-field">
              <span className="form-field-label-spacer" aria-hidden="true">
                &nbsp;
              </span>
              <button
                type="button"
                className="btn btn-primary net-income-crawl-run-btn"
                disabled={crawlLoading}
                onClick={() => void runCrawl()}
              >
                {crawlLoading
                  ? crawlScope === 'all'
                    ? '전체 크롤 중…'
                    : '크롤 중…'
                  : crawlScope === 'all'
                    ? '전체 크롤'
                    : '크롤'}
              </button>
            </div>
          </div>

          {crawlScope === 'all' ? (
            <p className="net-income-crawl-hint">
              코스피 시총 1200억+ 조건검색 유니버스 전체를 크롤합니다. (키움증권 조건검색 0번)
            </p>
          ) : null}

          {(crawlError || crawlResult) && (
            <div className="net-income-crawl-feedback" aria-live="polite">
              {crawlError ? (
                <p className="error-banner" role="alert">
                  {crawlError}
                </p>
              ) : null}
              {crawlResult ? (
                <div
                  className={`net-income-crawl-result${
                    getFailedCrawlItems(crawlResult).length > 0 ? ' net-income-crawl-result--has-failures' : ''
                  }`}
                  role="status"
                >
                  {renderCrawlResultContent(crawlResult)}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="card fair-price-analysis-card">
        <div className="benchmark-head">
          <p className="caption">분석 &gt; 적정주가 분석</p>
          <div className="snapshot-chart-title-row">
            <h2 className="snapshot-chart-title">종목별 적정주가 분석</h2>
          </div>
        </div>

        <form className="evaluation-control-grid" onSubmit={applyFilters}>
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
            <label htmlFor="fp-page-size">페이지 크기</label>
            <select
              id="fp-page-size"
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value) || 50)
                setPage(1)
              }}
            >
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
            </select>
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
              <p className="subtle">
                분석 대상 선정/상세수집/순이익(E) 크롤 이후 다시 조회해 주세요.
              </p>
            </>
          ) : null}

          {rows.length > 0 ? (
            <>
              <div className="table-scroll evaluation-table-desktop-wrap">
                <table className="data-table evaluation-table evaluation-table--fair-price">
                  <colgroup>
                    <col className="col-name" />
                    <col className="col-market" />
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
                    {rows.map((row) => (
                      <tr key={row.stock_code}>
                        <td className="col-name">{row.stock_name || '—'}</td>
                        <td className="col-market">{row.market_name || '—'}</td>
                        <td className="col-price num">{formatNumber(row.estimate_202812)}</td>
                        <td className="col-pl num">{formatNumber(row.market_cap)}</td>
                        <td className="col-pl num">{formatNumber(row.fair_market_cap)}</td>
                        <td className={`col-rate num ${gapRateTone(row.gap_rate) ? `delta ${gapRateTone(row.gap_rate)}` : ''}`}>
                          {formatGapRate(row.gap_rate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="fair-price-mobile-block">
                <div className="fair-price-mobile-sort-bar" role="toolbar" aria-label="종목 목록 정렬">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => toggleSort('gap_rate')}
                    disabled={loading}
                    aria-pressed={isGapRateSort}
                    aria-label={`괴리율 정렬 (${gapRateSortLabel})`}
                  >
                    괴리율
                    <span aria-hidden="true"> {gapRateSortIcon}</span>
                  </button>
                </div>
                <ul className="fair-price-mobile-list">
                  {rows.map((row) => (
                    <li key={`${row.stock_code}-m`} className="fair-price-mobile-item">
                      <div className="fair-price-mobile-head">
                        <p className="fair-price-mobile-name">{row.stock_name || '—'}</p>
                        <p className="fair-price-mobile-meta">
                          {row.stock_code}
                          {row.market_name ? ` · ${row.market_name}` : ''}
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
                          <dt>괴리율</dt>
                          <dd className={gapRateTone(row.gap_rate) ? `delta ${gapRateTone(row.gap_rate)}` : ''}>
                            {formatGapRate(row.gap_rate)}
                          </dd>
                        </div>
                      </dl>
                    </li>
                  ))}
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
