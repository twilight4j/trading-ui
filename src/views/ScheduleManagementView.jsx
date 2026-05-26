import { useCallback, useEffect, useState } from 'react'
import GraphManualRunCard from '../components/GraphManualRunCard.jsx'
import { runEntryGraphBatch, runPositionGraphBatch } from '../lib/graphRuns.js'
import { fetchSchedules, formatNextRunTime, patchSchedule } from '../lib/schedules.js'

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
    draft.timezone !== c.timezone
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
      </section>
    </div>
  )
}
