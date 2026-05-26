import { useState } from 'react'
import { summarizeBatchResult } from '../lib/graphRuns.js'

export default function GraphManualRunCard({ title, description, runLabel, onRun }) {
  const [enforceTradingDay, setEnforceTradingDay] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')
  const [summary, setSummary] = useState(null)

  async function handleRun() {
    setRunning(true)
    setError('')
    setSummary(null)
    try {
      const result = await onRun({ enforceTradingDay })
      setSummary(summarizeBatchResult(result))
    } catch (err) {
      setError(err?.message || String(err))
    } finally {
      setRunning(false)
    }
  }

  return (
    <article className="card schedule-manual-run-card">
      <div className="schedule-manual-run-body">
        <h3 className="schedule-job-title schedule-manual-run-title">{title}</h3>
        <p className="schedule-manual-run-desc">{description}</p>
      </div>

      <div className="schedule-manual-run-footer">
        <label className="schedule-manual-run-option">
          <input
            type="checkbox"
            checked={enforceTradingDay}
            disabled={running}
            onChange={(e) => setEnforceTradingDay(e.target.checked)}
          />
          <span>거래일만 실행 (비영업일 스킵)</span>
        </label>
        <button type="button" className="btn btn-primary" disabled={running} onClick={handleRun}>
          {running ? '실행 중…' : runLabel}
        </button>
      </div>

      {error ? (
        <p className="error-banner" role="alert">
          {error}
        </p>
      ) : null}

      {summary ? (
        <div className="schedule-manual-run-result">
          {summary.skippedReason === 'non_trading_day' ? (
            <p className="schedule-manual-run-skipped">비영업일이라 실행하지 않았습니다.</p>
          ) : (
            <>
              <p className="schedule-manual-run-summary">
                {summary.total}개 계좌 · 성공 {summary.succeeded} · 실패 {summary.failed}
              </p>
              {summary.rows.length > 0 ? (
                <ul className="schedule-manual-run-list">
                  {summary.rows.map((row) => (
                    <li
                      key={row.accountId}
                      className={
                        row.status === 'failed'
                          ? 'schedule-manual-run-item schedule-manual-run-item--failed'
                          : 'schedule-manual-run-item'
                      }
                    >
                      <span className="schedule-manual-run-account">{row.accountId}</span>
                      <span className="schedule-manual-run-status">{row.status}</span>
                      {row.runId ? <code className="schedule-manual-run-runid">{row.runId}</code> : null}
                      {row.error ? (
                        <span className="schedule-manual-run-error">{row.error}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </article>
  )
}
