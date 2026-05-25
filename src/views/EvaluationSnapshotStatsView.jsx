import { useEffect, useMemo, useRef, useState } from 'react'
import EvaluationBalanceMobileCard from '../components/EvaluationBalanceMobileCard.jsx'
import { requestJson } from '../lib/api.js'
import { getEvaluationBalanceRowDisplay, evalBalanceSortControlMeta } from '../lib/evaluationDisplay.js'
import { parseNumericString } from '../lib/numbers.js'
import {
  formatRegisteredAccountEntrySignal,
  formatRegisteredAccountListLabel,
  normalizeRegisteredAccountRow,
} from '../lib/registeredAccounts.js'
import {
  SNAPSHOT_CHART_LINE_CLASSES,
  SNAPSHOT_CHART_WIDTH,
  SNAPSHOT_CHART_PLOT_HEIGHT,
  SNAPSHOT_CHART_PADDING_Y,
  SNAPSHOT_CHART_VIEWBOX_HEIGHT,
  SNAPSHOT_CHART_PLOT_TOP_Y,
  SNAPSHOT_CHART_PLOT_BOTTOM_Y,
  SNAPSHOT_CHART_PLOT_LEFT_X,
  SNAPSHOT_CHART_PLOT_RIGHT_X,
  SNAPSHOT_CHART_PADDING_X_LEFT,
  SNAPSHOT_CHART_PADDING_X_RIGHT,
  SNAPSHOT_CHART_Y_TICK_LABEL_X,
  SNAPSHOT_CHART_DATE_LABEL_Y,
  SNAPSHOT_CHART_FIRST_DATE_LABEL_OFFSET_X,
  SNAPSHOT_CHART_Y_AXIS_MAX_PCT,
  SNAPSHOT_CHART_Y_AXIS_MIN_PCT,
  computeSnapshotChartYRange,
  buildSnapshotYAxisTicks,
  snapshotValueToPixelY,
  snapshotChartXForIndex,
  isEvaluationSnapshotSuccessReturn,
  formatSnapshotDateAxisLabel,
  isValidYyyymmdd,
  buildSnapshotLinePathD,
  normalizeSnapshotStrategyId,
  formatSnapshotStrategyLabel,
  collectSnapshotStrategyChanges,
  snapshotPointXY,
  resolveSnapshotLineLegendIndex,
  stableSnapshotLegendIndex,
} from '../lib/snapshotChart.js'

/** 스냅샷 종목별 평가잔고 목록 기본 정렬: 수익률 내림차순(높은 % 먼저) */
const DEFAULT_SNAPSHOT_HOLDINGS_SORT = Object.freeze({ field: 'prft_rt', dir: 'desc' })

/** 수익률 화면: 조회구분·거래소 고정 (UI 비노출) */
const SNAPSHOT_QRY_TP = '1'
const SNAPSHOT_DMST_STEX_TP = 'KRX'

function InfoHelpIconSvg() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 11v5M12 8h.01"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

export default function EvaluationSnapshotStatsView() {
  const [accounts, setAccounts] = useState([])
  const [accountsError, setAccountsError] = useState('')

  const snapshotAccountsInitRef = useRef(false)
  const [snapshotChartAccountIds, setSnapshotChartAccountIds] = useState([])
  const [snapshotFromDate, setSnapshotFromDate] = useState('')
  const [snapshotToDate, setSnapshotToDate] = useState('')
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState('')
  const [snapshotResult, setSnapshotResult] = useState(null)
  const [snapshotChartHelpOpen, setSnapshotChartHelpOpen] = useState(false)
  const [snapshotAccountHelpOpen, setSnapshotAccountHelpOpen] = useState(false)
  const snapshotChartHelpRef = useRef(null)
  const snapshotAccountHelpRef = useRef(null)
  /** 선택 일자·계좌의 스냅샷 종목 상세 (`acnt_evlt_remn_indv_tot`) */
  const [snapshotHoldingSelection, setSnapshotHoldingSelection] = useState(null)
  /** 종목 상세 패널 정렬 — 기본은 수익률 내림차순, 계좌평가 잔고 화면과 동일 토글 */
  const [snapshotHoldingsSort, setSnapshotHoldingsSort] = useState(() => ({ ...DEFAULT_SNAPSHOT_HOLDINGS_SORT }))

  async function loadAccounts() {
    setAccountsError('')
    try {
      const response = await requestJson('GET', '/strategies/accounts', {
        params: { trading_type: 'PAPER', use_yn: 'Y' },
      })
      const normalized = Array.isArray(response)
        ? response.map((item) => normalizeRegisteredAccountRow(item)).filter(Boolean)
        : []
      setAccounts(normalized)
    } catch (loadError) {
      setAccountsError(loadError instanceof Error ? loadError.message : String(loadError))
      setAccounts([])
    }
  }

  function toggleSnapshotChartAccount(accountId) {
    const id = String(accountId || '').trim()
    if (!id) {
      return
    }
    setSnapshotChartAccountIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }

  async function loadSnapshotChart() {
    if (snapshotChartAccountIds.length === 0) {
      setSnapshotError('스냅샷 차트에 포함할 계좌를 한 개 이상 선택하세요.')
      return
    }
    const fromRaw = String(snapshotFromDate || '').trim()
    const toRaw = String(snapshotToDate || '').trim()
    if (fromRaw && !isValidYyyymmdd(fromRaw)) {
      setSnapshotError('시작일은 YYYYMMDD 8자리로 입력하세요.')
      return
    }
    if (toRaw && !isValidYyyymmdd(toRaw)) {
      setSnapshotError('종료일은 YYYYMMDD 8자리로 입력하세요.')
      return
    }
    if (fromRaw && toRaw && fromRaw > toRaw) {
      setSnapshotError('시작일은 종료일보다 늦을 수 없습니다.')
      return
    }

    setSnapshotLoading(true)
    setSnapshotError('')
    setSnapshotHoldingSelection(null)
    setSnapshotHoldingsSort({ ...DEFAULT_SNAPSHOT_HOLDINGS_SORT })
    const qry = SNAPSHOT_QRY_TP
    const stex = SNAPSHOT_DMST_STEX_TP

    const params = {}
    if (fromRaw) {
      params.from_date = fromRaw
    }
    if (toRaw) {
      params.to_date = toRaw
    }

    let excludedFailed = 0
    /** @type {{ accountId: string, snapshot_date: string, return_code: unknown, return_msg?: string }[]} */
    const excludedFailedDetails = []
    /** @type {{ accountId: string, dateToValue: Map<string, number>, dateToStrategyId: Map<string, string | null>, dateToHoldings: Record<string, object[]> }[]} */
    const series = []

    try {
      const results = await Promise.all(
        snapshotChartAccountIds.map(async (accountId) => {
          const rows = await requestJson(
            'GET',
            `/statistics/accounts/${encodeURIComponent(accountId)}/evaluation-snapshots`,
            {
              params,
            },
          )
          return { accountId, rows: Array.isArray(rows) ? rows : [] }
        }),
      )

      for (const { accountId, rows: list } of results) {
        const dateToValue = new Map()
        const dateToStrategyId = new Map()
        /** @type {Record<string, object[]>} */
        const dateToHoldings = {}
        for (const row of list) {
          if (
            String(row?.dmst_stex_tp || '').trim() !== stex ||
            String(row?.qry_tp || '').trim() !== qry
          ) {
            continue
          }
          const d = String(row?.snapshot_date || '').trim()
          if (!isEvaluationSnapshotSuccessReturn(row?.return_code)) {
            excludedFailed += 1
            excludedFailedDetails.push({
              accountId,
              snapshot_date: d.length === 8 ? d : d || '—',
              return_code: row?.return_code,
              return_msg: row?.return_msg != null ? String(row.return_msg) : '',
            })
            continue
          }
          const y = parseNumericString(row?.tot_prft_rt)
          if (y === null) {
            continue
          }
          if (d.length !== 8) {
            continue
          }
          const sid = normalizeSnapshotStrategyId(row?.strategy_id)
          dateToValue.set(d, y)
          dateToStrategyId.set(d, sid)
          dateToHoldings[d] = Array.isArray(row?.acnt_evlt_remn_indv_tot) ? row.acnt_evlt_remn_indv_tot : []
        }
        series.push({ accountId, dateToValue, dateToStrategyId, dateToHoldings })
      }

      const dateSet = new Set()
      for (const { dateToValue } of series) {
        for (const d of dateToValue.keys()) {
          dateSet.add(d)
        }
      }
      const sortedDates = [...dateSet].sort()

      let dataMin = Infinity
      let dataMax = -Infinity
      for (const { dateToValue } of series) {
        for (const v of dateToValue.values()) {
          dataMin = Math.min(dataMin, v)
          dataMax = Math.max(dataMax, v)
        }
      }
      if (!Number.isFinite(dataMin) || !Number.isFinite(dataMax)) {
        setSnapshotResult({
          sortedDates: [],
          paths: [],
          excludedFailed,
          excludedFailedDetails,
          yMin: SNAPSHOT_CHART_Y_AXIS_MIN_PCT,
          yMax: SNAPSHOT_CHART_Y_AXIS_MAX_PCT,
          yAxisTicks: [],
          axisRangeExceeded: false,
        })
        return
      }
      const { yMin, yMax } = computeSnapshotChartYRange()
      const yAxisTicks = buildSnapshotYAxisTicks(yMin, yMax)
      const axisRangeExceeded =
        dataMax > SNAPSHOT_CHART_Y_AXIS_MAX_PCT || dataMin < SNAPSHOT_CHART_Y_AXIS_MIN_PCT

      const width = SNAPSHOT_CHART_WIDTH
      const height = SNAPSHOT_CHART_PLOT_HEIGHT
      const paddingY = SNAPSHOT_CHART_PADDING_Y

      const paths = series.map((entry) => {
        const legendClassIndex = stableSnapshotLegendIndex(entry.accountId, accounts)
        const pathD = buildSnapshotLinePathD(
          sortedDates,
          entry.dateToValue,
          width,
          height,
          paddingY,
          yMin,
          yMax,
        )
        let lastVal = null
        let lastStrategyId = null
        for (let i = sortedDates.length - 1; i >= 0; i -= 1) {
          const v = parseNumericString(entry.dateToValue.get(sortedDates[i]))
          if (v !== null) {
            lastVal = v
            lastStrategyId = normalizeSnapshotStrategyId(entry.dateToStrategyId.get(sortedDates[i]))
            break
          }
        }
        const strategyChanges = collectSnapshotStrategyChanges(
          sortedDates,
          entry.dateToValue,
          entry.dateToStrategyId,
        )
        const markerDots = strategyChanges
          .map((ch) => {
            const v = parseNumericString(entry.dateToValue.get(ch.date))
            if (v === null) {
              return null
            }
            const xy = snapshotPointXY(sortedDates, ch.date, v, width, height, paddingY, yMin, yMax)
            if (!xy) {
              return null
            }
            return { ...xy, date: ch.date, fromId: ch.fromId, toId: ch.toId, pct: v }
          })
          .filter(Boolean)

        const vertexLabels = []
        for (let i = 0; i < sortedDates.length; i += 1) {
          const di = sortedDates[i]
          const v = parseNumericString(entry.dateToValue.get(di))
          if (v === null) {
            continue
          }
          const xy = snapshotPointXY(sortedDates, di, v, width, height, paddingY, yMin, yMax)
          if (xy) {
            vertexLabels.push({ x: xy.x, y: xy.y, val: v, date: di })
          }
        }

        let firstPt = null
        let lastPt = null
        for (let i = 0; i < sortedDates.length; i += 1) {
          const di = sortedDates[i]
          const v = parseNumericString(entry.dateToValue.get(di))
          if (v === null) {
            continue
          }
          const xy = snapshotPointXY(sortedDates, di, v, width, height, paddingY, yMin, yMax)
          if (!xy) {
            continue
          }
          const pt = { x: xy.x, y: xy.y, val: v, date: di }
          if (!firstPt) {
            firstPt = pt
          }
          lastPt = pt
        }
        const endpointDots = []
        if (firstPt) {
          if (lastPt && firstPt.date === lastPt.date) {
            endpointDots.push({ ...firstPt, kind: 'single' })
          } else {
            endpointDots.push({ ...firstPt, kind: 'start' })
            if (lastPt) {
              endpointDots.push({ ...lastPt, kind: 'end' })
            }
          }
        }

        return {
          accountId: entry.accountId,
          pathD,
          lineClass: SNAPSHOT_CHART_LINE_CLASSES[legendClassIndex],
          legendClassIndex,
          lastVal,
          lastStrategyId,
          strategyChanges,
          markerDots,
          endpointDots,
          vertexLabels,
          holdingsByDate: entry.dateToHoldings,
          strategyByDate: Object.fromEntries(entry.dateToStrategyId),
        }
      })

      setSnapshotResult({
        sortedDates,
        paths,
        excludedFailed,
        excludedFailedDetails,
        yMin,
        yMax,
        yAxisTicks,
        axisRangeExceeded,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setSnapshotError(message)
      setSnapshotResult(null)
    } finally {
      setSnapshotLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 마운트 시 계좌 목록 로드 */
    loadAccounts()
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  useEffect(() => {
    if (accounts.length > 0 && !snapshotAccountsInitRef.current) {
      snapshotAccountsInitRef.current = true
      setSnapshotChartAccountIds(accounts.map((a) => a.account_id))
    }
  }, [accounts])

  useEffect(() => {
    if (!snapshotChartHelpOpen && !snapshotAccountHelpOpen) {
      return undefined
    }
    function onPointerDown(event) {
      if (snapshotChartHelpRef.current?.contains(event.target)) {
        return
      }
      if (snapshotAccountHelpRef.current?.contains(event.target)) {
        return
      }
      setSnapshotChartHelpOpen(false)
      setSnapshotAccountHelpOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [snapshotChartHelpOpen, snapshotAccountHelpOpen])

  const selectedHoldingsRawRows = useMemo(() => {
    if (!snapshotHoldingSelection || !snapshotResult?.paths) {
      return []
    }
    const path = snapshotResult.paths.find((p) => p.accountId === snapshotHoldingSelection.accountId)
    if (!path?.holdingsByDate) {
      return []
    }
    const rows = path.holdingsByDate[snapshotHoldingSelection.date]
    return Array.isArray(rows) ? rows : []
  }, [snapshotHoldingSelection, snapshotResult])

  const sortedSnapshotHoldingsRows = useMemo(() => {
    if (!snapshotHoldingsSort) {
      return selectedHoldingsRawRows
    }
    const { field, dir } = snapshotHoldingsSort
    return [...selectedHoldingsRawRows].sort((a, b) => {
      const va = parseNumericString(a?.[field])
      const vb = parseNumericString(b?.[field])
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return dir === 'asc' ? va - vb : vb - va
    })
  }, [selectedHoldingsRawRows, snapshotHoldingsSort])

  function cycleSnapshotHoldingsSort(field) {
    setSnapshotHoldingsSort((prev) => {
      if (!prev || prev.field !== field) {
        return { field, dir: 'desc' }
      }
      if (prev.dir === 'desc') {
        return { field, dir: 'asc' }
      }
      return null
    })
  }

  const holdingsSortMetaPnl = evalBalanceSortControlMeta('evltv_prft', snapshotHoldingsSort)
  const holdingsSortMetaPrft = evalBalanceSortControlMeta('prft_rt', snapshotHoldingsSort)

  const selectedSnapshotDetailMeta = useMemo(() => {
    if (!snapshotHoldingSelection || !snapshotResult?.paths) {
      return null
    }
    const path = snapshotResult.paths.find((p) => p.accountId === snapshotHoldingSelection.accountId)
    if (!path) {
      return null
    }
    const date = snapshotHoldingSelection.date
    const strategyId = path.strategyByDate?.[date]
    const pctVert = path.vertexLabels?.find((v) => v.date === date)
    const pctDisplay =
      typeof pctVert?.val === 'number'
        ? `${pctVert.val > 0 ? '+' : ''}${pctVert.val.toFixed(2)}%`
        : null
    return {
      strategyLabel: formatSnapshotStrategyLabel(strategyId),
      pctDisplay,
    }
  }, [snapshotHoldingSelection, snapshotResult])

  function activateSnapshotVertex(accountId, date) {
    setSnapshotHoldingsSort({ ...DEFAULT_SNAPSHOT_HOLDINGS_SORT })
    setSnapshotHoldingSelection({ accountId, date })
  }

  function onSnapshotVertexKeyDown(event, accountId, date) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setSnapshotHoldingsSort({ ...DEFAULT_SNAPSHOT_HOLDINGS_SORT })
      setSnapshotHoldingSelection({ accountId, date })
    }
  }

  const showSnapshotHoldingsPanel =
    snapshotResult &&
    snapshotResult.sortedDates.length > 0 &&
    snapshotResult.paths.some((p) => p.pathD)

  return (
    <section className="dashboard">
      <section className="card snapshot-account-card">
        <div className="section-header evaluation-list-section-header">
          <div ref={snapshotAccountHelpRef}>
            <p className="caption">PAPER · use_yn=Y</p>
            <div className="snapshot-chart-title-row">
              <h2 className="snapshot-chart-title">차트 계좌 선택</h2>
              <div className="snapshot-chart-help-anchor">
                <button
                  type="button"
                  className="snapshot-chart-help-icon-btn"
                  aria-expanded={snapshotAccountHelpOpen}
                  aria-controls="snapshot-account-help"
                  aria-describedby={snapshotAccountHelpOpen ? 'snapshot-account-help' : undefined}
                  aria-label="차트 계좌 선택 설명 보기"
                  title="설명 보기"
                  onClick={() => {
                    setSnapshotChartHelpOpen(false)
                    setSnapshotAccountHelpOpen((open) => !open)
                  }}
                >
                  <InfoHelpIconSvg />
                </button>
                {snapshotAccountHelpOpen ? (
                  <div id="snapshot-account-help" className="snapshot-chart-help-popover" role="tooltip">
                    <p className="subtle snapshot-chart-help-text">
                      조건식(진입 조건)별로 차트에 포함할 계좌를 고릅니다.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => void loadAccounts()}>
            계좌 목록 새로고침
          </button>
        </div>

        {accountsError ? <p className="error-text">계좌 목록 로드 실패: {accountsError}</p> : null}

        <div className="snapshot-account-picker">
          {accounts.length === 0 ? (
            <p className="subtle">등록된 계좌가 없거나 아직 불러오지 않았습니다. 새로고침을 눌러 주세요.</p>
          ) : (
            <>
              <p className="subtle snapshot-account-picker-meta" aria-live="polite">
                계좌 {accounts.length}
                {snapshotChartAccountIds.length > 0 ? ` · 선택 ${snapshotChartAccountIds.length}` : ''}
              </p>
              <div className="snapshot-account-checkboxes-wrap">
                <div className="snapshot-account-checkboxes" aria-label="스냅샷 차트 계좌 선택">
                  {accounts.map((item) => {
                      const id = item.account_id
                      const fullLabel = formatRegisteredAccountListLabel(item)
                      const checkboxLabel =
                        formatRegisteredAccountEntrySignal(item) || '—'
                      const checked = snapshotChartAccountIds.includes(id)
                      const legendIdx = resolveSnapshotLineLegendIndex(id, {
                        paths: snapshotResult?.paths,
                        accountsList: accounts,
                      })
                      return (
                        <label key={`snap-${id}`} title={fullLabel}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleSnapshotChartAccount(id)}
                          />
                          <i
                            className={`legend-dot snapshot-${legendIdx}`}
                            title="차트 라인 색"
                            aria-hidden
                          />
                          <span className="snapshot-account-checkbox-label">{checkboxLabel}</span>
                        </label>
                      )
                    })}
                </div>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="card snapshot-chart-card">
        <div className="benchmark-head">
          <p className="caption">저장된 통계 (MongoDB)</p>
          <div className="snapshot-chart-title-wrap" ref={snapshotChartHelpRef}>
            <div className="snapshot-chart-title-row">
              <h2 className="snapshot-chart-title">스냅샷 날짜별 총수익률</h2>
              <div className="snapshot-chart-help-anchor">
                <button
                  type="button"
                  className="snapshot-chart-help-icon-btn"
                  aria-expanded={snapshotChartHelpOpen}
                  aria-controls="snapshot-chart-help"
                  aria-describedby={snapshotChartHelpOpen ? 'snapshot-chart-help' : undefined}
                  aria-label="스냅샷 차트 설명 보기"
                  title="설명 보기"
                  onClick={() => {
                    setSnapshotAccountHelpOpen(false)
                    setSnapshotChartHelpOpen((open) => !open)
                  }}
                >
                  <InfoHelpIconSvg />
                </button>
                {snapshotChartHelpOpen ? (
                  <div id="snapshot-chart-help" className="snapshot-chart-help-popover" role="tooltip">
                    <p className="subtle snapshot-chart-help-text">
                      조회구분 합산(<code>qry_tp={SNAPSHOT_QRY_TP}</code>), 거래소 KRX(
                      <code>dmst_stex_tp={SNAPSHOT_DMST_STEX_TP}</code>)로 필터합니다. 성공 응답(
                      <code>return_code=0</code>)만 연결합니다. 각 일자 스냅샷에 붙은{' '}
                      <code>strategy_id</code>로 범례·전략 전환 지점을 표시합니다.
                    </p>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="snapshot-chart-controls-row">
          <div className="form-field">
            <label htmlFor="snap-from">시작일 (선택)</label>
            <input
              id="snap-from"
              placeholder="YYYYMMDD"
              maxLength={8}
              value={snapshotFromDate}
              onChange={(e) => setSnapshotFromDate(e.target.value.trim())}
            />
          </div>
          <div className="form-field">
            <label htmlFor="snap-to">종료일 (선택)</label>
            <input
              id="snap-to"
              placeholder="YYYYMMDD"
              maxLength={8}
              value={snapshotToDate}
              onChange={(e) => setSnapshotToDate(e.target.value.trim())}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void loadSnapshotChart()}
            disabled={snapshotLoading || accounts.length === 0}
          >
            {snapshotLoading ? '불러오는 중...' : '스냅샷 불러오기'}
          </button>
        </div>

        {snapshotError ? <p className="error-text">{snapshotError}</p> : null}

        {snapshotResult?.excludedFailed > 0 ? (
          <p className="subtle snapshot-chart-hint">
            조회 조건에 맞는 문서 중 성공이 아닌 스냅샷 {snapshotResult.excludedFailed}건은 차트에서 제외했습니다.
          </p>
        ) : null}

        {snapshotResult?.excludedFailedDetails?.length > 0 ? (
          <details className="snapshot-excluded-details">
            <summary>제외된 스냅샷 상세 보기 ({snapshotResult.excludedFailedDetails.length}건)</summary>
            <ul className="snapshot-excluded-list">
              {snapshotResult.excludedFailedDetails.slice(0, 80).map((row, idx) => (
                <li key={`${row.accountId}-${row.snapshot_date}-${idx}`}>
                  <code>{row.snapshot_date}</code> · {row.accountId} · <code>return_code</code>{' '}
                  {String(row.return_code)}
                  {row.return_msg ? ` — ${row.return_msg}` : ''}
                </li>
              ))}
            </ul>
            {snapshotResult.excludedFailedDetails.length > 80 ? (
              <p className="subtle">처음 80건만 표시합니다.</p>
            ) : null}
          </details>
        ) : null}

        {snapshotResult && snapshotResult.sortedDates.length > 0 && snapshotResult.paths.some((p) => p.pathD) ? (
          <div className="benchmark-chart-wrap">
            <svg
              className="benchmark-chart benchmark-chart--snapshot"
              viewBox={`0 0 ${SNAPSHOT_CHART_WIDTH} ${SNAPSHOT_CHART_VIEWBOX_HEIGHT}`}
              style={{ aspectRatio: `${SNAPSHOT_CHART_WIDTH} / ${SNAPSHOT_CHART_VIEWBOX_HEIGHT}` }}
              role="img"
              aria-label="스냅샷 날짜별 계좌 총수익률 추이"
            >
              {(snapshotResult.yAxisTicks || []).map((tick) => {
                const yPx = snapshotValueToPixelY(
                  tick,
                  SNAPSHOT_CHART_PLOT_HEIGHT,
                  SNAPSHOT_CHART_PADDING_Y,
                  snapshotResult.yMin,
                  snapshotResult.yMax,
                )
                const tickText = `${Number(tick.toFixed(2))}%`
                return (
                  <g key={`ygrid-${tick}`}>
                    <line
                      x1={SNAPSHOT_CHART_PLOT_LEFT_X}
                      y1={yPx}
                      x2={SNAPSHOT_CHART_PLOT_RIGHT_X}
                      y2={yPx}
                      className="snapshot-grid-line"
                    />
                    <text
                      x={SNAPSHOT_CHART_Y_TICK_LABEL_X}
                      y={yPx}
                      textAnchor="end"
                      dominantBaseline="middle"
                      className="snapshot-y-tick-label"
                    >
                      {tickText}
                    </text>
                  </g>
                )
              })}
              <line
                x1={SNAPSHOT_CHART_PLOT_LEFT_X}
                y1={SNAPSHOT_CHART_PLOT_TOP_Y}
                x2={SNAPSHOT_CHART_PLOT_LEFT_X}
                y2={SNAPSHOT_CHART_PLOT_BOTTOM_Y}
                className="axis-line"
              />
              <line
                x1={SNAPSHOT_CHART_PLOT_LEFT_X}
                y1={SNAPSHOT_CHART_PLOT_BOTTOM_Y}
                x2={SNAPSHOT_CHART_PLOT_RIGHT_X}
                y2={SNAPSHOT_CHART_PLOT_BOTTOM_Y}
                className="axis-line"
              />
              {snapshotResult.paths.map((p) =>
                p.pathD ? <path key={p.accountId} d={p.pathD} className={p.lineClass} /> : null,
              )}
              {snapshotResult.paths.flatMap((p) =>
                (p.endpointDots || []).map((dot, idx) => {
                  const pctLabel =
                    typeof dot.val === 'number' ? `${dot.val > 0 ? '+' : ''}${dot.val.toFixed(2)}%` : '—'
                  const roleKo =
                    dot.kind === 'start' ? '시작' : dot.kind === 'end' ? '끝' : dot.kind === 'single' ? '유일 포인트' : ''
                  return (
                    <circle
                      key={`${p.accountId}-ep-${dot.kind}-${dot.date}-${idx}`}
                      cx={dot.x}
                      cy={dot.y}
                      r={3.5}
                      className={`snapshot-endpoint-marker snapshot-endpoint-marker-${p.legendClassIndex}`}
                    >
                      <title>
                        {`${p.accountId} · ${dot.date} · ${roleKo}${roleKo ? ' · ' : ''}수익률 ${pctLabel}`}
                      </title>
                    </circle>
                  )
                }),
              )}
              {snapshotResult.paths.flatMap((p) =>
                (p.markerDots || []).map((dot, idx) => (
                  <circle
                    key={`${p.accountId}-m-${dot.date}-${idx}`}
                    cx={dot.x}
                    cy={dot.y}
                    r={4}
                    className={`snapshot-strategy-marker snapshot-strategy-marker-${p.legendClassIndex}`}
                  >
                    <title>
                      {`${p.accountId} · ${dot.date} · 수익률 ${typeof dot.pct === 'number' ? `${dot.pct > 0 ? '+' : ''}${dot.pct.toFixed(2)}%` : '—'} · 전략 변경: ${formatSnapshotStrategyLabel(dot.fromId)} → ${formatSnapshotStrategyLabel(dot.toId)}`}
                    </title>
                  </circle>
                )),
              )}
              {snapshotResult.paths.flatMap((p) =>
                (p.vertexLabels || []).map((pt, idx) => {
                  const stack = 9 + p.legendClassIndex * 12
                  return (
                    <text
                      key={`${p.accountId}-vl-${pt.date}-${idx}`}
                      x={pt.x}
                      y={pt.y - stack}
                      textAnchor="middle"
                      className={`snapshot-vertex-label snapshot-vertex-label-${p.legendClassIndex}`}
                    >
                      {`${pt.val > 0 ? '+' : ''}${pt.val.toFixed(1)}%`}
                    </text>
                  )
                }),
              )}
              {snapshotResult.sortedDates.map((d, i) => {
                const n = snapshotResult.sortedDates.length
                const inset = SNAPSHOT_CHART_FIRST_DATE_LABEL_OFFSET_X
                const x = snapshotChartXForIndex(
                  i,
                  n,
                  SNAPSHOT_CHART_WIDTH,
                  SNAPSHOT_CHART_PADDING_X_LEFT,
                  SNAPSHOT_CHART_PADDING_X_RIGHT,
                  inset,
                  inset,
                )
                const labelY = SNAPSHOT_CHART_DATE_LABEL_Y
                const anchor =
                  n === 1 ? 'middle' : i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'
                return (
                  <text key={`snap-x-${d}`} x={x} y={labelY} textAnchor={anchor} className="snapshot-axis-date-label">
                    {formatSnapshotDateAxisLabel(d)}
                  </text>
                )
              })}
              {snapshotResult.paths.flatMap((p) =>
                (p.vertexLabels || []).map((pt, idx) => {
                  const pctLabel =
                    typeof pt.val === 'number' ? `${pt.val > 0 ? '+' : ''}${pt.val.toFixed(2)}%` : '—'
                  const ariaLabel = `${p.accountId}, ${pt.date.slice(0, 4)}-${pt.date.slice(4, 6)}-${pt.date.slice(6, 8)}, 수익률 ${pctLabel}. 버튼. 클릭하면 해당 일자 보유 종목을 아래에 표시합니다.`
                  return (
                    <g
                      key={`${p.accountId}-hit-${pt.date}-${idx}`}
                      className="snapshot-vertex-hit-group"
                      role="button"
                      tabIndex={0}
                      aria-label={ariaLabel}
                      onClick={() => activateSnapshotVertex(p.accountId, pt.date)}
                      onKeyDown={(e) => onSnapshotVertexKeyDown(e, p.accountId, pt.date)}
                    >
                      <circle cx={pt.x} cy={pt.y} r={14} className="snapshot-vertex-hit" />
                    </g>
                  )
                }),
              )}
            </svg>
            <div className="chart-legend snapshot-chart-legend">
              {snapshotResult.paths.map((p) => (
                <span key={`leg-${p.accountId}`} className="snapshot-legend-row">
                  <i className={`legend-dot snapshot-${p.legendClassIndex}`} aria-hidden="true" />
                  <span className="snapshot-legend-account">{p.accountId}</span>
                </span>
              ))}
            </div>
            <p className="subtle">
              세로축: {SNAPSHOT_CHART_Y_AXIS_MIN_PCT}% ~ {SNAPSHOT_CHART_Y_AXIS_MAX_PCT}% 고정, 눈금 1% 간격
            </p>
            {snapshotResult.axisRangeExceeded ? (
              <p className="subtle snapshot-chart-hint">
                일부 수익률이 표시 범위({SNAPSHOT_CHART_Y_AXIS_MIN_PCT}% ~ {SNAPSHOT_CHART_Y_AXIS_MAX_PCT}%)를
                벗납니다. 곡선·점 라벨이 그래프 밖으로 이어질 수 있습니다.
              </p>
            ) : null}
            <p className="subtle snapshot-chart-hint">
              꺾은점마다 수익률(%)을 표시합니다. 선 양 끝의 채워진 원은 해당 계좌의 첫·마지막 기록일이며, 속이 비어 있는
              원은 전략 ID가 바뀐 날입니다. 마우스를 올리면 상세를 볼 수 있습니다. 꺾은점 근처를 클릭하거나 포커스 후
              Enter·Space를 누르면 아래에 해당 일자·계좌의 종목별 평가잔고(스냅샷 저장 분)가 표시됩니다.
            </p>
          </div>
        ) : null}

        {snapshotResult &&
        snapshotResult.sortedDates.length > 0 &&
        !snapshotResult.paths.some((p) => p.pathD) ? (
          <p className="subtle">선택한 조건에 맞는 유효한 총수익률 포인트가 없습니다.</p>
        ) : null}

        {snapshotResult && snapshotResult.sortedDates.length === 0 ? (
          <p className="subtle">해당 기간·계좌에 저장된 스냅샷이 없거나 필터 후 데이터가 비었습니다.</p>
        ) : null}
      </section>

      {showSnapshotHoldingsPanel ? (
        <section className="card snapshot-holdings-detail-card" aria-label="선택 일자 종목별 평가잔고">
          <div className="section-header evaluation-list-section-header">
            <div>
              <p className="caption">스냅샷 저장 분 (`acnt_evlt_remn_indv_tot`)</p>
              <h2>선택 일자 종목별 평가잔고</h2>
              <p className="subtle">
                차트에서 고른 계좌·일자의 보유 종목입니다. 조회구분 합산(<code>{SNAPSHOT_QRY_TP}</code>),
                거래소 <code>{SNAPSHOT_DMST_STEX_TP}</code> 필터와 동일한 스냅샷 문서를 사용합니다.
              </p>
            </div>
          </div>

          {!snapshotHoldingSelection ? (
            <p className="subtle">차트의 꺾은점을 클릭하거나 키보드로 선택하면 여기에 목록이 표시됩니다.</p>
          ) : (
            <>
              <p className="snapshot-holdings-detail-meta">
                <strong>{snapshotHoldingSelection.accountId}</strong>
                <span aria-hidden> · </span>
                <span>
                  {snapshotHoldingSelection.date.slice(0, 4)}-{snapshotHoldingSelection.date.slice(4, 6)}-
                  {snapshotHoldingSelection.date.slice(6, 8)}
                </span>
                {selectedSnapshotDetailMeta?.pctDisplay ? (
                  <>
                    <span aria-hidden> · </span>
                    <span>총수익률 {selectedSnapshotDetailMeta.pctDisplay}</span>
                  </>
                ) : null}
                <span aria-hidden> · </span>
                <span className="subtle">전략 {selectedSnapshotDetailMeta?.strategyLabel ?? '—'}</span>
              </p>

              {sortedSnapshotHoldingsRows.length === 0 ? (
                <p className="subtle">
                  이 일자 스냅샷에 저장된 종목 목록이 비어 있거나, 해당 데이터가 없습니다.
                </p>
              ) : (
                <>
                  <p className="caption snapshot-holdings-count">총 {sortedSnapshotHoldingsRows.length}건</p>
                  <div className="table-scroll evaluation-table-desktop-wrap">
                    <table className="data-table evaluation-table">
                      <colgroup>
                        <col className="col-name" />
                        <col className="col-pl" />
                        <col className="col-rate" />
                        <col className="col-price" />
                        <col className="col-qty" />
                        <col className="col-price" />
                        <col className="col-amount" />
                        <col className="col-amount" />
                        <col className="col-rate" />
                      </colgroup>
                      <thead>
                        <tr>
                          <th>종목명</th>
                          <th
                            className="num th-sortable"
                            aria-sort={
                              snapshotHoldingsSort?.field === 'evltv_prft'
                                ? snapshotHoldingsSort.dir === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                          >
                            <button
                              type="button"
                              className="th-sort-btn"
                              onClick={() => cycleSnapshotHoldingsSort('evltv_prft')}
                              title="클릭: 높은순 → 낮은순 → 원래 순서"
                            >
                              평가손익
                              <span className="th-sort-icons" aria-hidden="true">
                                {snapshotHoldingsSort?.field === 'evltv_prft'
                                  ? snapshotHoldingsSort.dir === 'desc'
                                    ? ' ▼'
                                    : ' ▲'
                                  : ''}
                              </span>
                            </button>
                          </th>
                          <th
                            className="num th-sortable"
                            aria-sort={
                              snapshotHoldingsSort?.field === 'prft_rt'
                                ? snapshotHoldingsSort.dir === 'asc'
                                  ? 'ascending'
                                  : 'descending'
                                : 'none'
                            }
                          >
                            <button
                              type="button"
                              className="th-sort-btn"
                              onClick={() => cycleSnapshotHoldingsSort('prft_rt')}
                              title="클릭: 높은순 → 낮은순 → 원래 순서"
                            >
                              수익률
                              <span className="th-sort-icons" aria-hidden="true">
                                {snapshotHoldingsSort?.field === 'prft_rt'
                                  ? snapshotHoldingsSort.dir === 'desc'
                                    ? ' ▼'
                                    : ' ▲'
                                  : ''}
                              </span>
                            </button>
                          </th>
                          <th className="num">매입가</th>
                          <th className="num">보유수량</th>
                          <th className="num">현재가</th>
                          <th className="num">매입금액</th>
                          <th className="num">평가금액</th>
                          <th className="num">보유비중</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedSnapshotHoldingsRows.map((item, index) => {
                          const d = getEvaluationBalanceRowDisplay(item)
                          return (
                            <tr key={`${item?.stk_cd || 'stk'}-snap-${index}`}>
                              <td>
                                <span className="stock-name-with-code" data-code={d.stockCode}>
                                  {d.stockName}
                                </span>
                              </td>
                              <td className={`num ${d.pnlTone ? `delta ${d.pnlTone}` : ''}`}>{d.evltvPrftText}</td>
                              <td className={`num ${d.profitTone ? `delta ${d.profitTone}` : ''}`}>{d.prftRtText}</td>
                              <td className="num">{d.purPricText}</td>
                              <td className="num">{d.rmndQtyText}</td>
                              <td className="num">{d.curPrcText}</td>
                              <td className="num">{d.purAmtText}</td>
                              <td className="num">{d.evltAmtText}</td>
                              <td className="num">{d.possRtText}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="evaluation-balance-mobile-block">
                    <div className="evaluation-mobile-sort-bar" role="toolbar" aria-label="종목 목록 정렬">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => cycleSnapshotHoldingsSort('evltv_prft')}
                        aria-pressed={holdingsSortMetaPnl.ariaPressed}
                        aria-label={holdingsSortMetaPnl.ariaLabel}
                      >
                        {holdingsSortMetaPnl.name}
                        <span aria-hidden="true">{holdingsSortMetaPnl.icon}</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => cycleSnapshotHoldingsSort('prft_rt')}
                        aria-pressed={holdingsSortMetaPrft.ariaPressed}
                        aria-label={holdingsSortMetaPrft.ariaLabel}
                      >
                        {holdingsSortMetaPrft.name}
                        <span aria-hidden="true">{holdingsSortMetaPrft.icon}</span>
                      </button>
                    </div>
                    <ul className="evaluation-balance-list-mobile">
                      {sortedSnapshotHoldingsRows.map((item, index) => (
                        <EvaluationBalanceMobileCard
                          key={`${item?.stk_cd || 'stk'}-snap-m-${index}`}
                          item={item}
                        />
                      ))}
                    </ul>
                  </div>
                </>
              )}
            </>
          )}
        </section>
      ) : null}
    </section>
  )
}
