import { parseNumericString } from './numbers.js'

export const SNAPSHOT_CHART_LINE_CLASSES = [
  'line-snapshot-0',
  'line-snapshot-1',
  'line-snapshot-2',
  'line-snapshot-3',
  'line-snapshot-4',
  'line-snapshot-5',
  'line-snapshot-6',
  'line-snapshot-7',
]

const SNAPSHOT_LINE_COLOR_COUNT = SNAPSHOT_CHART_LINE_CLASSES.length

/**
 * 계좌별로 고정되는 색 인덱스 (0..N-1). 선택 집합과 무관하게 같은 계좌는 같은 색.
 * 등록 목록의 순번을 쓰고, 목록에 없으면 account_id 문자열 해시로 결정.
 *
 * @param {string} accountId
 * @param {{ account_id: string }[]} [accountsList]
 */
export function stableSnapshotLegendIndex(accountId, accountsList) {
  const id = String(accountId || '').trim()
  if (!id) {
    return 0
  }
  const list = Array.isArray(accountsList) ? accountsList : []
  const accIdx = list.findIndex((a) => String(a.account_id || '').trim() === id)
  if (accIdx >= 0) {
    return accIdx % SNAPSHOT_LINE_COLOR_COUNT
  }
  let h = 0
  for (let i = 0; i < id.length; i += 1) {
    h = (Math.imul(31, h) + id.charCodeAt(i)) >>> 0
  }
  return h % SNAPSHOT_LINE_COLOR_COUNT
}

/**
 * 스냅샷 차트 라인·범례·계좌 체크박스 점 색 인덱스 (0..N-1).
 * paths에 해당 계좌가 있으면 그 legendClassIndex, 없으면 stableSnapshotLegendIndex.
 *
 * @param {string} accountId
 * @param {{ paths?: { accountId: string, legendClassIndex?: number }[] | null, accountsList?: { account_id: string }[] }} [options]
 */
export function resolveSnapshotLineLegendIndex(accountId, options) {
  const id = String(accountId || '').trim()
  const { paths = null, accountsList = [] } = options || {}
  if (!id) {
    return 0
  }
  if (Array.isArray(paths) && paths.length > 0) {
    const hit = paths.find((p) => String(p.accountId || '').trim() === id)
    if (hit != null && Number.isFinite(hit.legendClassIndex)) {
      return hit.legendClassIndex % SNAPSHOT_LINE_COLOR_COUNT
    }
  }
  return stableSnapshotLegendIndex(id, accountsList)
}

/** SVG viewBox width / plot 논리 높이 (y 스케일·패딩 계산) */
export const SNAPSHOT_CHART_WIDTH = 720
/** 플롯 영역을 세로로 길게 하면 수익률 변화가 더 잘 보입니다. */
export const SNAPSHOT_CHART_PLOT_HEIGHT = 300
/** 상·하 플롯 패딩 (수치 스케일용) */
export const SNAPSHOT_CHART_PADDING_Y = 24
/**
 * 왼쪽: Y축 눈금(% 문자열)이 잘리지 않도록 여유를 둡니다.
 * 오른쪽: 플롯과 viewBox 우측 사이.
 */
export const SNAPSHOT_CHART_PADDING_X_LEFT = 56
export const SNAPSHOT_CHART_PADDING_X_RIGHT = 24

/** @deprecated SNAPSHOT_CHART_PADDING_Y 사용 */
export const SNAPSHOT_CHART_PADDING = SNAPSHOT_CHART_PADDING_Y

/** 세로 플롯 영역: 왼쪽 Y축 선 위치·데이터 x 시작 */
export const SNAPSHOT_CHART_PLOT_LEFT_X = SNAPSHOT_CHART_PADDING_X_LEFT
/** 데이터·x축 오른쪽 끝 */
export const SNAPSHOT_CHART_PLOT_RIGHT_X = SNAPSHOT_CHART_WIDTH - SNAPSHOT_CHART_PADDING_X_RIGHT
/** Y축 눈금 텍스트 (textAnchor end 기준 anchor x, 글자는 이보다 왼쪽으로 확장) */
export const SNAPSHOT_CHART_Y_TICK_LABEL_X = SNAPSHOT_CHART_PADDING_X_LEFT - 6

/** 플롯 상단 / 좌측축 상단 (y, 수익률 max 근처) */
export const SNAPSHOT_CHART_PLOT_TOP_Y = SNAPSHOT_CHART_PADDING_Y
/** x축·플롯 하단 */
export const SNAPSHOT_CHART_PLOT_BOTTOM_Y = SNAPSHOT_CHART_PLOT_HEIGHT - SNAPSHOT_CHART_PADDING_Y
/** x축 아래 날짜 라벨 baseline 근처 */
export const SNAPSHOT_CHART_DATE_LABEL_Y = SNAPSHOT_CHART_PLOT_BOTTOM_Y + 28
/** x축 아래 날짜 라벨·데이터 라인·점: 가로 양끝을 Y축·우측에서 동일 px만큼 안쪽으로 둠 */
export const SNAPSHOT_CHART_FIRST_DATE_LABEL_OFFSET_X = 10
/** viewBox 전체 높이 (날짜 라벨·여백 포함) */
export const SNAPSHOT_CHART_VIEWBOX_HEIGHT = SNAPSHOT_CHART_DATE_LABEL_Y + 20

/** 세로축 범위·눈금 고정 (%). 데이터가 벗어나면 안내 문구 표시. */
export const SNAPSHOT_CHART_Y_AXIS_MAX_PCT = 5
export const SNAPSHOT_CHART_Y_AXIS_MIN_PCT = -15
export const SNAPSHOT_CHART_Y_AXIS_STEP_PCT = 1

/**
 * 항상 [MIN, MAX] 구간 사용 (데이터와 무관하게 동일 스케일).
 * @returns {{ yMin: number, yMax: number }}
 */
export function computeSnapshotChartYRange() {
  return {
    yMin: SNAPSHOT_CHART_Y_AXIS_MIN_PCT,
    yMax: SNAPSHOT_CHART_Y_AXIS_MAX_PCT,
  }
}

/**
 * 수익률(%) → SVG y (상단이 높은 %)
 * @param {number} value
 */
export function snapshotValueToPixelY(value, height, paddingY, yMin, yMax) {
  const range = Math.max(yMax - yMin, 0.01)
  const innerH = height - paddingY * 2
  return height - paddingY - ((value - yMin) / range) * innerH
}

/** yMin~yMax 구간을 stepPct 간격으로 눈금 배열 생성 (양 끝 포함) */
export function buildSnapshotYAxisTicks(
  yMin,
  yMax,
  stepPct = SNAPSHOT_CHART_Y_AXIS_STEP_PCT,
) {
  const ticks = []
  const span = yMax - yMin
  if (!Number.isFinite(span) || span < 0) {
    return [yMin, yMax]
  }
  const n = Math.round(span / stepPct)
  for (let i = 0; i <= n; i += 1) {
    const v = yMin + i * stepPct
    ticks.push(Math.round(v * 100) / 100)
  }
  return ticks
}

/**
 * @param {number} i date index in sortedDates (0 .. n-1)
 * @param {number} n sortedDates.length
 * @param {number} [insetLeft] 플롯 좌·우 안쪽 여백 (라벨·path 동일 스케일)
 * @param {number} [insetRight]
 */
export function snapshotChartXForIndex(
  i,
  n,
  width = SNAPSHOT_CHART_WIDTH,
  paddingLeft = SNAPSHOT_CHART_PADDING_X_LEFT,
  paddingRight = SNAPSHOT_CHART_PADDING_X_RIGHT,
  insetLeft = 0,
  insetRight = 0,
) {
  if (n <= 0) {
    return paddingLeft + insetLeft
  }
  const leftX = paddingLeft + insetLeft
  const rightX = width - paddingRight - insetRight
  const span = rightX - leftX
  if (span <= 0) {
    return leftX
  }
  return n === 1 ? leftX + span / 2 : leftX + (i * span) / (n - 1)
}

export function isEvaluationSnapshotSuccessReturn(returnCode) {
  if (returnCode === null || returnCode === undefined) {
    return false
  }
  try {
    return parseInt(String(returnCode), 10) === 0
  } catch {
    return String(returnCode).trim() === '0'
  }
}

export function formatSnapshotDateAxisLabel(yyyymmdd) {
  const s = String(yyyymmdd || '').trim()
  if (s.length !== 8) {
    return s || '—'
  }
  return `${s.slice(4, 6)}/${s.slice(6, 8)}`
}

export function isValidYyyymmdd(value) {
  const s = String(value || '').trim()
  return s.length === 8 && /^\d{8}$/.test(s)
}

/**
 * @param {string[]} sortedDates ascending YYYYMMDD
 * @param {Map<string, unknown>} dateToValue
 */
export function buildSnapshotLinePathD(
  sortedDates,
  dateToValue,
  width,
  height,
  paddingY,
  minVal,
  maxVal,
  plotInsetX = SNAPSHOT_CHART_FIRST_DATE_LABEL_OFFSET_X,
) {
  const range = Math.max(maxVal - minVal, 0.01)
  const n = sortedDates.length
  if (n === 0) {
    return ''
  }
  const innerH = height - paddingY * 2
  let d = ''
  let penUp = true
  for (let i = 0; i < n; i += 1) {
    const date = sortedDates[i]
    const val = parseNumericString(dateToValue.get(date))
    if (val === null) {
      penUp = true
      continue
    }
    const x = snapshotChartXForIndex(
      i,
      n,
      width,
      SNAPSHOT_CHART_PADDING_X_LEFT,
      SNAPSHOT_CHART_PADDING_X_RIGHT,
      plotInsetX,
      plotInsetX,
    )
    const y = height - paddingY - ((val - minVal) / range) * innerH
    const xs = x.toFixed(2)
    const ys = y.toFixed(2)
    if (penUp) {
      d += `${d ? ' ' : ''}M ${xs} ${ys}`
      penUp = false
    } else {
      d += ` L ${xs} ${ys}`
    }
  }
  return d
}

export function normalizeSnapshotStrategyId(raw) {
  const s = String(raw ?? '').trim()
  return s || null
}

export function formatSnapshotStrategyLabel(id) {
  return id == null || id === '' ? '—' : id
}

/**
 * @param {string[]} sortedDates ascending YYYYMMDD
 * @param {Map<string, number>} dateToValue
 * @param {Map<string, string | null>} dateToStrategyId
 */
export function collectSnapshotStrategyChanges(sortedDates, dateToValue, dateToStrategyId) {
  const changes = []
  let prevDate = null
  for (const d of sortedDates) {
    const y = parseNumericString(dateToValue.get(d))
    if (y === null) {
      continue
    }
    const sid = normalizeSnapshotStrategyId(dateToStrategyId.get(d))
    if (prevDate !== null) {
      const prevSid = normalizeSnapshotStrategyId(dateToStrategyId.get(prevDate))
      if (prevSid !== sid) {
        changes.push({ date: d, fromId: prevSid, toId: sid })
      }
    }
    prevDate = d
  }
  return changes
}

/**
 * @param {string[]} sortedDates
 * @param {string} date
 * @param {number} val
 */
export function snapshotPointXY(
  sortedDates,
  date,
  val,
  width,
  height,
  paddingY,
  yMin,
  yMax,
  plotInsetX = SNAPSHOT_CHART_FIRST_DATE_LABEL_OFFSET_X,
) {
  const n = sortedDates.length
  const i = sortedDates.indexOf(date)
  if (i < 0) {
    return null
  }
  const range = Math.max(yMax - yMin, 0.01)
  const innerH = height - paddingY * 2
  const x = snapshotChartXForIndex(
    i,
    n,
    width,
    SNAPSHOT_CHART_PADDING_X_LEFT,
    SNAPSHOT_CHART_PADDING_X_RIGHT,
    plotInsetX,
    plotInsetX,
  )
  const y = height - paddingY - ((val - yMin) / range) * innerH
  return { x, y }
}
