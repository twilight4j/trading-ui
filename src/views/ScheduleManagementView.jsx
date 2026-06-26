import { useCallback, useEffect, useRef, useState } from 'react'
import GraphManualRunCard from '../components/GraphManualRunCard.jsx'
import { runEntryGraphBatch, runPositionGraphBatch } from '../lib/graphRuns.js'
import {
  fetchSchedules,
  formatNextRunTime,
  fetchCollectionPipelineStatus,
  patchSchedule,
  runCollectionPipelineOnce,
} from '../lib/schedules.js'

const CRAWLING_COLLECTION_PIPELINE = 'crawling_collection_pipeline'
const DEFAULT_CRAWL_ACCOUNT_ID = '81279931'

function resolveDefaultAccountId(rawValue) {
  const normalized = String(rawValue ?? '').trim()
  return normalized || DEFAULT_CRAWL_ACCOUNT_ID
}

function normalizeStockCodeInput(rawValue) {
  return String(rawValue ?? '')
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, 6)
}
const COLLECTION_PIPELINE_STAGE_KEYS = [
  'step1_sync_stock_base',
  'step2_select_stock_base_targets',
  'step3_collect_stock_base_details',
  'step4_crawl_estimate_net_income',
]
const COLLECTION_PIPELINE_STAGE_LABELS = {
  step1_sync_stock_base: '1단계 기본정보 동기화',
  step2_select_stock_base_targets: '2단계 분석대상 선정',
  step3_collect_stock_base_details: '3단계 상세정보 수집',
  step4_crawl_estimate_net_income: '4단계 순이익 크롤',
}

function emptyDraft(job) {
  if (!job) {
    return null
  }
  return {
    enabled: job.enabled,
    day_of_week: job.cron?.day_of_week ?? '',
    hour: job.cron?.hour ?? '',
    minute: job.cron?.minute ?? '',
    timezone: job.cron?.timezone ?? '',
    options_account_id:
      job.job_key === CRAWLING_COLLECTION_PIPELINE
        ? resolveDefaultAccountId(job.options?.account_id)
        : job.options?.account_id ?? '',
    options_sleep_seconds: `${job.options?.sleep_seconds ?? 0.3}`,
  }
}

function draftDirty(draft, job) {
  if (!draft || !job) {
    return false
  }
  if (draft.enabled !== job.enabled) {
    return true
  }
  if (job.job_type !== 'cron') {
    return false
  }
  const c = job.cron
  if (!c) {
    return true
  }
  return (
    draft.day_of_week !== c.day_of_week ||
    draft.hour !== c.hour ||
    draft.minute !== c.minute ||
    draft.timezone !== c.timezone ||
    (job.job_key === CRAWLING_COLLECTION_PIPELINE &&
      (draft.options_account_id !==
        resolveDefaultAccountId(job.options?.account_id) ||
        draft.options_sleep_seconds !== `${job.options?.sleep_seconds ?? 0.3}`))
  )
}

function ScheduleJobCard({ job, onSaved, onError }) {
  const [draft, setDraft] = useState(() => emptyDraft(job))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(emptyDraft(job))
  }, [job])

  const dirty = draftDirty(draft, job)
  const isCron = job.job_type === 'cron'
  const isCollectionPipeline = job.job_key === CRAWLING_COLLECTION_PIPELINE

  async function handleSave() {
    if (!draft || !dirty) {
      return
    }
    setSaving(true)
    onError('')
    try {
      const body = { enabled: draft.enabled }
      if (isCron) {
        body.day_of_week = draft.day_of_week
        body.hour = draft.hour
        body.minute = draft.minute
        body.timezone = draft.timezone
      }
      if (isCollectionPipeline) {
        const accountId = String(draft.options_account_id || '').trim()
        const sleepSeconds = Number(draft.options_sleep_seconds)
        if (draft.enabled && !accountId) {
          onError('데이터수집 파이프라인은 account_id가 필요합니다.')
          return
        }
        if (!Number.isFinite(sleepSeconds) || sleepSeconds < 0 || sleepSeconds > 3) {
          onError('데이터수집 파이프라인 sleep_seconds는 0~3 사이여야 합니다.')
          return
        }
        body.options = {
          account_id: accountId,
          sleep_seconds: sleepSeconds,
        }
      }
      const updated = await patchSchedule(job.job_key, body)
      onSaved(updated)
    } catch (err) {
      onError(err?.message || String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <article className="card schedule-job-card">
      <header className="schedule-job-card-header">
        <div>
          <h3 className="schedule-job-title">{job.display_name}</h3>
          <p className="caption schedule-job-meta">
            <code>{job.job_key}</code>
            {job.apscheduler_job_id ? (
              <>
                {' '}
                · APScheduler <code>{job.apscheduler_job_id}</code>
              </>
            ) : (
              ' · 배치 내부 단계'
            )}
          </p>
        </div>
        <label className="schedule-toggle">
          <input
            type="checkbox"
            checked={Boolean(draft?.enabled)}
            disabled={saving}
            onChange={(e) => setDraft((prev) => ({ ...prev, enabled: e.target.checked }))}
          />
          <span>{draft?.enabled ? 'On' : 'Off'}</span>
        </label>
      </header>

      {isCron ? (
        <div className="schedule-cron-grid">
          <label>
            <span className="schedule-field-label">요일 (day_of_week)</span>
            <input
              type="text"
              value={draft?.day_of_week ?? ''}
              disabled={saving}
              placeholder="mon-fri"
              onChange={(e) => setDraft((prev) => ({ ...prev, day_of_week: e.target.value }))}
            />
          </label>
          <label>
            <span className="schedule-field-label">시 (hour)</span>
            <input
              type="text"
              value={draft?.hour ?? ''}
              disabled={saving}
              placeholder="9-15"
              onChange={(e) => setDraft((prev) => ({ ...prev, hour: e.target.value }))}
            />
          </label>
          <label>
            <span className="schedule-field-label">분 (minute)</span>
            <input
              type="text"
              value={draft?.minute ?? ''}
              disabled={saving}
              placeholder="10"
              onChange={(e) => setDraft((prev) => ({ ...prev, minute: e.target.value }))}
            />
          </label>
          <label>
            <span className="schedule-field-label">타임존</span>
            <input
              type="text"
              value={draft?.timezone ?? ''}
              disabled={saving}
              placeholder="Asia/Seoul"
              onChange={(e) => setDraft((prev) => ({ ...prev, timezone: e.target.value }))}
            />
          </label>
        </div>
      ) : (
        <p className="schedule-step-hint">
          Entry 크론 배치가 실행될 때 Position 그래프 단계를 함께 실행합니다. 크론은 Entry graph job에서
          설정합니다.
        </p>
      )}
      {isCollectionPipeline ? (
        <div className="schedule-cron-grid">
          <label>
            <span className="schedule-field-label">실행 계좌번호 (options.account_id)</span>
            <input
              type="text"
              value={draft?.options_account_id ?? ''}
              disabled={saving}
              placeholder="예: 81279931"
              onChange={(e) => setDraft((prev) => ({ ...prev, options_account_id: e.target.value }))}
            />
          </label>
          <label>
            <span className="schedule-field-label">요청 간 대기초 (options.sleep_seconds)</span>
            <input
              type="number"
              min={0}
              max={3}
              step={0.1}
              value={draft?.options_sleep_seconds ?? '0.3'}
              disabled={saving}
              onChange={(e) => setDraft((prev) => ({ ...prev, options_sleep_seconds: e.target.value }))}
            />
          </label>
        </div>
      ) : null}

      <dl className="schedule-status-dl">
        <div>
          <dt>다음 실행</dt>
          <dd>{formatNextRunTime(job.next_run_time)}</dd>
        </div>
        <div>
          <dt>스케줄러</dt>
          <dd>{job.scheduler_running ? '실행 중' : '중지/미기동'}</dd>
        </div>
      </dl>

      <div className="schedule-card-actions">
        <button type="button" className="btn btn-primary" disabled={!dirty || saving} onClick={handleSave}>
          {saving ? '저장 중…' : '저장 · 즉시 반영'}
        </button>
      </div>
    </article>
  )
}

function CollectionPipelineManualRunCard({ defaultAccountId = '', defaultSleepSeconds = '0.3' }) {
  const [accountId, setAccountId] = useState(defaultAccountId)
  const [stockCode, setStockCode] = useState('')
  const [sleepSeconds, setSleepSeconds] = useState(defaultSleepSeconds)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState(null)
  const [pipelineStatus, setPipelineStatus] = useState(null)
  const pollingTimerRef = useRef(null)

  function clearStatusPolling() {
    if (pollingTimerRef.current) {
      window.clearInterval(pollingTimerRef.current)
      pollingTimerRef.current = null
    }
  }

  async function loadStatus(targetAccountId) {
    if (!targetAccountId) {
      return
    }
    try {
      const status = await fetchCollectionPipelineStatus({ accountId: targetAccountId })
      setPipelineStatus(status)
      if (status?.status !== 'running') {
        clearStatusPolling()
      }
    } catch {
      clearStatusPolling()
    }
  }

  function startStatusPolling(targetAccountId) {
    clearStatusPolling()
    void loadStatus(targetAccountId)
    pollingTimerRef.current = window.setInterval(() => {
      void loadStatus(targetAccountId)
    }, 1500)
  }

  useEffect(() => () => clearStatusPolling(), [])

  async function handleRun() {
    const normalizedAccountId = String(accountId || '').trim()
    const normalizedStockCode = normalizeStockCodeInput(stockCode)
    const sleep = Number(sleepSeconds)
    if (!normalizedAccountId) {
      setError('계좌번호를 입력하세요.')
      return
    }
    if (normalizedStockCode && !/^[0-9A-Z]{6}$/.test(normalizedStockCode)) {
      setError('종목코드는 영문/숫자 6자리여야 합니다.')
      return
    }
    if (!Number.isFinite(sleep) || sleep < 0 || sleep > 3) {
      setError('요청 간 대기초는 0~3 사이여야 합니다.')
      return
    }

    setRunning(true)
    setError('')
    setResult(null)
    startStatusPolling(normalizedAccountId)
    try {
      const data = await runCollectionPipelineOnce({
        accountId: normalizedAccountId,
        stockCode: normalizedStockCode || undefined,
        sleepSeconds: sleep,
      })
      setResult(data)
      setPipelineStatus(data)
    } catch (err) {
      setError(err?.message || String(err))
      await loadStatus(normalizedAccountId)
    } finally {
      setRunning(false)
      clearStatusPolling()
    }
  }

  const stageStatusByKey = Array.isArray(pipelineStatus?.stages)
    ? Object.fromEntries(pipelineStatus.stages.map((stage) => [stage.stage_key, stage.status]))
    : {}
  const renderedStages = COLLECTION_PIPELINE_STAGE_KEYS.map((stageKey) => ({
    stageKey,
    label: COLLECTION_PIPELINE_STAGE_LABELS[stageKey] || stageKey,
    status: stageStatusByKey[stageKey] || 'pending',
  }))
  const pipelineSummaryStatus = pipelineStatus?.status || (running ? 'running' : null)
  const pipelineCurrentStageLabel = pipelineStatus?.current_stage
    ? COLLECTION_PIPELINE_STAGE_LABELS[pipelineStatus.current_stage] || pipelineStatus.current_stage
    : null

  return (
    <article className="card schedule-manual-run-card schedule-manual-run-card--full-width">
      <div className="schedule-manual-run-body">
        <h3 className="schedule-job-title schedule-manual-run-title">데이터수집 1~4단계 수동 실행</h3>
        <p className="schedule-manual-run-desc">
          stock_base 동기화 → 대상선정 → 상세수집 → 순이익크롤을 순차 실행합니다. 중간 실패 시 즉시 중단합니다.
        </p>
      </div>
      <div className="schedule-cron-grid">
        <label>
          <span className="schedule-field-label">계좌번호</span>
          <input
            type="text"
            value={accountId}
            disabled={running}
            placeholder="예: 81279931"
            onChange={(e) => setAccountId(e.target.value)}
          />
        </label>
        <label>
          <span className="schedule-field-label">단일 종목코드 (선택)</span>
          <input
            type="text"
            value={stockCode}
            disabled={running}
            placeholder="예: 005930"
            onChange={(e) => setStockCode(normalizeStockCodeInput(e.target.value))}
          />
        </label>
        <label>
          <span className="schedule-field-label">요청 간 대기(초)</span>
          <input
            type="number"
            min={0}
            max={3}
            step={0.1}
            value={sleepSeconds}
            disabled={running}
            onChange={(e) => setSleepSeconds(e.target.value)}
          />
        </label>
      </div>
      <div className="schedule-card-actions">
        <button type="button" className="btn btn-primary" disabled={running} onClick={handleRun}>
          {running ? '실행 중…' : '데이터수집 파이프라인 실행'}
        </button>
      </div>
      <div className="collection-pipeline-progress">
        <p className="caption">단계 진행상태</p>
        <ol className="collection-pipeline-progress-list">
          {renderedStages.map((stage) => (
            <li
              key={stage.stageKey}
              className={`collection-pipeline-progress-step collection-pipeline-progress-step--${stage.status}`}
            >
              <span className="collection-pipeline-progress-step-label">{stage.label}</span>
              <span className="collection-pipeline-progress-step-status">{stage.status}</span>
            </li>
          ))}
        </ol>
        <p className="subtle collection-pipeline-progress-meta">
          상태 {pipelineSummaryStatus || 'idle'}
          {pipelineStatus?.stock_code ? ` · 종목 ${pipelineStatus.stock_code}` : ''}
          {pipelineCurrentStageLabel ? ` · 현재 ${pipelineCurrentStageLabel}` : ''}
          {pipelineStatus?.failed_stage ? ` · 실패 ${pipelineStatus.failed_stage}` : ''}
        </p>
      </div>
      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}
      {result ? (
        <div className="schedule-manual-run-result">
          <p className="schedule-manual-run-summary">
            상태 {result.status} · 단계 {Array.isArray(result.stages) ? result.stages.length : 0}개 · 소요{' '}
            {result.duration_ms}ms
            {result.stock_code ? ` · 종목 ${result.stock_code}` : ''}
            {result.failed_stage ? ` · 실패 단계 ${result.failed_stage}` : ''}
          </p>
          {Array.isArray(result.stages) && result.stages.length > 0 ? (
            <ul className="schedule-manual-run-list">
              {result.stages.map((stage) => (
                <li
                  key={stage.stage_key}
                  className={
                    stage.status === 'failed'
                      ? 'schedule-manual-run-item schedule-manual-run-item--failed'
                      : 'schedule-manual-run-item'
                  }
                >
                  <span className="schedule-manual-run-account">{stage.stage_key}</span>
                  <span className="schedule-manual-run-status">{stage.status}</span>
                  <code className="schedule-manual-run-runid">{stage.duration_ms}ms</code>
                  {stage.detail ? <span className="schedule-manual-run-error">{stage.detail}</span> : null}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </article>
  )
}

export default function ScheduleManagementView() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [saveError, setSaveError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError('')
    try {
      const data = await fetchSchedules()
      setJobs(Array.isArray(data) ? data : [])
    } catch (err) {
      setLoadError(err?.message || String(err))
      setJobs([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  function handleJobSaved(updated) {
    setJobs((prev) => prev.map((j) => (j.job_key === updated.job_key ? updated : j)))
    setSaveError('')
  }

  const collectionPipelineJob = jobs.find((job) => job.job_key === CRAWLING_COLLECTION_PIPELINE)
  const collectionPipelineDefaultAccountId = resolveDefaultAccountId(
    collectionPipelineJob?.options?.account_id
  )
  const collectionPipelineDefaultSleepSeconds = `${collectionPipelineJob?.options?.sleep_seconds ?? 0.3}`

  return (
    <div className="dashboard schedule-management">
      <section className="card schedule-intro">
        <p>
          trading-agent에 등록된 배치 job을 한 화면에서 관리합니다. 변경 사항은 DB에 저장되며 APScheduler에
          재시작 없이 반영됩니다.
        </p>
        <button type="button" className="btn btn-secondary" disabled={loading} onClick={load}>
          새로고침
        </button>
      </section>

      {loadError ? (
        <p className="error-banner" role="alert">
          {loadError}
        </p>
      ) : null}
      {saveError ? (
        <p className="error-banner" role="alert">
          {saveError}
        </p>
      ) : null}

      {loading ? <p className="caption">스케줄 목록 불러오는 중…</p> : null}

      {!loading && !loadError ? (
        <div className="schedule-job-list">
          {jobs.map((job) => (
            <ScheduleJobCard
              key={job.job_key}
              job={job}
              onSaved={handleJobSaved}
              onError={setSaveError}
            />
          ))}
        </div>
      ) : null}

      <section className="schedule-manual-run-grid" aria-label="그래프 수동 실행">
        <GraphManualRunCard
          title="Entry graph 수동 실행"
          description="등록된 모든 진입 계좌에 대해 조건검색·진입 주문 파이프라인을 1회 실행합니다. entry_position_step 설정과 무관하게 Entry만 실행합니다."
          runLabel="전체 계좌 Entry 실행"
          onRun={({ enforceTradingDay }) => runEntryGraphBatch({ enforceTradingDay })}
        />
        <GraphManualRunCard
          title="Position graph 수동 실행"
          description="등록된 모든 진입 계좌에 대해 OPEN 포지션 청산 규칙 평가·매도 주문 파이프라인을 1회 실행합니다."
          runLabel="전체 계좌 Position 실행"
          onRun={({ enforceTradingDay }) => runPositionGraphBatch({ enforceTradingDay })}
        />
        <CollectionPipelineManualRunCard
          key={`${collectionPipelineDefaultAccountId}:${collectionPipelineDefaultSleepSeconds}`}
          defaultAccountId={collectionPipelineDefaultAccountId}
          defaultSleepSeconds={collectionPipelineDefaultSleepSeconds}
        />
      </section>
    </div>
  )
}
