import { useState } from 'react'
import InfoHelpTooltip from '../components/InfoHelpTooltip.jsx'
import {
  ApiError,
  collectStockBaseDetails,
  crawlEstimateNetIncome,
  fetchEstimateNetIncomeCrawlPreview,
  selectStockBaseTargets,
  syncStockBase,
} from '../lib/api.js'

const DEFAULT_CRAWL_ACCOUNT_ID = '81279931'

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

export default function DataCollectionView() {
  const [crawlAccountId, setCrawlAccountId] = useState(DEFAULT_CRAWL_ACCOUNT_ID)
  const [prepError, setPrepError] = useState('')
  const [step1StockCode, setStep1StockCode] = useState('')
  const [step1Loading, setStep1Loading] = useState(false)
  const [step1Error, setStep1Error] = useState('')
  const [step1Result, setStep1Result] = useState(null)

  const [step2Loading, setStep2Loading] = useState(false)
  const [step2Error, setStep2Error] = useState('')
  const [step2Result, setStep2Result] = useState(null)

  const [step3Loading, setStep3Loading] = useState(false)
  const [step3Error, setStep3Error] = useState('')
  const [step3Result, setStep3Result] = useState(null)

  const [crawlScope, setCrawlScope] = useState('single')
  const [stockCode, setStockCode] = useState('')
  const [sleepSeconds, setSleepSeconds] = useState('0.5')
  const [crawlLoading, setCrawlLoading] = useState(false)
  const [crawlError, setCrawlError] = useState('')
  const [crawlResult, setCrawlResult] = useState(null)
  const [crawlPreviewCache, setCrawlPreviewCache] = useState(null)

  const hasAnyStepRunning = step1Loading || step2Loading || step3Loading || crawlLoading

  function formatDurationMs(milliseconds) {
    const ms = Number(milliseconds)
    if (!Number.isFinite(ms) || ms < 0) {
      return '—'
    }
    if (ms < 1000) {
      return `${Math.round(ms)}ms`
    }
    return `${(ms / 1000).toFixed(1)}초`
  }

  function resolvePreparedAccountId(setError) {
    const accountId = crawlAccountId.trim()
    if (accountId) {
      return accountId
    }
    setError('준비단계에서 계좌번호를 먼저 입력하세요.')
    return null
  }

  async function runStep1SyncStockBase() {
    const accountId = resolvePreparedAccountId(setStep1Error)
    if (!accountId) {
      return
    }

    const stockCodeValue = step1StockCode.trim()
    if (stockCodeValue && !/^\d{6}$/.test(stockCodeValue)) {
      setStep1Error('샘플 동기화 종목코드는 6자리 숫자로 입력하세요.')
      return
    }

    setStep1Loading(true)
    setStep1Error('')
    setStep1Result(null)
    try {
      const params = { account_id: accountId }
      if (stockCodeValue) {
        params.stock_code = stockCodeValue
      }
      const data = await syncStockBase(params)
      setStep1Result(data)
    } catch (error) {
      setStep1Error(formatApiErrorDetail(error))
    } finally {
      setStep1Loading(false)
    }
  }

  async function runStep2SelectTargets() {
    const accountId = resolvePreparedAccountId(setStep2Error)
    if (!accountId) {
      return
    }

    setStep2Loading(true)
    setStep2Error('')
    setStep2Result(null)
    try {
      const data = await selectStockBaseTargets({ account_id: accountId })
      setStep2Result(data)
    } catch (error) {
      setStep2Error(formatApiErrorDetail(error))
    } finally {
      setStep2Loading(false)
    }
  }

  async function runStep3CollectDetails() {
    const accountId = resolvePreparedAccountId(setStep3Error)
    if (!accountId) {
      return
    }

    setStep3Loading(true)
    setStep3Error('')
    setStep3Result(null)
    try {
      const data = await collectStockBaseDetails({ account_id: accountId })
      setStep3Result(data)
    } catch (error) {
      setStep3Error(formatApiErrorDetail(error))
    } finally {
      setStep3Loading(false)
    }
  }

  async function runCrawl() {
    const accountId = resolvePreparedAccountId(setCrawlError)
    if (!accountId) {
      return
    }

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
        const previewKey = `${accountId}:${sleepValue}`
        let preview = crawlPreviewCache?.key === previewKey ? crawlPreviewCache.data : null
        if (!preview) {
          preview = await fetchEstimateNetIncomeCrawlPreview({
            sleep_seconds: sleepValue,
            account_id: accountId,
          })
          setCrawlPreviewCache({ key: previewKey, data: preview })
        }
        const confirmed = window.confirm(buildAllCrawlConfirmMessage(preview, sleepValue))
        if (!confirmed) {
          return
        }
      }

      const params = { sleep_seconds: sleepValue, account_id: accountId }
      if (crawlScope === 'single') {
        params.stock_code = stockCodeValue
      }
      const data = await crawlEstimateNetIncome(params)
      setCrawlPreviewCache(null)
      setCrawlResult(data)
    } catch (crawlErr) {
      setCrawlError(formatApiErrorDetail(crawlErr))
    } finally {
      setCrawlLoading(false)
    }
  }

  return (
    <section className="dashboard">
      <section className="card data-collection-prep-card">
        <div className="benchmark-head">
          <p className="caption">분석 &gt; 데이터 수집</p>
          <div className="snapshot-chart-title-row">
            <h2 className="snapshot-chart-title">준비단계 고정변수 관리</h2>
            <InfoHelpTooltip ariaLabel="준비단계 설명">
              <p className="subtle snapshot-chart-help-text">
                아래 계좌번호는 1~4단계 모든 작업에 공통으로 사용됩니다.
              </p>
            </InfoHelpTooltip>
          </div>
        </div>

        <div className="data-collection-step-panel">
          <div className="data-collection-step-controls data-collection-step-controls--prep">
            <div className="form-field">
              <label htmlFor="dc-prep-account-id">계좌번호</label>
              <input
                id="dc-prep-account-id"
                type="text"
                value={crawlAccountId}
                autoComplete="off"
                onChange={(e) => {
                  setCrawlAccountId(e.target.value)
                  setPrepError('')
                }}
                placeholder="계좌번호 입력"
                disabled={hasAnyStepRunning}
              />
            </div>
          </div>
          <p className="subtle">모든 단계 실행 시 준비단계의 계좌번호를 사용합니다.</p>
          {prepError ? (
            <div className="data-collection-step-feedback" aria-live="polite">
              <p className="error-banner" role="alert">
                {prepError}
              </p>
            </div>
          ) : null}
        </div>
      </section>

      <section className="card data-collection-step-card">
        <div className="benchmark-head">
          <div className="snapshot-chart-title-row">
            <h2 className="snapshot-chart-title">1단계 종목 기본정보 동기화</h2>
            <InfoHelpTooltip ariaLabel="1단계 설명">
              <p className="subtle snapshot-chart-help-text">
                코스피/코스닥 종목 기본정보를 `stock_base`에 동기화합니다. 샘플 종목코드를 입력하면 해당
                종목만 동기화할 수 있습니다.
              </p>
            </InfoHelpTooltip>
          </div>
        </div>

        <div className="data-collection-step-panel">
          <div className="data-collection-step-controls data-collection-step-controls--two-cols">
            <div className="form-field">
              <label htmlFor="dc-step1-stock-code">단일 종목코드</label>
              <input
                id="dc-step1-stock-code"
                type="text"
                inputMode="numeric"
                maxLength={6}
                autoComplete="off"
                value={step1StockCode}
                onChange={(e) => setStep1StockCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="미입력 시 전체"
                disabled={step1Loading}
              />
            </div>
            <div className="form-field data-collection-step-action-field">
              <span className="form-field-label-spacer" aria-hidden="true">
                &nbsp;
              </span>
              <button
                type="button"
                className="btn btn-primary"
                disabled={hasAnyStepRunning}
                onClick={() => void runStep1SyncStockBase()}
              >
                {step1Loading ? '동기화 중…' : '종목 기본정보 동기화'}
              </button>
            </div>
          </div>
          {(step1Error || step1Result) && (
            <div className="data-collection-step-feedback" aria-live="polite">
              {step1Error ? (
                <p className="error-banner" role="alert">
                  {step1Error}
                </p>
              ) : null}
              {step1Result ? (
                <div className="data-collection-step-result" role="status">
                  <p className="data-collection-step-result-title">동기화 완료</p>
                  <p className="data-collection-step-result-summary">
                    코스피 조회 {formatNumber(step1Result.kospi_fetched)}건 · 코스닥 조회{' '}
                    {formatNumber(step1Result.kosdaq_fetched)}건 · 최종 upsert {formatNumber(step1Result.total_upserted)}
                    건 · 소요 {formatDurationMs(step1Result.duration_ms)}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="card data-collection-step-card">
        <div className="benchmark-head">
          <div className="snapshot-chart-title-row">
            <h2 className="snapshot-chart-title">2단계 분석 대상 종목 선정</h2>
            <InfoHelpTooltip ariaLabel="2단계 설명">
              <p className="subtle snapshot-chart-help-text">
                조건검색 0번·5번 유니버스 합집합을 기준으로 `is_analysis_target` 대상을 다시 선정합니다.
              </p>
            </InfoHelpTooltip>
          </div>
        </div>

        <div className="data-collection-step-panel">
          <div className="data-collection-step-controls data-collection-step-controls--action-only">
            <div className="form-field data-collection-step-action-field">
              <span className="form-field-label-spacer" aria-hidden="true">
                &nbsp;
              </span>
              <button
                type="button"
                className="btn btn-primary"
                disabled={hasAnyStepRunning}
                onClick={() => void runStep2SelectTargets()}
              >
                {step2Loading ? '선정 중…' : '분석 대상 종목 선정'}
              </button>
            </div>
          </div>

          {(step2Error || step2Result) && (
            <div className="data-collection-step-feedback" aria-live="polite">
              {step2Error ? (
                <p className="error-banner" role="alert">
                  {step2Error}
                </p>
              ) : null}
              {step2Result ? (
                <div className="data-collection-step-result" role="status">
                  <p className="data-collection-step-result-title">선정 완료</p>
                  <p className="data-collection-step-result-summary">
                    전체 {formatNumber(step2Result.total_in_base)}건 · 유니버스 {formatNumber(step2Result.universe_count)}
                    건 · reset {formatNumber(step2Result.reset_count)}건 · 선정 {formatNumber(step2Result.flagged_true)}
                    건 · 미존재 무시 {formatNumber(step2Result.ignored_not_in_base)}건 · 소요{' '}
                    {formatDurationMs(step2Result.duration_ms)}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="card data-collection-step-card">
        <div className="benchmark-head">
          <div className="snapshot-chart-title-row">
            <h2 className="snapshot-chart-title">3단계 분석 대상 상세정보 수집</h2>
            <InfoHelpTooltip ariaLabel="3단계 설명">
              <p className="subtle snapshot-chart-help-text">
                분석 대상 종목의 `financial_info` 상세 데이터를 수집해 갱신합니다.
              </p>
            </InfoHelpTooltip>
          </div>
        </div>

        <div className="data-collection-step-panel">
          <div className="data-collection-step-controls data-collection-step-controls--action-only">
            <div className="form-field data-collection-step-action-field">
              <span className="form-field-label-spacer" aria-hidden="true">
                &nbsp;
              </span>
              <button
                type="button"
                className="btn btn-primary"
                disabled={hasAnyStepRunning}
                onClick={() => void runStep3CollectDetails()}
              >
                {step3Loading ? '수집 중…' : '상세정보 수집'}
              </button>
            </div>
          </div>

          {(step3Error || step3Result) && (
            <div className="data-collection-step-feedback" aria-live="polite">
              {step3Error ? (
                <p className="error-banner" role="alert">
                  {step3Error}
                </p>
              ) : null}
              {step3Result ? (
                <div className="data-collection-step-result" role="status">
                  <p className="data-collection-step-result-title">수집 완료</p>
                  <p className="data-collection-step-result-summary">
                    대상 {formatNumber(step3Result.target_count)}건 · 갱신 {formatNumber(step3Result.updated_count)}건
                    · ka10099 누락 {formatNumber(step3Result.ka10099_missing)}건 · ka10001 실패{' '}
                    {formatNumber(step3Result.ka10001_failed)}건 · 소요 {formatDurationMs(step3Result.duration_ms)}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="card net-income-crawl-card">
        <div className="benchmark-head">
          <div className="snapshot-chart-title-row">
            <h2 className="snapshot-chart-title">4단계 순이익 크롤 및 저장</h2>
            <InfoHelpTooltip ariaLabel="4단계 설명">
              <p className="subtle snapshot-chart-help-text">
                전체 또는 종목코드 기준으로 연간 당기순이익(지배) 예상치와 시장 스냅샷을 수집해 저장합니다.
                순이익은 호출 시점 기준 당해·1년 후·2년 후 연간 예상치만 수집합니다. 전체 크롤은
                키움증권 조건검색 0번·5번 유니버스 합집합을 사용합니다.
              </p>
            </InfoHelpTooltip>
          </div>
        </div>

        <div className="net-income-crawl-panel">
          <div
            className={`net-income-crawl-controls net-income-crawl-controls--without-account${
              crawlScope === 'single' ? ' net-income-crawl-controls--single' : ''
            }`}
          >
            <div className="form-field net-income-crawl-scope-field">
              <label htmlFor="fp-crawl-scope">크롤 범위</label>
              <select
                id="fp-crawl-scope"
                value={crawlScope}
                disabled={hasAnyStepRunning}
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
                disabled={hasAnyStepRunning || crawlScope !== 'single'}
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
                disabled={hasAnyStepRunning}
              />
            </div>

            <div className="form-field net-income-crawl-action-field">
              <span className="form-field-label-spacer" aria-hidden="true">
                &nbsp;
              </span>
              <button
                type="button"
                className="btn btn-primary net-income-crawl-run-btn"
                disabled={hasAnyStepRunning}
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
              조건검색 0번·5번 유니버스 합집합 전체를 크롤합니다.
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
    </section>
  )
}
