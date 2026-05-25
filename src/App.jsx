import { useEffect, useState } from 'react'
import './App.css'
import AccountEvaluationBalanceView from './views/AccountEvaluationBalanceView.jsx'
import AccountOrderHistoryView from './views/AccountOrderHistoryView.jsx'
import EvaluationSnapshotStatsView from './views/EvaluationSnapshotStatsView.jsx'
import SettingsView from './views/SettingsView.jsx'
import MarketDashboardView from './views/MarketDashboardView.jsx'
import QuarterlyNetIncomeAnalysisView from './views/QuarterlyNetIncomeAnalysisView.jsx'

const ACTIVE_VIEW_STORAGE_KEY = 'trading-ui-active-view'

const VALID_VIEWS = new Set([
  'settings',
  'evaluationBalance',
  'marketDashboard',
  'evaluationSnapshotStats',
  'orderHistory',
  'quarterlyNetIncomeAnalysis',
])

function readStoredActiveView() {
  try {
    const v = sessionStorage.getItem(ACTIVE_VIEW_STORAGE_KEY)
    if (v && VALID_VIEWS.has(v)) {
      return v
    }
  } catch {
    /* private mode 등 */
  }
  return 'evaluationBalance'
}

function App() {
  const initialView = readStoredActiveView()
  const [activeView, setActiveView] = useState(initialView)
  /** 한 번이라도 연 화면은 언마운트하지 않아 폼·스크롤 등 React 상태 유지 */
  const [mountedViews, setMountedViews] = useState(() => new Set([initialView]))

  useEffect(() => {
    try {
      sessionStorage.setItem(ACTIVE_VIEW_STORAGE_KEY, activeView)
    } catch {
      /* ignore */
    }
  }, [activeView])

  function goToView(view) {
    if (!VALID_VIEWS.has(view)) {
      return
    }
    setActiveView(view)
    setMountedViews((prev) => {
      const next = new Set(prev)
      next.add(view)
      return next
    })
  }

  const pageTitle = {
    settings: '계좌 조건 설정',
    evaluationBalance: '계좌평가 잔고내역',
    marketDashboard: '대시보드 - 준비중입니다',
    evaluationSnapshotStats: '수익률',
    orderHistory: '주문 이력',
    quarterlyNetIncomeAnalysis: '적정주가 분석',
  }[activeView]

  return (
    <main className="layout-shell">
      <aside className="sidebar card" aria-label="주요 메뉴">
        <p className="caption">Trading UI MVP</p>
        <div className="sidebar-nav-group">
          <h2 className="sidebar-nav-group-title">실시간</h2>
          <nav className="sidebar-nav" aria-label="실시간 화면">
            <button
              type="button"
              className={`nav-item ${activeView === 'evaluationBalance' ? 'active' : ''}`}
              onClick={() => goToView('evaluationBalance')}
            >
              계좌평가 잔고내역
            </button>
            <button
              type="button"
              className={`nav-item ${activeView === 'marketDashboard' ? 'active' : ''}`}
              onClick={() => goToView('marketDashboard')}
            >
              대시보드
            </button>
          </nav>
        </div>
        <div className="sidebar-nav-group">
          <h2 className="sidebar-nav-group-title">분석</h2>
          <nav className="sidebar-nav" aria-label="분석 화면">
            <button
              type="button"
              className={`nav-item ${activeView === 'quarterlyNetIncomeAnalysis' ? 'active' : ''}`}
              onClick={() => goToView('quarterlyNetIncomeAnalysis')}
            >
              적정주가 분석
            </button>
          </nav>
        </div>
        <div className="sidebar-nav-group">
          <h2 className="sidebar-nav-group-title">통계</h2>
          <nav className="sidebar-nav" aria-label="통계 화면">
            <button
              type="button"
              className={`nav-item ${activeView === 'evaluationSnapshotStats' ? 'active' : ''}`}
              onClick={() => goToView('evaluationSnapshotStats')}
            >
              수익률
            </button>
            <button
              type="button"
              className={`nav-item ${activeView === 'orderHistory' ? 'active' : ''}`}
              onClick={() => goToView('orderHistory')}
            >
              주문 이력
            </button>
          </nav>
        </div>
        <div className="sidebar-nav-group">
          <h2 className="sidebar-nav-group-title">관리</h2>
          <nav className="sidebar-nav" aria-label="설정">
            <button
              type="button"
              className={`nav-item ${activeView === 'settings' ? 'active' : ''}`}
              onClick={() => goToView('settings')}
            >
              계좌 조건 설정
            </button>
          </nav>
        </div>
      </aside>

      <section className="content-shell">
        <header className="topbar card">
          <div>
            <h1>{pageTitle}</h1>
          </div>
        </header>

        {mountedViews.has('settings') ? (
          <div hidden={activeView !== 'settings'}>
            <SettingsView />
          </div>
        ) : null}
        {mountedViews.has('marketDashboard') ? (
          <div hidden={activeView !== 'marketDashboard'}>
            <MarketDashboardView />
          </div>
        ) : null}
        {mountedViews.has('evaluationBalance') ? (
          <div hidden={activeView !== 'evaluationBalance'}>
            <AccountEvaluationBalanceView />
          </div>
        ) : null}
        {mountedViews.has('evaluationSnapshotStats') ? (
          <div hidden={activeView !== 'evaluationSnapshotStats'}>
            <EvaluationSnapshotStatsView />
          </div>
        ) : null}
        {mountedViews.has('orderHistory') ? (
          <div hidden={activeView !== 'orderHistory'}>
            <AccountOrderHistoryView />
          </div>
        ) : null}
        {mountedViews.has('quarterlyNetIncomeAnalysis') ? (
          <div hidden={activeView !== 'quarterlyNetIncomeAnalysis'}>
            <QuarterlyNetIncomeAnalysisView />
          </div>
        ) : null}
      </section>
    </main>
  )
}

export default App
