import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const summaryCards = [
  { label: '총 자산', value: 128450000, change: '+2.34%', tone: 'up' },
  { label: '일일 손익', value: 1872000, change: '+1.48%', tone: 'up' },
  { label: '평가손익률', value: 7.62, change: '+0.52%p', tone: 'up', isPercent: true },
  { label: '주문 가능 금액', value: 24300000, change: '-0.82%', tone: 'down' },
]

const watchlist = [
  { symbol: '005930', name: '삼성전자', price: 79800, change: '+1.12%', volume: '12.4M', tone: 'up' },
  { symbol: '035420', name: 'NAVER', price: 186500, change: '-0.43%', volume: '1.1M', tone: 'down' },
  { symbol: '000660', name: 'SK하이닉스', price: 202000, change: '+2.01%', volume: '3.6M', tone: 'up' },
  { symbol: '207940', name: '삼성바이오로직스', price: 889000, change: '-0.18%', volume: '0.3M', tone: 'down' },
]

const positions = [
  { name: '삼성전자', amount: '120주', average: '77,300원', pnl: '+300,000원', tone: 'up' },
  { name: 'SK하이닉스', amount: '45주', average: '193,500원', pnl: '+382,500원', tone: 'up' },
  { name: 'NAVER', amount: '30주', average: '189,000원', pnl: '-75,000원', tone: 'down' },
]

const orderHistory = [
  { time: '15:38:21', symbol: '005930', type: '매수', price: '79,700원', qty: '20주', status: '체결' },
  { time: '15:22:09', symbol: '035420', type: '매도', price: '186,800원', qty: '10주', status: '체결' },
  { time: '14:59:03', symbol: '000660', type: '매수', price: '201,500원', qty: '5주', status: '대기' },
]

const performanceSeries = [
  { day: '04/24', integrated: 0.2, accountA: 0.1, accountB: 0.3, kodex: 0.1 },
  { day: '04/25', integrated: 0.5, accountA: 0.4, accountB: 0.7, kodex: 0.3 },
  { day: '04/26', integrated: 0.7, accountA: 0.5, accountB: 1.0, kodex: 0.6 },
  { day: '04/29', integrated: 1.4, accountA: 0.9, accountB: 1.9, kodex: 0.8 },
  { day: '04/30', integrated: 1.8, accountA: 1.2, accountB: 2.2, kodex: 1.2 },
  { day: '05/01', integrated: 2.6, accountA: 1.8, accountB: 3.1, kodex: 1.6 },
  { day: '05/02', integrated: 3.3, accountA: 2.4, accountB: 3.7, kodex: 2.1 },
  { day: '05/03', integrated: 4.7, accountA: 3.2, accountB: 5.3, kodex: 2.9 },
]

const performanceKeys = ['integrated', 'accountA', 'accountB', 'kodex']
const UNSELECTED_OPTION = '__UNSELECTED__'
const NO_RULE = '__NO_RULE__'
const API_PREFIX = '/api/v1'

class ApiError extends Error {
  constructor(message, status, requestUrl, detail) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.requestUrl = requestUrl
    this.detail = detail
  }
}

function buildApiUrl(path, params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}` !== '') {
      query.set(key, String(value))
    }
  })
  const queryString = query.toString()
  return `${API_PREFIX}${path}${queryString ? `?${queryString}` : ''}`
}

async function requestJson(method, path, { params, body } = {}) {
  const requestUrl = buildApiUrl(path, params)
  const response = await fetch(requestUrl, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  if (response.status === 204) {
    return null
  }

  const rawText = await response.text()
  let data = null
  if (rawText) {
    try {
      data = JSON.parse(rawText)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? data.detail
        : rawText || response.statusText
    throw new ApiError(
      `${response.status} ${requestUrl} | detail=${detail}`,
      response.status,
      requestUrl,
      detail,
    )
  }
  return data
}

function parseCommaInt(value) {
  const normalized = String(value || '')
    .replace(/,/g, '')
    .trim()
  if (!normalized) {
    return null
  }
  const parsed = Number.parseInt(normalized, 10)
  return Number.isNaN(parsed) ? null : parsed
}

function toComma(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return ''
  }
  return new Intl.NumberFormat('ko-KR').format(Number(value))
}

function declarativeRuleStableId(rule) {
  const raw = rule?.rule_id ?? rule?._id ?? rule?.id
  if (raw === null || raw === undefined) {
    return ''
  }
  const s = String(raw).trim()
  return s
}

/** GET /rules RuleRecord[] 에서 템플릿 옵션 생성 */
function flattenDeclarativeRuleOptionsFromRulesList(flatRules, ruleTypeUpper) {
  const want = String(ruleTypeUpper || '').toUpperCase()
  const out = []
  if (!Array.isArray(flatRules)) {
    return out
  }
  const seen = new Set()
  for (const r of flatRules) {
    if (String(r?.type || '').toUpperCase() !== want) {
      continue
    }
    const rid = String(r?.rule_id || '').trim()
    if (!rid || seen.has(rid)) {
      continue
    }
    seen.add(rid)
    const label = String(r?.name || '').trim() || rid
    out.push({
      value: rid,
      label,
      rule: r,
      rule_id: rid,
    })
  }
  return out
}

function normalizeOperator(op) {
  return String(op || '')
    .trim()
    .toLowerCase()
}

function declarativeRulesRoughlyEqual(a, b) {
  if (!a || !b) {
    return false
  }
  return (
    String(a.base || '').trim() === String(b.base || '').trim() &&
    String(a.target || '').trim() === String(b.target || '').trim() &&
    Number(a.offset) === Number(b.offset) &&
    normalizeOperator(a.operator) === normalizeOperator(b.operator)
  )
}

/** 활성 전략 임베드 규칙 한 축(templateOptions와 매칭) → select value */
function resolveDeclarativeRuleSelectValueFromStrategy(strategyRules, templateOptions, ruleTypeUpper) {
  const kind = String(ruleTypeUpper || '').toUpperCase()
  const typed = (Array.isArray(strategyRules) ? strategyRules : []).filter(
    (r) => String(r?.type || '').toUpperCase() === kind,
  )
  if (typed.length === 0) {
    return NO_RULE
  }
  const embedded = typed[0]
  const eid = declarativeRuleStableId(embedded)
  if (eid) {
    const byId = templateOptions.find((o) => declarativeRuleStableId(o.rule) === eid)
    if (byId) {
      return byId.value
    }
  }
  const byShape = templateOptions.find((o) => declarativeRulesRoughlyEqual(embedded, o.rule))
  if (byShape) {
    return byShape.value
  }
  return UNSELECTED_OPTION
}

/** POST/PATCH 규칙 본문: 백엔드 DeclarativeRule 과 필드 호환 (_id 포함) */
function declarativeRuleToStrategyPayload(rule, ruleTypeUpper) {
  if (!rule || typeof rule !== 'object') {
    return null
  }
  const type = String(ruleTypeUpper || rule.type || '').toUpperCase()
  if (type !== 'STOP_LOSS' && type !== 'TAKE_PROFIT') {
    return null
  }
  const payload = {
    type,
    base: String(rule.base || '').trim(),
    target: String(rule.target || '').trim(),
    offset: Number(rule.offset),
    operator: normalizeOperator(rule.operator),
    name: String(rule.name || '').trim(),
  }
  const oid = declarativeRuleStableId(rule)
  if (oid) {
    payload.rule_id = oid
  }
  return payload
}

/** 손절 먼저, 익절 다음 순서로 임베드 규칙 배열 생성 (각 0~1건, 둘 다 없음 허용) */
function assembleStrategyEmbeddedRulesFromSelectors(
  simpleSellRule,
  simpleBuyRule,
  stopLossRuleOptions,
  takeProfitRuleOptions,
) {
  const rules = []
  if (simpleSellRule !== NO_RULE) {
    const slPick = stopLossRuleOptions.find((o) => o.value === simpleSellRule)
    if (!slPick) {
      return rules
    }
    const sl = declarativeRuleToStrategyPayload(slPick.rule, 'STOP_LOSS')
    if (sl?.base && sl.operator) {
      rules.push(sl)
    }
  }
  if (simpleBuyRule !== NO_RULE) {
    const tpPick = takeProfitRuleOptions.find((o) => o.value === simpleBuyRule)
    if (!tpPick) {
      return rules
    }
    const tp = declarativeRuleToStrategyPayload(tpPick.rule, 'TAKE_PROFIT')
    if (tp?.base && tp.operator) {
      rules.push(tp)
    }
  }
  return rules
}

function isMissingActiveStrategyError(error) {
  if (!(error instanceof ApiError)) {
    return false
  }
  return error.status === 404 || error.status === 400
}

function formatCurrency(value) {
  return `${new Intl.NumberFormat('ko-KR').format(value)}원`
}

function formatPercent(value) {
  return `${value > 0 ? '+' : ''}${value}%`
}

function parseNumericString(value) {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null
  }
  const normalized = String(value).replace(/,/g, '').trim()
  if (!normalized) {
    return null
  }
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function formatApiAmount(value) {
  const parsed = parseNumericString(value)
  if (parsed === null) {
    return '-'
  }
  return `${new Intl.NumberFormat('ko-KR').format(Math.trunc(parsed))}원`
}

function formatApiNumber(value) {
  const parsed = parseNumericString(value)
  if (parsed === null) {
    return '-'
  }
  return new Intl.NumberFormat('ko-KR').format(Math.trunc(parsed))
}

function formatApiPercent(value) {
  const parsed = parseNumericString(value)
  if (parsed === null) {
    return '-'
  }
  return `${parsed > 0 ? '+' : ''}${parsed.toFixed(2)}%`
}

function getToneByNumericString(value) {
  const parsed = parseNumericString(value)
  if (parsed === null || parsed === 0) {
    return ''
  }
  return parsed > 0 ? 'up' : 'down'
}

function getEvaluationBalanceRowDisplay(item) {
  const stockCode = String(item?.stk_cd || '').replace(/^A/, '')
  return {
    stockName: item?.stk_nm || '-',
    stockCode,
    pnlTone: getToneByNumericString(item?.evltv_prft),
    profitTone: getToneByNumericString(item?.prft_rt),
    evltvPrftText: formatApiAmount(item?.evltv_prft),
    prftRtText: formatApiPercent(item?.prft_rt),
    purPricText: formatApiAmount(item?.pur_pric),
    rmndQtyText: formatApiNumber(item?.rmnd_qty),
    curPrcText: formatApiAmount(item?.cur_prc),
    purAmtText: formatApiAmount(item?.pur_amt),
    evltAmtText: formatApiAmount(item?.evlt_amt),
    possRtText: formatApiPercent(item?.poss_rt),
  }
}

function evalBalanceSortControlMeta(field, evalBalanceSort) {
  const name = field === 'evltv_prft' ? '평가손익' : '수익률'
  const active = evalBalanceSort?.field === field
  const phase = !active ? '미적용' : evalBalanceSort.dir === 'desc' ? '내림차순' : '오름차순'
  const icon = active ? (evalBalanceSort.dir === 'desc' ? ' ▼' : ' ▲') : ''
  return {
    name,
    ariaLabel: `${name} 정렬, 현재 ${phase}. 누르면 내림차순, 오름차순, 원래 순서가 순환합니다.`,
    icon,
    ariaPressed: active,
  }
}

function EvaluationBalanceMobileCard({ item }) {
  const d = getEvaluationBalanceRowDisplay(item)
  return (
    <li className="evaluation-balance-card">
      <div className="evaluation-balance-card-title">
        <span className="stock-name-with-code" data-code={d.stockCode}>
          {d.stockName}
        </span>
      </div>
      <div className="evaluation-balance-card-fields">
        <div className="evaluation-balance-card-row">
          <span className="evaluation-balance-card-label">평가손익</span>
          <span className={`evaluation-balance-card-value num ${d.pnlTone ? `delta ${d.pnlTone}` : ''}`}>
            {d.evltvPrftText}
          </span>
        </div>
        <div className="evaluation-balance-card-row">
          <span className="evaluation-balance-card-label">수익률</span>
          <span className={`evaluation-balance-card-value num ${d.profitTone ? `delta ${d.profitTone}` : ''}`}>
            {d.prftRtText}
          </span>
        </div>
        <div className="evaluation-balance-card-row">
          <span className="evaluation-balance-card-label">매입가</span>
          <span className="evaluation-balance-card-value num">{d.purPricText}</span>
        </div>
        <div className="evaluation-balance-card-row">
          <span className="evaluation-balance-card-label">보유수량</span>
          <span className="evaluation-balance-card-value num">{d.rmndQtyText}</span>
        </div>
        <div className="evaluation-balance-card-row">
          <span className="evaluation-balance-card-label">현재가</span>
          <span className="evaluation-balance-card-value num">{d.curPrcText}</span>
        </div>
        <div className="evaluation-balance-card-row">
          <span className="evaluation-balance-card-label">매입금액</span>
          <span className="evaluation-balance-card-value num">{d.purAmtText}</span>
        </div>
        <div className="evaluation-balance-card-row">
          <span className="evaluation-balance-card-label">평가금액</span>
          <span className="evaluation-balance-card-value num">{d.evltAmtText}</span>
        </div>
        <div className="evaluation-balance-card-row">
          <span className="evaluation-balance-card-label">보유비중</span>
          <span className="evaluation-balance-card-value num">{d.possRtText}</span>
        </div>
      </div>
    </li>
  )
}

function buildLinePath(series, key) {
  const width = 720
  const height = 220
  const padding = 24
  const allValues = series.flatMap((item) => performanceKeys.map((seriesKey) => item[seriesKey]))
  const min = Math.min(...allValues)
  const max = Math.max(...allValues)
  const range = Math.max(max - min, 0.1)

  return series
    .map((item, index) => {
      const x = padding + (index * (width - padding * 2)) / (series.length - 1)
      const y = height - padding - ((item[key] - min) / range) * (height - padding * 2)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    })
    .join(' ')
}

function App() {
  const [activeView, setActiveView] = useState('dashboard')
  const pageTitle = {
    dashboard: '통합 대시보드',
    settings: '계좌 조건 설정',
    evaluationBalance: '계좌평가 잔고내역',
  }[activeView]

  return (
    <main className="layout-shell">
      <aside className="sidebar card" aria-label="주요 메뉴">
        <p className="caption">Trading UI MVP</p>
        <h2>메뉴</h2>
        <nav className="sidebar-nav" aria-label="화면 전환">
          <button
            type="button"
            className={`nav-item ${activeView === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveView('dashboard')}
          >
            통합 대시보드
          </button>
          <button
            type="button"
            className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveView('settings')}
          >
            계좌 조건 설정
          </button>
          <button
            type="button"
            className={`nav-item ${activeView === 'evaluationBalance' ? 'active' : ''}`}
            onClick={() => setActiveView('evaluationBalance')}
          >
            계좌평가 잔고내역
          </button>
        </nav>
      </aside>

      <section className="content-shell">
        <header className="topbar card">
          <div>
            {/* <p className="caption">Trading Workspace</p> */}
            <h1>{pageTitle}</h1>
            {/* <p className="subtle">멀티 계좌 통합 뷰</p> */}
          </div>
        </header>

        {activeView === 'dashboard' ? <DashboardDummy /> : null}
        {activeView === 'settings' ? <SettingsDummy /> : null}
        {activeView === 'evaluationBalance' ? <AccountEvaluationBalanceView /> : null}
      </section>
    </main>
  )
}

function DashboardDummy() {
  const integratedPath = buildLinePath(performanceSeries, 'integrated')
  const accountAPath = buildLinePath(performanceSeries, 'accountA')
  const accountBPath = buildLinePath(performanceSeries, 'accountB')
  const kodexPath = buildLinePath(performanceSeries, 'kodex')
  const latest = performanceSeries[performanceSeries.length - 1]

  return (
    <section className="dashboard">
      <section className="summary-grid" aria-label="통합 자산 요약">
        {summaryCards.map((card) => (
          <article key={card.label} className="card summary-card">
            <p className="caption">{card.label}</p>
            <p className="summary-value">
              {card.isPercent ? formatPercent(card.value) : formatCurrency(card.value)}
            </p>
            <p className={`delta ${card.tone}`}>{card.change}</p>
          </article>
        ))}
      </section>

      <section className="card benchmark-card">
        <div className="benchmark-head">
          <p className="caption">통합 성과 비교 (YTD)</p>
          <h2>통합 포트폴리오 vs KODEX 200 (069500)</h2>
          <p className="subtle">일별 누적 수익률 추이 (더미 데이터)</p>
        </div>
        <div className="benchmark-chart-wrap">
          <svg
            className="benchmark-chart"
            viewBox="0 0 720 220"
            role="img"
            aria-label="통합 포트폴리오와 KODEX 200의 일별 성과 비교 그래프"
          >
            <line x1="24" y1="24" x2="24" y2="196" className="axis-line" />
            <line x1="24" y1="196" x2="696" y2="196" className="axis-line" />
            <path d={kodexPath} className="line-kodex" />
            <path d={accountAPath} className="line-account-a" />
            <path d={accountBPath} className="line-account-b" />
            <path d={integratedPath} className="line-integrated" />
          </svg>

          <div className="chart-legend">
            <span>
              <i className="legend-dot integrated" />
              통합 포트폴리오 {formatPercent(latest.integrated)}
            </span>
            <span>
              <i className="legend-dot account-a" />
              paper-001 {formatPercent(latest.accountA)}
            </span>
            <span>
              <i className="legend-dot account-b" />
              paper-002 {formatPercent(latest.accountB)}
            </span>
            <span>
              <i className="legend-dot kodex" />
              KODEX 200 {formatPercent(latest.kodex)}
            </span>
            <span className="delta up">Alpha +{(latest.integrated - latest.kodex).toFixed(1)}%p</span>
          </div>

          <div className="chart-labels" aria-hidden="true">
            {performanceSeries.map((point) => (
              <span key={point.day}>{point.day}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="main-grid">
        <div className="left-column">
          <article className="card">
            <div className="section-header">
              <h2>관심 종목</h2>
              <button type="button" className="text-button">
                전체 보기
              </button>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>종목</th>
                  <th>현재가</th>
                  <th>등락률</th>
                  <th>거래량</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((item) => (
                  <tr key={item.symbol}>
                    <td>
                      <p className="symbol">{item.symbol}</p>
                      <p className="subtle">{item.name}</p>
                    </td>
                    <td className="num">{formatCurrency(item.price)}</td>
                    <td className={`num delta ${item.tone}`}>{item.change}</td>
                    <td className="num">{item.volume}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>

          <article className="card">
            <div className="section-header">
              <h2>포지션 요약</h2>
              <span className="caption">총 3개 포지션</span>
            </div>
            <ul className="position-list">
              {positions.map((item) => (
                <li key={item.name}>
                  <div>
                    <p className="symbol">{item.name}</p>
                    <p className="subtle">
                      보유 {item.amount} · 평단 {item.average}
                    </p>
                  </div>
                  <p className={`delta ${item.tone}`}>{item.pnl}</p>
                </li>
              ))}
            </ul>
          </article>
        </div>

        <aside className="right-column">
          <article className="card order-panel">
            <h2>빠른 주문</h2>
            <label htmlFor="symbol">종목 코드</label>
            <input id="symbol" defaultValue="005930" />
            <label htmlFor="price">주문 가격</label>
            <input id="price" defaultValue="79,700" />
            <label htmlFor="quantity">수량</label>
            <input id="quantity" defaultValue="10" />
            <div className="order-actions">
              <button type="button" className="btn btn-primary">
                매수
              </button>
              <button type="button" className="btn btn-secondary">
                매도
              </button>
            </div>
          </article>

          <article className="card">
            <h2>알림 / 리스크</h2>
            <ul className="alert-list">
              <li>
                <span className="badge warn">주의</span>
                NAVER 변동성 확대 구간 진입
              </li>
              <li>
                <span className="badge danger">리스크</span>
                현금 비중 12% 이하
              </li>
              <li>
                <span className="badge ok">정상</span>
                주문 지연 없음
              </li>
            </ul>
          </article>
        </aside>
      </section>
    </section>
  )
}

function SettingsDummy() {
  const syncSeq = useRef(0)

  const [accounts, setAccounts] = useState([])
  const [isAccountsLoading, setIsAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState('')

  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [confirmedAccountId, setConfirmedAccountId] = useState('')
  const [loadedAccountId, setLoadedAccountId] = useState('')
  const [activeStrategy, setActiveStrategy] = useState(null)
  const [conditionOptions, setConditionOptions] = useState([])
  const [lastSyncDebug, setLastSyncDebug] = useState('')
  const [syncStatus, setSyncStatus] = useState({ state: 'idle', message: '' })

  const [selectedSignalSec, setSelectedSignalSec] = useState(UNSELECTED_OPTION)
  const [savedSelectedSignalSec, setSavedSelectedSignalSec] = useState(UNSELECTED_OPTION)
  const [simpleBuyRule, setSimpleBuyRule] = useState(UNSELECTED_OPTION)
  const [savedSimpleBuyRule, setSavedSimpleBuyRule] = useState(UNSELECTED_OPTION)
  const [simpleSellRule, setSimpleSellRule] = useState(UNSELECTED_OPTION)
  const [savedSimpleSellRule, setSavedSimpleSellRule] = useState(UNSELECTED_OPTION)
  const [budgetInput, setBudgetInput] = useState('300,000')
  const [maxHoldingsInput, setMaxHoldingsInput] = useState('50')
  const [saveMessage, setSaveMessage] = useState({ type: '', text: '' })
  const [takeProfitRuleOptions, setTakeProfitRuleOptions] = useState([])
  const [stopLossRuleOptions, setStopLossRuleOptions] = useState([])
  const [isSaving, setIsSaving] = useState(false)

  const bodyBlocked = syncStatus.state === 'syncing' || syncStatus.state === 'error'
  const hasActiveStrategy = Boolean(activeStrategy && loadedAccountId === selectedAccountId)
  const budgetAmount = parseCommaInt(budgetInput)
  const maxHoldings = parseCommaInt(maxHoldingsInput)
  const signalMap = useMemo(
    () => Object.fromEntries(conditionOptions.map((item) => [item.sec, item.name || ''])),
    [conditionOptions],
  )
  const hasUnsavedSelectionChanges =
    selectedSignalSec !== savedSelectedSignalSec ||
    simpleBuyRule !== savedSimpleBuyRule ||
    simpleSellRule !== savedSimpleSellRule

  async function syncAccountState(accountId) {
    const sequence = ++syncSeq.current
    setSyncStatus({ state: 'syncing', message: `계좌 ${accountId} 동기화 중...` })
    setSaveMessage({ type: '', text: '' })
    setLastSyncDebug('')
    setActiveStrategy(null)
    setLoadedAccountId('')
    setConditionOptions([])
    setSelectedSignalSec(UNSELECTED_OPTION)
    setSavedSelectedSignalSec(UNSELECTED_OPTION)
    setSimpleBuyRule(UNSELECTED_OPTION)
    setSavedSimpleBuyRule(UNSELECTED_OPTION)
    setTakeProfitRuleOptions([])
    setStopLossRuleOptions([])
    setSimpleSellRule(UNSELECTED_OPTION)
    setSavedSimpleSellRule(UNSELECTED_OPTION)

    try {
      await requestJson('POST', '/auth/active', { params: { account_id: accountId } })

      const conditionResponse = await requestJson('POST', '/stk/condition/list', {
        body: { trnm: 'CNSRLST' },
      })
      const options = Array.isArray(conditionResponse?.data)
        ? conditionResponse.data
            .filter((item) => item && String(item.sec || '').trim())
            .map((item) => ({
              sec: String(item.sec).trim(),
              name: String(item.name || '').trim(),
            }))
        : []

      let slOptionsFlat = []
      let tpOptionsFlat = []
      try {
        const rulesListRaw = await requestJson('GET', '/rules')
        const arr = Array.isArray(rulesListRaw) ? rulesListRaw : []
        slOptionsFlat = flattenDeclarativeRuleOptionsFromRulesList(arr, 'STOP_LOSS')
        tpOptionsFlat = flattenDeclarativeRuleOptionsFromRulesList(arr, 'TAKE_PROFIT')
      } catch {
        slOptionsFlat = []
        tpOptionsFlat = []
      }

      if (sequence !== syncSeq.current) {
        return false
      }
      // 조건식 목록은 활성 전략 조회 결과와 무관하게 먼저 반영한다.
      setConditionOptions(options)
      setStopLossRuleOptions(slOptionsFlat)
      setTakeProfitRuleOptions(tpOptionsFlat)

      let strategy = null
      try {
        strategy = await requestJson('GET', '/strategies/active', {
          params: { account_id: accountId },
        })
      } catch (error) {
        if (!isMissingActiveStrategyError(error)) {
          throw error
        }
        setLastSyncDebug(error.message)
      }

      if (sequence !== syncSeq.current) {
        return false
      }

      setConfirmedAccountId(accountId)
      setSelectedAccountId(accountId)

      if (strategy && typeof strategy === 'object') {
        const loadedSignalSec = String(strategy?.entry_filter?.signal_sec || '').trim() || UNSELECTED_OPTION
        const resolvedSellRule = resolveDeclarativeRuleSelectValueFromStrategy(
          strategy.rules,
          slOptionsFlat,
          'STOP_LOSS',
        )
        const resolvedBuyRule = resolveDeclarativeRuleSelectValueFromStrategy(
          strategy.rules,
          tpOptionsFlat,
          'TAKE_PROFIT',
        )
        setActiveStrategy(strategy)
        setLoadedAccountId(accountId)
        setSelectedSignalSec(loadedSignalSec)
        setSavedSelectedSignalSec(loadedSignalSec)
        setSimpleBuyRule(resolvedBuyRule)
        setSavedSimpleBuyRule(resolvedBuyRule)
        setSimpleSellRule(resolvedSellRule)
        setSavedSimpleSellRule(resolvedSellRule)
        setBudgetInput(toComma(strategy.budget_amount ?? 300000))
        setMaxHoldingsInput(toComma(strategy.max_holdings ?? 50))
        setSyncStatus({ state: 'success', message: `계좌 ${accountId} 전략 로드 완료` })
      } else {
        setBudgetInput('300,000')
        setMaxHoldingsInput('50')
        setSyncStatus({ state: 'success', message: `계좌 ${accountId}는 활성 전략이 없습니다.` })
      }

      return true
    } catch (error) {
      if (sequence !== syncSeq.current) {
        return false
      }
      const message = error instanceof Error ? error.message : String(error)
      setSyncStatus({ state: 'error', message: '계좌 동기화에 실패했습니다.' })
      setLastSyncDebug(message)
      return false
    }
  }

  async function loadAccounts() {
    setIsAccountsLoading(true)
    setAccountsError('')
    try {
      const rows = await requestJson('GET', '/strategies/accounts', {
        params: { trading_type: 'PAPER', use_yn: 'Y' },
      })
      const normalized = Array.isArray(rows)
        ? rows
            .filter((item) => item && String(item.account_id || '').trim())
            .map((item) => ({
              account_id: String(item.account_id).trim(),
              account_nm: String(item.account_nm || '').trim(),
            }))
        : []
      setAccounts(normalized)
      if (normalized.length > 0) {
        const first = normalized[0].account_id
        setSelectedAccountId(first)
        await syncAccountState(first)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setAccountsError(message)
      setAccounts([])
    } finally {
      setIsAccountsLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function onAccountChange(nextAccountId) {
    if (!nextAccountId || nextAccountId === selectedAccountId) {
      return
    }
    if (nextAccountId === confirmedAccountId) {
      setSelectedAccountId(nextAccountId)
      return
    }

    if (hasUnsavedSelectionChanges) {
      const shouldMove = window.confirm('변경한 항목이 있습니다. 이동하면 초기화 됩니다.')
      if (!shouldMove) {
        setSelectedAccountId(confirmedAccountId)
        return
      }
    }

    setSelectedAccountId(nextAccountId)
    await syncAccountState(nextAccountId)
  }

  async function onSave() {
    setSaveMessage({ type: '', text: '' })
    if (bodyBlocked) {
      return
    }
    try {
      setIsSaving(true)
      if (selectedSignalSec === UNSELECTED_OPTION) {
        throw new Error('진입 조건을 선택하세요.')
      }
      if (simpleSellRule === UNSELECTED_OPTION) {
        throw new Error(
          '손절 규칙을 선택하세요. (DB 템플릿 중 하나를 고르거나 「없음」을 선택하세요.)',
        )
      }
      if (simpleBuyRule === UNSELECTED_OPTION) {
        throw new Error(
          '익절 규칙을 선택하세요. (DB 템플릿 중 하나를 고르거나 「없음」을 선택하세요.)',
        )
      }
      const rules = assembleStrategyEmbeddedRulesFromSelectors(
        simpleSellRule,
        simpleBuyRule,
        stopLossRuleOptions,
        takeProfitRuleOptions,
      )
      const slRows = rules.filter((r) => String(r?.type || '').toUpperCase() === 'STOP_LOSS')
      const tpRows = rules.filter((r) => String(r?.type || '').toUpperCase() === 'TAKE_PROFIT')

      const expectSl =
        simpleSellRule === NO_RULE ? 0 : (stopLossRuleOptions.some((o) => o.value === simpleSellRule) ? 1 : -1)
      const expectTp =
        simpleBuyRule === NO_RULE
          ? 0
          : takeProfitRuleOptions.some((o) => o.value === simpleBuyRule)
            ? 1
            : -1

      if (expectSl < 0 || expectTp < 0) {
        throw new Error('규칙 템플릿을 찾을 수 없습니다. 계좌를 다시 동기화한 뒤 선택하세요.')
      }
      if (expectSl !== slRows.length || expectTp !== tpRows.length) {
        throw new Error('선택한 손절·익절 규칙을 확인하세요.')
      }
      if (budgetAmount === null || budgetAmount < 10000 || budgetAmount > 10000000) {
        throw new Error('1회 매수금액을 올바르게 입력하세요. (10,000~10,000,000)')
      }
      if (maxHoldings === null || maxHoldings < 1 || maxHoldings > 2000) {
        throw new Error('최대 보유 종목 수를 올바르게 입력하세요. (1~2000)')
      }

      const payload = {
        budget_amount: budgetAmount,
        max_holdings: maxHoldings,
        entry_filter: {
          signal_sec: selectedSignalSec,
          signal_name: signalMap[selectedSignalSec] || '',
        },
        rules,
      }

      let updated
      if (hasActiveStrategy && activeStrategy?.strategy_id) {
        updated = await requestJson('PATCH', `/strategies/${activeStrategy.strategy_id}`, {
          params: { account_id: selectedAccountId },
          body: payload,
        })
      } else {
        const created = await requestJson('POST', '/strategies', {
          body: {
            account_id: selectedAccountId,
            name: `${selectedAccountId}-default`,
            enabled: true,
            priority: 10,
            budget_amount: budgetAmount,
            max_holdings: maxHoldings,
            min_qty_if_over_budget: 1,
            entry_filter: payload.entry_filter,
            rules: payload.rules,
            version: 1,
          },
        })
        const strategyId = String(created?.strategy_id || '').trim()
        if (!strategyId) {
          throw new Error('생성된 strategy_id가 비어 있습니다.')
        }
        await requestJson('POST', `/strategies/${strategyId}/activate`, {
          params: { account_id: selectedAccountId },
        })
        updated = await requestJson('GET', '/strategies/active', {
          params: { account_id: selectedAccountId },
        })
      }

      setActiveStrategy(updated)
      setLoadedAccountId(selectedAccountId)
      setSavedSelectedSignalSec(selectedSignalSec)
      setSavedSimpleBuyRule(simpleBuyRule)
      setSavedSimpleSellRule(simpleSellRule)
      setSimpleBuyRule(simpleBuyRule)
      setSimpleSellRule(simpleSellRule)
      setBudgetInput(toComma(updated?.budget_amount ?? budgetAmount))
      setMaxHoldingsInput(toComma(updated?.max_holdings ?? maxHoldings))
      setSyncStatus({
        state: 'success',
        message: `계좌 ${selectedAccountId} 전략 로드 완료`,
      })
      setSaveMessage({ type: 'success', text: '설정을 저장했습니다.' })
    } catch (error) {
      setSaveMessage({
        type: 'error',
        text: error instanceof Error ? error.message : String(error),
      })
    } finally {
      setIsSaving(false)
    }
  }

  const requiredMissingFields = []
  if (selectedSignalSec === UNSELECTED_OPTION) requiredMissingFields.push('진입 조건')
  if (simpleSellRule === UNSELECTED_OPTION) requiredMissingFields.push('손절 규칙')
  if (simpleBuyRule === UNSELECTED_OPTION) requiredMissingFields.push('익절 규칙')
  if (budgetAmount === null || budgetAmount < 10000 || budgetAmount > 10000000) {
    requiredMissingFields.push('1회 매수금액')
  }
  if (maxHoldings === null || maxHoldings < 1 || maxHoldings > 2000) {
    requiredMissingFields.push('최대 보유 종목 수')
  }

  const syncStatusLineClass =
    syncStatus.state === 'error' ||
    (syncStatus.state === 'success' && String(syncStatus.message || '').includes('활성 전략이 없습니다'))
      ? 'sync-status-alert'
      : 'subtle'

  return (
    <section className="dashboard">
      <section className="card">
        <div className="section-header">
          <div>
            <p className="caption">조건 설정</p>
            <h2>계좌 조건 설정</h2>
          </div>
          {hasUnsavedSelectionChanges ? (
            <span className="badge warn">미저장 변경 있음</span>
          ) : (
            <span className="badge ok">동기화 상태 유지</span>
          )}
        </div>

        <div className="account-sync-row">
          <div className="form-field">
            <label htmlFor="account">계좌 선택</label>
            <select
              id="account"
              value={selectedAccountId}
              onChange={(event) => onAccountChange(event.target.value)}
              disabled={isAccountsLoading}
            >
              {accounts.length === 0 ? (
                <option value="">계좌 없음</option>
              ) : (
                accounts.map((item) => (
                  <option key={item.account_id} value={item.account_id}>
                    {item.account_id}
                    {item.account_nm ? ` · ${item.account_nm}` : ''}
                  </option>
                ))
              )}
            </select>
          </div>

          <div className="account-sync-actions">
            <button
              type="button"
              className="btn btn-secondary sync-btn"
              onClick={loadAccounts}
              disabled={isAccountsLoading}
            >
              계좌 목록 동기화
            </button>
            <button
              type="button"
              className="btn btn-secondary sync-btn sync-btn-refresh"
              onClick={() => syncAccountState(selectedAccountId)}
              disabled={!selectedAccountId}
            >
              현재 계좌 다시 동기화
            </button>
          </div>
        </div>

        {accountsError ? <p className="error-text">계좌 목록 로드 실패: {accountsError}</p> : null}
        <p className={syncStatusLineClass}>동기화 상태: {syncStatus.message || '대기 중'}</p>
        {lastSyncDebug ? <p className="debug-box">{lastSyncDebug}</p> : null}
        {hasActiveStrategy ? (
          <p className="subtle">
            로드 계좌: {loadedAccountId} / 전략 ID: {activeStrategy?.strategy_id}
          </p>
        ) : null}
      </section>

      <section className="main-grid">
        <article className="card left-column">
          <h2>진입 조건 / 자금 설정</h2>
          <div className="settings-grid">
            <div className="form-field">
              <label htmlFor="signal">진입 조건식</label>
              <select
                id="signal"
                value={selectedSignalSec}
                onChange={(event) => setSelectedSignalSec(event.target.value)}
                disabled={bodyBlocked}
              >
                <option value={UNSELECTED_OPTION}>선택하세요</option>
                {conditionOptions.map((item) => (
                  <option key={item.sec} value={item.sec}>
                    {item.sec} | {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="budget">1회 매수금액 (원)</label>
              <input
                id="budget"
                value={budgetInput}
                onChange={(event) => setBudgetInput(event.target.value)}
                disabled={bodyBlocked}
              />
            </div>
            <div className="form-field">
              <label htmlFor="max-holdings">최대 보유 종목 수</label>
              <input
                id="max-holdings"
                value={maxHoldingsInput}
                onChange={(event) => setMaxHoldingsInput(event.target.value)}
                disabled={bodyBlocked}
              />
            </div>
          </div>
          <p className="subtle">검증 범위: 매수금액 10,000~10,000,000원 / 보유수 1~2000</p>

          <h2>단순 익절 / 손절 규칙</h2>
          <div className="settings-grid">
            <div className="form-field">
              <label htmlFor="buy-rule">익절 규칙</label>
              <select
                id="buy-rule"
                value={simpleBuyRule}
                onChange={(event) => setSimpleBuyRule(event.target.value)}
                disabled={bodyBlocked}
              >
                <option value={UNSELECTED_OPTION}>선택하세요</option>
                <option value={NO_RULE}>없음</option>
                {takeProfitRuleOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-field">
              <label htmlFor="sell-rule">손절 규칙</label>
              <select
                id="sell-rule"
                value={simpleSellRule}
                onChange={(event) => setSimpleSellRule(event.target.value)}
                disabled={bodyBlocked}
              >
                <option value={UNSELECTED_OPTION}>선택하세요</option>
                <option value={NO_RULE}>없음</option>
                {stopLossRuleOptions.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </article>

        <article className="card right-column">
          <h2>저장 상태</h2>
          <ul className="alert-list">
            <li>활성 전략 있음: PATCH 저장</li>
            <li>활성 전략 없음: 생성 → 활성화 → 재조회</li>
            <li>필수값 누락/동기화 에러 시 저장 비활성</li>
          </ul>
          {requiredMissingFields.length > 0 ? (
            <p className="error-text">필수 입력 누락: {requiredMissingFields.join(', ')}</p>
          ) : null}
          {saveMessage.text ? (
            <p className={saveMessage.type === 'error' ? 'error-text' : 'success-text'}>{saveMessage.text}</p>
          ) : null}
          <div className="topbar-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => syncAccountState(selectedAccountId)}
              disabled={!selectedAccountId || bodyBlocked}
            >
              값 다시 불러오기
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={onSave}
              disabled={bodyBlocked || requiredMissingFields.length > 0 || isSaving || !selectedAccountId}
            >
              {isSaving ? '저장 중...' : '전략 저장'}
            </button>
          </div>
        </article>
      </section>
    </section>
  )
}

function AccountEvaluationBalanceView() {
  const [accounts, setAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [qryTp, setQryTp] = useState('1')
  const [dmstStexTp, setDmstStexTp] = useState('KRX')

  const [summary, setSummary] = useState(null)
  const [rows, setRows] = useState([])
  const [isAccountsLoading, setIsAccountsLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [accountsError, setAccountsError] = useState('')
  const [paging, setPaging] = useState({
    hasMore: false,
    nextKey: '',
  })
  /** null: API 순서, 그 외: 평가손익(evltv_prft) 또는 수익률(prft_rt) 단일 컬럼 정렬 */
  const [evalBalanceSort, setEvalBalanceSort] = useState(null)

  async function loadAccountsAndInitialize() {
    setIsAccountsLoading(true)
    setAccountsError('')
    try {
      const response = await requestJson('GET', '/strategies/accounts', {
        params: { trading_type: 'PAPER', use_yn: 'Y' },
      })
      const normalized = Array.isArray(response)
        ? response
            .filter((item) => item && String(item.account_id || '').trim())
            .map((item) => ({
              account_id: String(item.account_id).trim(),
              account_nm: String(item.account_nm || '').trim(),
            }))
        : []
      setAccounts(normalized)
      if (normalized.length > 0) {
        const firstAccountId = normalized[0].account_id
        setSelectedAccountId(firstAccountId)
      }
    } catch (loadError) {
      setAccountsError(loadError instanceof Error ? loadError.message : String(loadError))
      setAccounts([])
    } finally {
      setIsAccountsLoading(false)
    }
  }

  async function fetchEvaluationBalance(
    accountId,
    nextQryTp,
    nextDmstStexTp,
    options = {
      append: false,
      contYn: 'N',
      nextKey: '',
    },
  ) {
    if (!accountId) {
      return
    }
    const { append, contYn, nextKey } = options
    if (append) {
      setIsLoadingMore(true)
    } else {
      setIsLoading(true)
      setPaging({ hasMore: false, nextKey: '' })
    }
    setError('')
    try {
      await requestJson('POST', '/auth/active', { params: { account_id: accountId } })
      const response = await requestJson('POST', '/stk/acnt/evaluation-balance', {
        params: {
          cont_yn: contYn,
          next_key: nextKey,
        },
        body: {
          qry_tp: nextQryTp,
          dmst_stex_tp: nextDmstStexTp,
        },
      })
      const list = Array.isArray(response?.acnt_evlt_remn_indv_tot) ? response.acnt_evlt_remn_indv_tot : []
      const pagingMeta = response?._paging || {}
      const contYnValue = String(pagingMeta?.cont_yn || 'N').toUpperCase()
      const nextKeyValue = String(pagingMeta?.next_key || '')

      if (!append) {
        setEvalBalanceSort(null)
        setSummary({
          totPurAmt: response?.tot_pur_amt ?? null,
          totEvltAmt: response?.tot_evlt_amt ?? null,
          totEvltPl: response?.tot_evlt_pl ?? null,
          totPrftRt: response?.tot_prft_rt ?? null,
        })
      }

      if (append) {
        setRows((prev) => [...prev, ...list])
      } else {
        setRows(list)
      }

      setPaging({
        hasMore: contYnValue === 'Y' && nextKeyValue.length > 0,
        nextKey: nextKeyValue,
      })
    } catch (fetchError) {
      if (!append) {
        setSummary(null)
        setRows([])
      }
      setError(fetchError instanceof Error ? fetchError.message : String(fetchError))
    } finally {
      if (append) {
        setIsLoadingMore(false)
      } else {
        setIsLoading(false)
      }
    }
  }

  async function onLoadMore() {
    if (!paging.hasMore || !paging.nextKey || !selectedAccountId || isLoadingMore) {
      return
    }
    await fetchEvaluationBalance(selectedAccountId, qryTp, dmstStexTp, {
      append: true,
      contYn: 'Y',
      nextKey: paging.nextKey,
    })
  }

  useEffect(() => {
    loadAccountsAndInitialize()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!selectedAccountId) {
      return
    }
    void fetchEvaluationBalance(selectedAccountId, qryTp, dmstStexTp)
    // 계좌 변경 시 현재 조회구분·거래소로 자동 조회 (초기 계좌 설정 시에도 동일)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccountId])

  const summaryCardsData = [
    { label: '총매입금액', value: summary?.totPurAmt, valueType: 'amount' },
    { label: '총평가금액', value: summary?.totEvltAmt, valueType: 'amount' },
    { label: '총평가손익', value: summary?.totEvltPl, valueType: 'amount', tone: getToneByNumericString(summary?.totEvltPl) },
    { label: '총수익률', value: summary?.totPrftRt, valueType: 'percent', tone: getToneByNumericString(summary?.totPrftRt) },
  ]

  const sortedRows = useMemo(() => {
    if (!evalBalanceSort) {
      return rows
    }
    const { field, dir } = evalBalanceSort
    return [...rows].sort((a, b) => {
      const va = parseNumericString(a?.[field])
      const vb = parseNumericString(b?.[field])
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return dir === 'asc' ? va - vb : vb - va
    })
  }, [rows, evalBalanceSort])

  function cycleEvalBalanceSort(field) {
    setEvalBalanceSort((prev) => {
      if (!prev || prev.field !== field) {
        return { field, dir: 'desc' }
      }
      if (prev.dir === 'desc') {
        return { field, dir: 'asc' }
      }
      return null
    })
  }

  const sortMetaPnl = evalBalanceSortControlMeta('evltv_prft', evalBalanceSort)
  const sortMetaPrft = evalBalanceSortControlMeta('prft_rt', evalBalanceSort)

  return (
    <section className="dashboard">
      <section className="card">
        {/* <div className="section-header">
          <div>
            <p className="caption">계좌평가 잔고내역</p>
            <h2>계좌/조회조건별 평가잔고 조회</h2>
          </div>
        </div> */}

        <div className="evaluation-control-grid">
          <div className="form-field">
            <label htmlFor="eval-account">계좌</label>
            <select
              id="eval-account"
              value={selectedAccountId}
              onChange={(event) => setSelectedAccountId(event.target.value)}
              disabled={isAccountsLoading}
            >
              {accounts.length === 0 ? (
                <option value="">계좌 없음</option>
              ) : (
                accounts.map((item) => (
                  <option key={item.account_id} value={item.account_id}>
                    {item.account_id}
                    {item.account_nm ? ` · ${item.account_nm}` : ''}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="eval-qry-tp">조회구분</label>
            <select id="eval-qry-tp" value={qryTp} onChange={(event) => setQryTp(event.target.value)}>
              <option value="1">합산</option>
              <option value="2">개별</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="eval-stex-tp">거래소</label>
            <select id="eval-stex-tp" value={dmstStexTp} onChange={(event) => setDmstStexTp(event.target.value)}>
              <option value="KRX">KRX</option>
              <option value="NXT">NXT</option>
            </select>
          </div>
          <div className="evaluation-control-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={loadAccountsAndInitialize}
              disabled={isAccountsLoading}
            >
              계좌 새로고침
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                fetchEvaluationBalance(selectedAccountId, qryTp, dmstStexTp, {
                  append: false,
                  contYn: 'N',
                  nextKey: '',
                })
              }
              disabled={!selectedAccountId || isLoading}
            >
              {isLoading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>

        {accountsError ? <p className="error-text">계좌 목록 로드 실패: {accountsError}</p> : null}
        {error ? <p className="debug-box">{error}</p> : null}
      </section>

      <section className="summary-grid" aria-label="계좌 평가 요약">
        {summaryCardsData.map((item) => (
          <article key={item.label} className="card summary-card">
            <p className="caption">{item.label}</p>
            <p className={`summary-value ${item.tone ? `delta ${item.tone}` : ''}`}>
              {item.valueType === 'percent' ? formatApiPercent(item.value) : formatApiAmount(item.value)}
            </p>
          </article>
        ))}
      </section>

      <section className="card">
        <div className="section-header evaluation-list-section-header">
          <h2>종목별 평가잔고 목록</h2>
          <span className="caption">총 {rows.length}건</span>
        </div>
        {isLoading ? <p className="subtle">데이터를 조회하는 중입니다...</p> : null}
        {!isLoading && rows.length === 0 ? (
          <p className="subtle">조회된 평가잔고 데이터가 없습니다.</p>
        ) : null}
        {!isLoading && rows.length > 0 ? (
          <>
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
                      evalBalanceSort?.field === 'evltv_prft'
                        ? evalBalanceSort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => cycleEvalBalanceSort('evltv_prft')}
                      title="클릭: 높은순 → 낮은순 → 원래 순서"
                    >
                      평가손익
                      <span className="th-sort-icons" aria-hidden="true">
                        {evalBalanceSort?.field === 'evltv_prft'
                          ? evalBalanceSort.dir === 'desc'
                            ? ' ▼'
                            : ' ▲'
                          : ''}
                      </span>
                    </button>
                  </th>
                  <th
                    className="num th-sortable"
                    aria-sort={
                      evalBalanceSort?.field === 'prft_rt'
                        ? evalBalanceSort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => cycleEvalBalanceSort('prft_rt')}
                      title="클릭: 높은순 → 낮은순 → 원래 순서"
                    >
                      수익률
                      <span className="th-sort-icons" aria-hidden="true">
                        {evalBalanceSort?.field === 'prft_rt'
                          ? evalBalanceSort.dir === 'desc'
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
                {sortedRows.map((item, index) => {
                  const d = getEvaluationBalanceRowDisplay(item)
                  return (
                    <tr key={`${item?.stk_cd || 'stk'}-${index}`}>
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
                  onClick={() => cycleEvalBalanceSort('evltv_prft')}
                  aria-pressed={sortMetaPnl.ariaPressed}
                  aria-label={sortMetaPnl.ariaLabel}
                >
                  {sortMetaPnl.name}
                  <span aria-hidden="true">{sortMetaPnl.icon}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => cycleEvalBalanceSort('prft_rt')}
                  aria-pressed={sortMetaPrft.ariaPressed}
                  aria-label={sortMetaPrft.ariaLabel}
                >
                  {sortMetaPrft.name}
                  <span aria-hidden="true">{sortMetaPrft.icon}</span>
                </button>
              </div>
              <ul className="evaluation-balance-list-mobile">
                {sortedRows.map((item, index) => (
                  <EvaluationBalanceMobileCard
                    key={`${item?.stk_cd || 'stk'}-m-${index}`}
                    item={item}
                  />
                ))}
              </ul>
            </div>
            {paging.hasMore ? (
              <div className="evaluation-pagination">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={onLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? '불러오는 중...' : '더보기'}
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
    </section>
  )
}

export default App
