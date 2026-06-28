import { useCallback, useEffect, useMemo, useState } from 'react'
import { ApiError, fetchEstimateNetIncomeAnalysis } from '../lib/api.js'

const PER_MODE_STOCK = 'stock'
const PER_MODE_MANUAL = 'manual'

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
  if (value === null || value === undefined || value === '') {
    return '—'
  }
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
  const rawFromApi = row?.upside_rate
  if (rawFromApi !== null && rawFromApi !== undefined && rawFromApi !== '') {
    const fromApi = Number(rawFromApi)
    if (Number.isFinite(fromApi)) {
      return fromApi
    }
  }
  const fallback = computeUpsideRate(row?.market_cap, row?.fair_market_cap)
  return Number.isFinite(fallback) ? fallback : null
}

function gapRateTone(value) {
  if (value === null || value === undefined || value === '') {
    return ''
  }
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

function formatMarketLabel(value) {
  const text = String(value ?? '').trim()
  if (text === '코스피') {
    return '코'
  }
  if (text === '코스닥') {
    return '닥'
  }
  return text || '—'
}

export default function FairPriceAnalysisView() {
  const [stockNameInput, setStockNameInput] = useState('')
  const [stockName, setStockName] = useState('')
  const [upNameInput, setUpNameInput] = useState('')
  const [upName, setUpName] = useState('')
  const [marketScopeInput, setMarketScopeInput] = useState('kospi')
  const [marketScope, setMarketScope] = useState('kospi')
  const [divYieldPresenceInput, setDivYieldPresenceInput] = useState('all')
  const [divYieldPresence, setDivYieldPresence] = useState('all')
  const [marketCapMinInput, setMarketCapMinInput] = useState('')
  const [marketCapMin, setMarketCapMin] = useState(null)
  const [perModeInput, setPerModeInput] = useState(PER_MODE_MANUAL)
  const [perMode, setPerMode] = useState(PER_MODE_MANUAL)
  const [perInput, setPerInput] = useState('10')
  const [per, setPer] = useState(10)
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
  const [copiedStockCode, setCopiedStockCode] = useState('')

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
      { key: 'per', label: 'PER', colClass: 'col-per', sortable: false },
      { key: 'div_yield', label: '배당수익률', colClass: 'col-per', sortable: false },
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
        per: per ?? undefined,
        stock_name: stockName || undefined,
        up_name: upName || undefined,
        market_scope: marketScope,
        div_yield_presence: divYieldPresence,
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
  }, [stockName, upName, marketScope, divYieldPresence, marketCapMin, page, pageSize, per, sortBy, sortOrder])

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
    const perText = perInput.trim()
    const nextPerMode = perModeInput === PER_MODE_STOCK ? PER_MODE_STOCK : PER_MODE_MANUAL
    let nextPer = null
    if (nextPerMode === PER_MODE_MANUAL) {
      if (perText === '') {
        setError('직접입력 모드에서는 PER를 입력하세요.')
        return
      }
      const parsedPer = Number(perText)
      if (!Number.isFinite(parsedPer) || parsedPer <= 0) {
        setError('PER는 0보다 큰 숫자로 입력하세요.')
        return
      }
      nextPer = parsedPer
    }
    const shouldManualReload =
      nextStockName === stockName &&
      nextUpName === upName &&
      marketScopeInput === marketScope &&
      divYieldPresenceInput === divYieldPresence &&
      nextMarketCapMin === marketCapMin &&
      nextPerMode === perMode &&
      nextPer === per &&
      page === 1
    setError('')
    setStockName(nextStockName)
    setUpName(nextUpName)
    setMarketScope(marketScopeInput)
    setDivYieldPresence(divYieldPresenceInput)
    setMarketCapMin(nextMarketCapMin)
    setPerMode(nextPerMode)
    setPer(nextPer)
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
      divYieldPresenceInput === 'all' &&
      divYieldPresence === 'all' &&
      marketCapMinInput === '' &&
      marketCapMin == null &&
      perModeInput === PER_MODE_MANUAL &&
      perMode === PER_MODE_MANUAL &&
      perInput === '10' &&
      per === 10 &&
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
    setDivYieldPresence('all')
    setDivYieldPresenceInput('all')
    setMarketCapMin(null)
    setMarketCapMinInput('')
    setPerModeInput(PER_MODE_MANUAL)
    setPerMode(PER_MODE_MANUAL)
    setPerInput('10')
    setPer(10)
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

  async function handleCopyStockCode(stockCode) {
    const code = String(stockCode || '').trim()
    if (!code) {
      return
    }
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code)
      } else {
        throw new Error('clipboard API unavailable')
      }
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = code
      textarea.setAttribute('readonly', 'true')
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }
    setCopiedStockCode(code)
    window.setTimeout(() => {
      setCopiedStockCode((prev) => (prev === code ? '' : prev))
    }, 1200)
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
              className="fair-price-search-input"
              type="search"
              value={stockNameInput}
              onChange={(e) => setStockNameInput(e.target.value)}
              placeholder="부분 검색"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
          </div>
          <div className="form-field">
            <label htmlFor="fp-up-name">업종명</label>
            <input
              id="fp-up-name"
              className="fair-price-search-input"
              type="search"
              name="industry_wics_keyword"
              value={upNameInput}
              onChange={(e) => setUpNameInput(e.target.value)}
              placeholder="부분 검색"
              autoComplete="new-password"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
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
          <div className="form-field">
            <label htmlFor="fp-div-yield-presence">배당수익률</label>
            <select
              id="fp-div-yield-presence"
              value={divYieldPresenceInput}
              onChange={(e) => setDivYieldPresenceInput(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="has">있음</option>
              <option value="none">없음</option>
            </select>
          </div>
          <div className="form-field fair-price-per-field">
            <label htmlFor="fp-per">PER</label>
            <div className="fair-price-per-control-row">
              <select id="fp-per-mode" value={perModeInput} onChange={(e) => setPerModeInput(e.target.value)}>
                <option value={PER_MODE_STOCK}>종목별PER</option>
                <option value={PER_MODE_MANUAL}>직접입력</option>
              </select>
              <input
                id="fp-per"
                className="fair-price-per-input"
                type="number"
                min={0.1}
                step={0.1}
                value={perInput}
                onChange={(e) => setPerInput(e.target.value)}
                placeholder="예: 10"
                disabled={perModeInput === PER_MODE_STOCK}
                aria-disabled={perModeInput === PER_MODE_STOCK}
              />
            </div>
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
            총 {total.toLocaleString('ko-KR')}건 · {page}/{totalPages}페이지 · 단위: 억원 ·{' '}
            {perMode === PER_MODE_MANUAL
              ? `적용 PER(입력) ${formatNumber(per)}`
              : '적용 PER: 종목별 DB 값(없으면 N/A)'}
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
                    <col className="col-per" />
                    <col className="col-per" />
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
                          <td className="col-name">
                            <div className="fair-price-name-cell">
                              <span className="fair-price-name-text">{row.stock_name || '—'}</span>
                              <button
                                type="button"
                                className="fair-price-copy-btn"
                                onClick={() => void handleCopyStockCode(row.stock_code)}
                                title={copiedStockCode === row.stock_code ? '복사됨' : '종목코드 복사'}
                                aria-label={`${row.stock_code || '종목'} 코드 복사`}
                              >
                                {copiedStockCode === row.stock_code ? (
                                  <svg viewBox="0 0 16 16" aria-hidden="true">
                                    <path
                                      d="M2.4 8.4L6.4 12.4L13.6 4.8"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                ) : (
                                  <svg viewBox="0 0 16 16" aria-hidden="true">
                                    <rect
                                      x="4.8"
                                      y="4.8"
                                      width="8.7"
                                      height="9.7"
                                      rx="1.6"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.6"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                    <path
                                      d="M11.1 1.5H3.8c-0.7 0-1.3 0.6-1.3 1.3v7.6"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="1.6"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </td>
                          <td className="col-market">{formatMarketLabel(row.market_name)}</td>
                          <td className="col-up-name">{row.up_name || '—'}</td>
                          <td className="col-price num">{formatNumber(row.estimate_202812)}</td>
                          <td className="col-per num">{formatNumber(row.per)}</td>
                          <td className="col-per num">{row.div_yield || '—'}</td>
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
                          <div className="fair-price-mobile-name-row">
                            <p className="fair-price-mobile-name">{row.stock_name || '—'}</p>
                            <button
                              type="button"
                              className="fair-price-copy-btn"
                              onClick={() => void handleCopyStockCode(row.stock_code)}
                              title={copiedStockCode === row.stock_code ? '복사됨' : '종목코드 복사'}
                              aria-label={`${row.stock_code || '종목'} 코드 복사`}
                            >
                              {copiedStockCode === row.stock_code ? (
                                <svg viewBox="0 0 16 16" aria-hidden="true">
                                  <path
                                    d="M2.4 8.4L6.4 12.4L13.6 4.8"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              ) : (
                                <svg viewBox="0 0 16 16" aria-hidden="true">
                                  <rect
                                    x="4.8"
                                    y="4.8"
                                    width="8.7"
                                    height="9.7"
                                    rx="1.6"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                  <path
                                    d="M11.1 1.5H3.8c-0.7 0-1.3 0.6-1.3 1.3v7.6"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.6"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  />
                                </svg>
                              )}
                            </button>
                          </div>
                          <p className="fair-price-mobile-meta">
                            {row.stock_code}
                            {row.market_name ? ` · ${formatMarketLabel(row.market_name)}` : ''}
                            {row.up_name ? ` · ${row.up_name}` : ''}
                          </p>
                        </div>
                        <dl className="fair-price-mobile-grid">
                          <div>
                            <dt>{formatEstimatePeriodLabel(estimatePeriod)}</dt>
                            <dd>{formatNumber(row.estimate_202812)}</dd>
                          </div>
                          <div>
                            <dt>PER</dt>
                            <dd>{formatNumber(row.per)}</dd>
                          </div>
                          <div>
                            <dt>배당수익률</dt>
                            <dd>{row.div_yield || '—'}</dd>
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
