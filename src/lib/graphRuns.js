import { requestJson } from './api.js'

export function runEntryGraphBatch({ enforceTradingDay = false } = {}) {
  return requestJson('POST', '/graph/entry/scheduler/run-once', {
    params: {
      enforce_trading_day: enforceTradingDay,
      include_position: false,
    },
  })
}

export function runPositionGraphBatch({ enforceTradingDay = false } = {}) {
  return requestJson('POST', '/graph/position/batch/run-once', {
    params: { enforce_trading_day: enforceTradingDay },
  })
}

/**
 * @param {unknown} result
 * @returns {{ total: number, succeeded: number, failed: number, skippedReason: string | null, rows: Array<{ accountId: string, status: string, runId: string | null, error: string | null }> }}
 */
export function summarizeBatchResult(result) {
  if (!result || typeof result !== 'object') {
    return { total: 0, succeeded: 0, failed: 0, skippedReason: null, rows: [] }
  }

  const skippedReason = result.skipped_reason ? String(result.skipped_reason) : null
  const rows = Array.isArray(result.results)
    ? result.results.map((item) => ({
        accountId: String(item?.account_id || ''),
        status: String(item?.status || ''),
        runId:
          item?.entry_run_id != null
            ? String(item.entry_run_id)
            : item?.position_run_id != null
              ? String(item.position_run_id)
              : null,
        error: item?.error ? String(item.error) : null,
      }))
    : []

  const succeeded = rows.filter((r) => r.status === 'success').length
  const failed = rows.filter((r) => r.status === 'failed').length

  return {
    total: rows.length,
    succeeded,
    failed,
    skippedReason,
    rows,
  }
}
