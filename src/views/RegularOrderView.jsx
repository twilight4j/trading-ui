import { useEffect, useRef, useState } from 'react'
import { requestJson } from '../lib/api.js'
import { fetchAccountEvaluationSummary } from '../lib/fetchAccountEvaluationSummary.js'
import { formatApiAmount, formatApiPercent, getToneByNumericString } from '../lib/formatApi.js'
import {
  delay,
  kiwoomRequestJson,
  SUMMARY_BETWEEN_ACCOUNTS_DELAY_MS,
  SUMMARY_FIRST_ACCOUNT_WARMUP_DELAY_MS,
} from '../lib/kiwoomRateLimit.js'
import { normalizeRegisteredAccountRow } from '../lib/registeredAccounts.js'

/** 일괄매도 고정 매매구분: 시장가 (키움 trde_tp=3) */
const BULK_SELL_TRDE_TP = '3'

function formatAccountTitle(account) {
  const id = String(account?.account_id || '').trim()
  const nm = String(account?.account_nm || '').trim()
  if (id && nm) {
    return `${id} · ${nm}`
  }
  return id || nm || '—'
}

function displayStockCode(raw) {
  return String(raw || '').replace(/^A/, '')
}

function AccountCardStats({ summaryState }) {
  if (summaryState?.status === 'loading') {
    return <p className="regular-order-card-stats-loading">보유 현황 불러오는 중…</p>
  }
  if (summaryState?.status === 'error') {
    return (
      <p className="regular-order-card-stats-error" role="alert">
        {summaryState.error}
      </p>
    )
  }
  if (summaryState?.status !== 'ready') {
    return null
  }

  const { data } = summaryState
  const plTone = getToneByNumericString(data.totEvltPl)
  const rtTone = getToneByNumericString(data.totPrftRt)

  return (
    <dl className="regular-order-card-stats">
      <div className="regular-order-card-stat-row">
        <dt>보유 종목</dt>
        <dd>
          {data.holdingCount}종
          {data.truncated ? <span className="regular-order-card-stat-hint"> (일부만 조회)</span> : null}
        </dd>
      </div>
      <div className="regular-order-card-stat-row">
        <dt>총 평가금액</dt>
        <dd className="num">{formatApiAmount(data.totEvltAmt)}</dd>
      </div>
      <div className="regular-order-card-stat-row">
        <dt>총 평가손익</dt>
        <dd className={`num ${plTone ? `delta ${plTone}` : ''}`}>{formatApiAmount(data.totEvltPl)}</dd>
      </div>
      <div className="regular-order-card-stat-row">
        <dt>수익률</dt>
        <dd className={`num ${rtTone ? `delta ${rtTone}` : ''}`}>{formatApiPercent(data.totPrftRt)}</dd>
      </div>
    </dl>
  )
}

function BulkSellResultPanel({ result }) {
  if (!result) {
    return null
  }
  const cancelTotal = result.cancel_total ?? 0
  const cancelFailed = result.cancel_failed ?? 0
  const cancelFailedItems = Array.isArray(result.cancel_results)
    ? result.cancel_results.filter((row) => !row.success)
    : []
  const failedItems = Array.isArray(result.results)
    ? result.results.filter((row) => !row.success)
    : []

  return (
    <div className="regular-order-result-panel">
      {cancelTotal > 0 ? (
        <p className="regular-order-result-summary">
          미체결 취소 <strong>{cancelTotal}</strong>건 · 성공{' '}
          <strong className="up">{result.cancel_succeeded ?? 0}</strong>
          · 실패 <strong className={cancelFailed > 0 ? 'down' : ''}>{cancelFailed}</strong>
        </p>
      ) : null}
      <p className="regular-order-result-summary">
        매도 처리 <strong>{result.total}</strong>건 · 성공 <strong className="up">{result.succeeded}</strong>
        · 실패 <strong className={result.failed > 0 ? 'down' : ''}>{result.failed}</strong>
      </p>
      {cancelFailedItems.length > 0 ? (
        <details className="regular-order-result-failures" open={cancelFailedItems.length <= 8}>
          <summary>취소 실패 {cancelFailedItems.length}건</summary>
          <ul className="regular-order-result-failures-list">
            {cancelFailedItems.map((row) => (
              <li key={`${row.orig_ord_no}-${row.stk_cd}`}>
                <span className="regular-order-result-stock">
                  {row.stk_nm || displayStockCode(row.stk_cd)} ({displayStockCode(row.stk_cd)}) ·{' '}
                  {row.orig_ord_no}
                </span>
                <span className="regular-order-result-msg">
                  {row.error || row.return_msg || '취소 실패'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {failedItems.length > 0 ? (
        <details className="regular-order-result-failures" open={failedItems.length <= 8}>
          <summary>실패 종목 {failedItems.length}건</summary>
          <ul className="regular-order-result-failures-list">
            {failedItems.map((row) => (
              <li key={row.stk_cd}>
                <span className="regular-order-result-stock">
                  {row.stk_nm || displayStockCode(row.stk_cd)} ({displayStockCode(row.stk_cd)})
                </span>
                <span className="regular-order-result-msg">
                  {row.error || row.return_msg || '주문 실패'}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  )
}

export default function RegularOrderView() {
  const [accounts, setAccounts] = useState([])
  const [isAccountsLoading, setIsAccountsLoading] = useState(false)
  const [accountsError, setAccountsError] = useState('')
  const [summariesByAccountId, setSummariesByAccountId] = useState({})
  const [isSummariesLoading, setIsSummariesLoading] = useState(false)

  const [modalAccount, setModalAccount] = useState(null)
  const [modalPhase, setModalPhase] = useState('confirm')
  const [bulkSellResult, setBulkSellResult] = useState(null)
  const [bulkSellError, setBulkSellError] = useState('')
  const summariesLoadGenRef = useRef(0)

  async function loadAccountSummaries(accountList) {
    const gen = summariesLoadGenRef.current + 1
    summariesLoadGenRef.current = gen

    if (!accountList.length) {
      setSummariesByAccountId({})
      setIsSummariesLoading(false)
      return
    }

    setIsSummariesLoading(true)
    const initial = Object.fromEntries(
      accountList.map((a) => [a.account_id, { status: 'loading' }]),
    )
    setSummariesByAccountId(initial)

    await delay(SUMMARY_FIRST_ACCOUNT_WARMUP_DELAY_MS)
    if (summariesLoadGenRef.current !== gen) {
      return
    }

    for (let i = 0; i < accountList.length; i++) {
      if (summariesLoadGenRef.current !== gen) {
        return
      }
      const { account_id: accountId } = accountList[i]
      try {
        const data = await fetchAccountEvaluationSummary(accountId)
        if (summariesLoadGenRef.current !== gen) {
          return
        }
        setSummariesByAccountId((prev) => ({
          ...prev,
          [accountId]: { status: 'ready', data },
        }))
      } catch (fetchError) {
        if (summariesLoadGenRef.current !== gen) {
          return
        }
        setSummariesByAccountId((prev) => ({
          ...prev,
          [accountId]: {
            status: 'error',
            error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          },
        }))
      }
      if (i < accountList.length - 1) {
        await delay(SUMMARY_BETWEEN_ACCOUNTS_DELAY_MS)
      }
    }

    if (summariesLoadGenRef.current === gen) {
      setIsSummariesLoading(false)
    }
  }

  async function loadAccounts() {
    setIsAccountsLoading(true)
    setAccountsError('')
    summariesLoadGenRef.current += 1
    try {
      const response = await requestJson('GET', '/strategies/accounts', {
        params: { trading_type: 'PAPER', use_yn: 'Y' },
      })
      const normalized = Array.isArray(response)
        ? response.map((item) => normalizeRegisteredAccountRow(item)).filter(Boolean)
        : []
      setAccounts(normalized)
      setIsAccountsLoading(false)
      await loadAccountSummaries(normalized)
    } catch (loadError) {
      setAccountsError(loadError instanceof Error ? loadError.message : String(loadError))
      setAccounts([])
      setSummariesByAccountId({})
      setIsAccountsLoading(false)
      setIsSummariesLoading(false)
    }
  }

  useEffect(() => {
    loadAccounts()
  }, [])

  function getSummaryForAccount(accountId) {
    return summariesByAccountId[accountId] ?? null
  }

  function openBulkSellConfirm(account) {
    setModalAccount(account)
    setModalPhase('confirm')
    setBulkSellResult(null)
    setBulkSellError('')
  }

  function closeModal() {
    setModalAccount(null)
    setModalPhase('confirm')
    setBulkSellResult(null)
    setBulkSellError('')
  }

  async function executeBulkSell() {
    if (!modalAccount?.account_id) {
      return
    }
    setBulkSellError('')
    setBulkSellResult(null)
    setModalPhase('progress')

    try {
      const body = {
        account_id: modalAccount.account_id,
        trde_tp: BULK_SELL_TRDE_TP,
        ord_uv: '',
        cond_uv: '',
      }
      const response = await kiwoomRequestJson('POST', '/stk/ordr/bulk-sell', { body })
      setBulkSellResult(response)
      setModalPhase('done')
      if (response?.total > 0) {
        await loadAccountSummaries(accounts)
      }
    } catch (error) {
      setBulkSellError(error instanceof Error ? error.message : String(error))
      setModalPhase('confirm')
    }
  }

  const modalSummary =
    modalAccount?.account_id ? getSummaryForAccount(modalAccount.account_id) : null
  const modalHoldingCount =
    modalSummary?.status === 'ready' ? modalSummary.data.holdingCount : null

  return (
    <div className="dashboard regular-order-view">
      <section className="card regular-order-intro">
        <p className="regular-order-intro-text">
          등록된 모의투자 계좌별 보유 현황을 확인하고, 계좌 카드의 일괄매도로 보유 전 종목을
          시장가 매도 주문합니다.
        </p>
      </section>

      {isAccountsLoading ? (
        <p className="regular-order-status" role="status">
          계좌 목록 불러오는 중…
        </p>
      ) : null}

      {isSummariesLoading && !isAccountsLoading && accounts.length > 0 ? (
        <p className="regular-order-status" role="status">
          계좌별 보유 현황 불러오는 중…
        </p>
      ) : null}

      {accountsError ? (
        <div className="regular-order-status regular-order-status-error" role="alert">
          {accountsError}
        </div>
      ) : null}

      {!isAccountsLoading && !accountsError && accounts.length === 0 ? (
        <p className="regular-order-empty">등록된 계좌가 없습니다. (PAPER · use_yn=Y)</p>
      ) : null}

      {!isAccountsLoading && accounts.length > 0 ? (
        <ul className="regular-order-account-grid">
          {accounts.map((account) => {
            const summaryState = getSummaryForAccount(account.account_id)
            const holdingCount =
              summaryState?.status === 'ready' ? summaryState.data.holdingCount : null

            return (
              <li key={account.account_id} className="regular-order-account-card card">
                <h2 className="regular-order-account-title">{formatAccountTitle(account)}</h2>
                <AccountCardStats summaryState={summaryState} />
                <button
                  type="button"
                  className="btn btn-danger regular-order-bulk-sell-btn"
                  disabled={summaryState?.status === 'loading' || holdingCount === 0}
                  onClick={() => openBulkSellConfirm(account)}
                >
                  일괄매도
                </button>
                {holdingCount === 0 ? (
                  <p className="regular-order-card-hint">보유 종목이 없어 일괄매도할 수 없습니다.</p>
                ) : null}
              </li>
            )
          })}
        </ul>
      ) : null}

      {modalAccount ? (
        <div
          className="regular-order-modal-overlay"
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && (modalPhase === 'confirm' || modalPhase === 'done')) {
              closeModal()
            }
          }}
        >
          <div
            className="regular-order-modal card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="regular-order-modal-title"
          >
            <div className="regular-order-modal-header">
              <div>
                <h2 id="regular-order-modal-title" className="regular-order-modal-title">
                  일괄매도
                </h2>
                <p className="regular-order-modal-account">{formatAccountTitle(modalAccount)}</p>
              </div>
              <button
                type="button"
                className="regular-order-modal-close"
                aria-label="닫기"
                onClick={closeModal}
              >
                ×
              </button>
            </div>

            <div className="regular-order-modal-body-scroll">
            {modalPhase === 'confirm' ? (
              <>
                <p className="regular-order-modal-body">
                  {modalHoldingCount !== null ? (
                    <>
                      보유 <strong>{modalHoldingCount}종목</strong> 전량을{' '}
                      <strong>시장가</strong>로 매도 주문합니다.
                    </>
                  ) : (
                    <>
                      보유 전 종목을 <strong>시장가</strong>로 매도 주문합니다.
                    </>
                  )}
                </p>
                {bulkSellError ? (
                  <p className="regular-order-form-error" role="alert">
                    {bulkSellError}
                  </p>
                ) : null}
              </>
            ) : null}

            {modalPhase === 'progress' ? (
              <div className="regular-order-progress" role="status" aria-live="polite">
                <div className="regular-order-spinner" aria-hidden="true" />
                <p className="regular-order-progress-label">
                  보유 종목 매도 주문 처리 중… (종목 수에 따라 수십 초 이상 걸릴 수 있습니다)
                </p>
              </div>
            ) : null}

            {modalPhase === 'done' ? (
              <div className="regular-order-progress" role="status" aria-live="polite">
                <p className="regular-order-progress-label">일괄매도 완료</p>
                <BulkSellResultPanel result={bulkSellResult} />
              </div>
            ) : null}
            </div>

            {modalPhase === 'confirm' ? (
              <div className="regular-order-modal-footer">
                <div className="regular-order-modal-actions">
                  <button type="button" className="btn btn-secondary" onClick={closeModal}>
                    취소
                  </button>
                  <button type="button" className="btn btn-danger" onClick={executeBulkSell}>
                    일괄매도 실행
                  </button>
                </div>
              </div>
            ) : null}

            {modalPhase === 'done' ? (
              <div className="regular-order-modal-footer">
                <div className="regular-order-modal-actions">
                  <button type="button" className="btn btn-primary" onClick={closeModal}>
                    닫기
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
