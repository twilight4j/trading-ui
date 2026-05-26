import { useCallback, useEffect, useState } from 'react'
import { ApiError, crawlQuarterlyNetIncome, fetchQuarterlyNetIncomeAnalysis } from '../lib/api.js'
import { getToneByNumericString } from '../lib/formatApi.js'

const PERIOD_KEYS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']

const FIN_TYPE_OPTIONS = [
  { value: 'MAIN', label: 'MAIN (주재무제표)' },
  { value: 'GAAPS', label: 'GAAPS' },
  { value: 'GAAPL', label: 'GAAPL' },
  { value: 'IFRSS', label: 'IFRSS' },
  { value: 'IFRSL', label: 'IFRSL' },
]

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

function isValidStockCode(value) {
  return /^\d{6}$/.test(String(value || '').trim())
}

const SORTABLE_COLUMNS = [
  { key: 'stock_code', label: '종목' },
  { key: 'stock_name', label: '종목명' },
  { key: 'market_name', label: '마켓' },
  ...PERIOD_KEYS.map((key, index) => ({ key, label: `분기${index + 1}` })),
]

function isEstimatePeriodLabel(label) {
  return String(label || '').includes('(E)')
}

function cellTone(value) {
  return getToneByNumericString(String(value || '').trim())
}

function formatCellDisplay(value) {
  const text = String(value || '').trim()
  return text || '—'
}

export default function QuarterlyNetIncomeAnalysisView() {
  const [finType, setFinType] = useState('MAIN')
  const [crawlStockCode, setCrawlStockCode] = useState('')
  const [crawlSleepSeconds, setCrawlSleepSeconds] = useState('1')
  const [crawlLoading, setCrawlLoading] = useState(false)
  const [crawlError, setCrawlError] = useState('')
  const [crawlResult, setCrawlResult] = useState(null)

  const [marketName, setMarketName] = useState('')
  const [stockName, setStockName] = useState('')
  const [stockNameInput, setStockNameInput] = useState('')

  const [periods, setPeriods] = useState([])
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [sortBy, setSortBy] = useState('stock_code')
  const [sortOrder, setSortOrder] = useState('asc')

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const totalPages = Math.max(1, Math.ceil(total / pageSize) || 1)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError('')
    try {
      const data = await fetchQuarterlyNetIncomeAnalysis({
        fin_type: finType,
        market_name: marketName || undefined,
        stock_name: stockName || undefined,
        page,
        page_size: pageSize,
        sort_by: sortBy,
        sort_order: sortOrder,
      })
      setPeriods(Array.isArray(data?.periods) ? data.periods : [])
      setRows(Array.isArray(data?.rows) ? data.rows : [])
      setTotal(Number(data?.total) || 0)
      if (data?.page) {
        setPage(Number(data.page) || 1)
      }
    } catch (loadError) {
      setPeriods([])
      setRows([])
      setTotal(0)
      setError(loadError instanceof Error ? loadError.message : String(loadError))
    } finally {
      setIsLoading(false)
    }
  }, [finType, marketName, stockName, page, pageSize, sortBy, sortOrder])

  useEffect(() => {
    loadData()
  }, [loadData])

  function applyFilters(event) {
    event.preventDefault()
    setStockName(stockNameInput.trim())
    setPage(1)
  }

  function resetFilters() {
    setMarketName('')
    setStockName('')
    setStockNameInput('')
    setPage(1)
    setSortBy('stock_code')
    setSortOrder('asc')
  }

  function toggleSort(columnKey) {
    if (sortBy === columnKey) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(columnKey)
      setSortOrder('asc')
    }
    setPage(1)
  }

  function goPage(nextPage) {
    const clamped = Math.min(Math.max(1, nextPage), totalPages)
    setPage(clamped)
  }

  const crawlStockCodeTrimmed = crawlStockCode.trim()
  const crawlCodeValid = isValidStockCode(crawlStockCodeTrimmed)

  async function runCrawl() {
    if (!crawlCodeValid) {
      setCrawlError('종목코드는 6자리 숫자로 입력하세요.')
      return
    }
    const sleep = Number(crawlSleepSeconds)
    if (!Number.isFinite(sleep) || sleep < 0 || sleep > 30) {
      setCrawlError('요청 간 대기는 0~30초 사이로 입력하세요.')
      return
    }

    setCrawlLoading(true)
    setCrawlError('')
    setCrawlResult(null)
    try {
      const data = await crawlQuarterlyNetIncome({
        stock_code: crawlStockCodeTrimmed,
        fin_type: finType,
        sleep_seconds: sleep,
      })
      setCrawlResult(data)
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
          <p className="caption">FnGuide (WiseReport) → PostgreSQL upsert</p>
          <h2>당기순이익 크롤·저장</h2>
          <p className="subtle">종목별로 크롤하며, 완료 후 아래 표가 갱신됩니다. 재무구분은 분석 조회와 동일합니다.</p>
        </div>

        <div className="evaluation-control-grid net-income-crawl-grid">
          <div className="form-field">
            <label htmlFor="ni-crawl-code">종목코드</label>
            <input
              id="ni-crawl-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="예: 005930"
              value={crawlStockCode}
              onChange={(e) => setCrawlStockCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              disabled={crawlLoading}
            />
          </div>
          <div className="form-field">
            <label htmlFor="ni-crawl-fin-type">재무구분</label>
            <select
              id="ni-crawl-fin-type"
              value={finType}
              onChange={(e) => setFinType(e.target.value)}
              disabled={crawlLoading || isLoading}
            >
              {FIN_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="ni-crawl-sleep">요청 간 대기(초)</label>
            <input
              id="ni-crawl-sleep"
              type="number"
              min={0}
              max={30}
              step={0.1}
              value={crawlSleepSeconds}
              onChange={(e) => setCrawlSleepSeconds(e.target.value)}
              disabled={crawlLoading}
            />
          </div>
          <div className="form-field form-field-actions">
            <span className="form-field-label-spacer" aria-hidden="true">
              &nbsp;
            </span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={crawlLoading || !crawlCodeValid}
              onClick={() => void runCrawl()}
            >
              {crawlLoading ? '크롤 중…' : '크롤 및 저장'}
            </button>
          </div>
        </div>

        {crawlError ? <p className="error-text">{crawlError}</p> : null}
        {crawlResult ? (
          <p className="success-text">
            {crawlResult.stock_code} · {crawlResult.fin_type} ·{' '}
            {Number(crawlResult.row_count).toLocaleString('ko-KR')}분기 저장
          </p>
        ) : null}
      </section>

      <section className="card">
        <div className="benchmark-head">
          <p className="caption">PostgreSQL · quarterly_net_income</p>
          <h2>당기순이익</h2>
          <p className="subtle">
            최근 24개월 내 분기 중 8개 분기를 과거→최신 순으로 가로축에 피벗한 당기순이익(지배) 표입니다. 추정 분기는
            컬럼명에 <code>(E)</code>를 붙이고, 해당 열은 연한 배경으로 표시합니다.
          </p>
        </div>

        <form className="evaluation-control-grid" onSubmit={applyFilters}>
          <div className="form-field">
            <label htmlFor="ni-market">마켓</label>
            <select
              id="ni-market"
              value={marketName}
              onChange={(e) => {
                setMarketName(e.target.value)
                setPage(1)
              }}
            >
              <option value="">전체</option>
              <option value="코스피">코스피</option>
              <option value="코스닥">코스닥</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="ni-stock">종목명/코드</label>
            <input
              id="ni-stock"
              type="search"
              value={stockNameInput}
              onChange={(e) => setStockNameInput(e.target.value)}
              placeholder="부분 검색"
            />
          </div>
          <div className="form-field">
            <label htmlFor="ni-page-size">페이지 크기</label>
            <select
              id="ni-page-size"
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
            <div className="btn-row">
              <button type="submit" className="btn btn-primary" disabled={isLoading}>
                조회
              </button>
              <button type="button" className="btn" onClick={resetFilters} disabled={isLoading}>
                초기화
              </button>
            </div>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-header evaluation-list-section-header">
          <h2>종목별 당기순이익</h2>
          <span className="caption">
            총 {total.toLocaleString('ko-KR')}건 · {page}/{totalPages}페이지
          </span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
        {isLoading ? <p className="subtle">데이터를 조회하는 중입니다...</p> : null}

        {!isLoading && rows.length === 0 && !error ? (
          <p className="subtle">조회된 데이터가 없습니다.</p>
        ) : null}

        {!isLoading && rows.length > 0 ? (
          <>
            <div className="table-scroll evaluation-table-desktop-wrap net-income-table-wrap">
              <table className="data-table evaluation-table net-income-analysis-table">
                <colgroup>
                  <col className="ni-col-code" />
                  <col className="ni-col-name" />
                  <col className="ni-col-market" />
                  {PERIOD_KEYS.map((key) => (
                    <col key={key} className="ni-col-period" />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    {SORTABLE_COLUMNS.map((col) => {
                      const periodIndex = col.key.startsWith('p') ? PERIOD_KEYS.indexOf(col.key) : -1
                      const periodLabel =
                        periodIndex >= 0 && periods.length > 0
                          ? periods[periodIndex] || col.label
                          : col.label
                      const isEstimateColumn =
                        periodIndex >= 0 && isEstimatePeriodLabel(periodLabel)
                      const headerLabel =
                        col.key === 'stock_code'
                          ? '종목'
                          : col.key === 'stock_name'
                            ? '종목명'
                            : col.key === 'market_name'
                              ? '마켓'
                              : periodLabel
                      return (
                        <th
                          key={col.key}
                          className={`${col.key.startsWith('p') || col.key === 'stock_code' ? 'num th-sortable' : 'th-sortable'} ${isEstimateColumn ? 'net-income-estimate' : ''}`}
                          aria-sort={
                            sortBy === col.key
                              ? sortOrder === 'asc'
                                ? 'ascending'
                                : 'descending'
                              : 'none'
                          }
                        >
                          <button
                            type="button"
                            className="th-sort-btn"
                            onClick={() => toggleSort(col.key)}
                            title="정렬"
                          >
                            {headerLabel}
                            <span className="th-sort-icons" aria-hidden="true">
                              {sortBy === col.key ? (sortOrder === 'desc' ? ' ▼' : ' ▲') : ''}
                            </span>
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.stock_code}>
                      <td className="num ni-col-code-cell">{row.stock_code}</td>
                      <td className="ni-col-name-cell" title={row.stock_name || undefined}>
                        {row.stock_name || '—'}
                      </td>
                      <td className="ni-col-market-cell">{row.market_name || '—'}</td>
                      {PERIOD_KEYS.map((key) => {
                        const periodIndex = PERIOD_KEYS.indexOf(key)
                        const value = row[key]
                        const tone = cellTone(value)
                        const isEstimateColumn = isEstimatePeriodLabel(periods[periodIndex])
                        return (
                          <td
                            key={`${row.stock_code}-${key}`}
                            className={`num ${tone ? `delta ${tone}` : ''} ${isEstimateColumn ? 'net-income-estimate' : ''}`}
                          >
                            {formatCellDisplay(value)}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="evaluation-pagination btn-row">
              <button type="button" className="btn" disabled={page <= 1 || isLoading} onClick={() => goPage(1)}>
                처음
              </button>
              <button
                type="button"
                className="btn"
                disabled={page <= 1 || isLoading}
                onClick={() => goPage(page - 1)}
              >
                이전
              </button>
              <span className="caption">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                className="btn"
                disabled={page >= totalPages || isLoading}
                onClick={() => goPage(page + 1)}
              >
                다음
              </button>
              <button
                type="button"
                className="btn"
                disabled={page >= totalPages || isLoading}
                onClick={() => goPage(totalPages)}
              >
                마지막
              </button>
            </div>
          </>
        ) : null}
      </section>
    </section>
  )
}
