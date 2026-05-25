import { useEffect, useState } from 'react'
import { requestJson } from '../lib/api.js'
import { formatRegisteredAccountListLabel, normalizeRegisteredAccountRow } from '../lib/registeredAccounts.js'
import { isValidYyyymmdd } from '../lib/snapshotChart.js'

function formatCreatedAt(iso) {
  if (!iso) {
    return '—'
  }
  try {
    const d = new Date(String(iso))
    if (Number.isNaN(d.getTime())) {
      return String(iso)
    }
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(d)
  } catch {
    return String(iso)
  }
}

function sideLabel(side) {
  const s = String(side || '').toLowerCase()
  if (s === 'buy') return '매수'
  if (s === 'sell') return '매도'
  return s || '—'
}

function sourceLabel(source) {
  if (source === 'entry_graph') return '진입'
  if (source === 'position_graph') return '포지션'
  return String(source || '—')
}

function displayStockCode(raw) {
  return String(raw || '').replace(/^A/, '')
}

export default function AccountOrderHistoryView() {
  const [accounts, setAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [sideFilter, setSideFilter] = useState('')
  const [limit, setLimit] = useState('100')

  const [rows, setRows] = useState([])
  const [isAccountsLoading, setIsAccountsLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [accountsError, setAccountsError] = useState('')

  async function loadAccounts() {
    setIsAccountsLoading(true)
    setAccountsError('')
    try {
      const response = await requestJson('GET', '/strategies/accounts', {
        params: { trading_type: 'PAPER', use_yn: 'Y' },
      })
      const normalized = Array.isArray(response)
        ? response.map((item) => normalizeRegisteredAccountRow(item)).filter(Boolean)
        : []
      setAccounts(normalized)
      if (normalized.length > 0 && !selectedAccountId) {
        setSelectedAccountId(normalized[0].account_id)
      }
    } catch (loadError) {
      setAccountsError(loadError instanceof Error ? loadError.message : String(loadError))
      setAccounts([])
    } finally {
      setIsAccountsLoading(false)
    }
  }

  async function fetchHistory() {
    if (!selectedAccountId) {
      setError('계좌를 선택하세요.')
      return
    }
    const fromRaw = String(fromDate || '').trim()
    const toRaw = String(toDate || '').trim()
    if (fromRaw && !isValidYyyymmdd(fromRaw)) {
      setError('시작일은 YYYYMMDD 8자리로 입력하세요.')
      return
    }
    if (toRaw && !isValidYyyymmdd(toRaw)) {
      setError('종료일은 YYYYMMDD 8자리로 입력하세요.')
      return
    }
    if (fromRaw && toRaw && fromRaw > toRaw) {
      setError('시작일은 종료일보다 늦을 수 없습니다.')
      return
    }

    const params = { limit: Math.min(500, Math.max(1, parseInt(String(limit), 10) || 100)) }
    if (fromRaw) params.from_date = fromRaw
    if (toRaw) params.to_date = toRaw
    if (sideFilter === 'buy' || sideFilter === 'sell') params.side = sideFilter

    setIsLoading(true)
    setError('')
    try {
      const data = await requestJson(
        'GET',
        `/statistics/accounts/${encodeURIComponent(selectedAccountId)}/order-history`,
        { params },
      )
      const list = Array.isArray(data) ? data : []
      setRows(list.filter((row) => String(row?.plan_status ?? '').toLowerCase() !== 'failed'))
    } catch (fetchError) {
      setRows([])
      setError(fetchError instanceof Error ? fetchError.message : String(fetchError))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- 마운트 시 계좌 목록 로드 */
    loadAccounts()
    /* eslint-enable react-hooks/set-state-in-effect */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="dashboard">
      <section className="card">
        <div className="benchmark-head">
          <p className="caption">MongoDB · account_order_history</p>
          <h2>주문 이력</h2>
          <p className="subtle">
            자동매매 그래프에서 시도한 매수·매도 주문을 조회합니다.{' '}
            <code className="subtle">plan_status</code>가 <code>failed</code>인 건은 목록에서 제외합니다. 날짜는 UTC
            기준 일 단위 범위로 필터됩니다.
          </p>
        </div>

        <div className="evaluation-control-grid">
          <div className="form-field">
            <label htmlFor="oh-account">계좌</label>
            <select
              id="oh-account"
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              disabled={isAccountsLoading}
            >
              {accounts.length === 0 ? (
                <option value="">계좌 없음</option>
              ) : (
                accounts.map((item) => (
                  <option key={item.account_id} value={item.account_id}>
                    {formatRegisteredAccountListLabel(item)}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="oh-from">시작일 (선택)</label>
            <input
              id="oh-from"
              placeholder="YYYYMMDD"
              maxLength={8}
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value.trim())}
            />
          </div>
          <div className="form-field">
            <label htmlFor="oh-to">종료일 (선택)</label>
            <input
              id="oh-to"
              placeholder="YYYYMMDD"
              maxLength={8}
              value={toDate}
              onChange={(e) => setToDate(e.target.value.trim())}
            />
          </div>
          <div className="form-field">
            <label htmlFor="oh-side">구분</label>
            <select id="oh-side" value={sideFilter} onChange={(e) => setSideFilter(e.target.value)}>
              <option value="">전체</option>
              <option value="buy">매수</option>
              <option value="sell">매도</option>
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="oh-limit">최대 건수</label>
            <select id="oh-limit" value={limit} onChange={(e) => setLimit(e.target.value)}>
              <option value="50">50</option>
              <option value="100">100</option>
              <option value="200">200</option>
              <option value="500">500</option>
            </select>
          </div>
          <div className="evaluation-control-actions">
            <button type="button" className="btn btn-secondary" onClick={() => void loadAccounts()} disabled={isAccountsLoading}>
              계좌 새로고침
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void fetchHistory()} disabled={!selectedAccountId || isLoading}>
              {isLoading ? '불러오는 중...' : '조회'}
            </button>
          </div>
        </div>

        {accountsError ? <p className="error-text">계좌 목록 로드 실패: {accountsError}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <section className="card">
        <div className="section-header evaluation-list-section-header">
          <h2>이력 목록</h2>
          <span className="caption">{rows.length}건</span>
        </div>
        {!isLoading && rows.length === 0 ? <p className="subtle">조회 결과가 없습니다.</p> : null}
        {rows.length > 0 ? (
          <div className="table-scroll evaluation-table-desktop-wrap">
            <table className="data-table evaluation-table order-history-table">
              <thead>
                <tr>
                  <th>일시 (KST)</th>
                  <th>구분</th>
                  <th>종목</th>
                  <th className="num">수량</th>
                  <th>상태</th>
                  <th>출처</th>
                  <th>주문번호</th>
                  <th>전략 ID</th>
                  <th>거래소</th>
                  <th>비고</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const code = displayStockCode(row?.stk_cd)
                  const err = row?.error != null ? String(row.error) : ''
                  const errShort = err.length > 80 ? `${err.slice(0, 80)}…` : err
                  return (
                    <tr key={`${row?._id ?? idx}-${row?.created_at ?? idx}`}>
                      <td>{formatCreatedAt(row?.created_at)}</td>
                      <td>{sideLabel(row?.side)}</td>
                      <td>
                        <span className="stock-name-with-code" data-code={code}>
                          {row?.stk_nm || '—'}
                        </span>
                      </td>
                      <td className="num">{row?.ord_qty ?? '—'}</td>
                      <td>
                        <code>{row?.plan_status ?? '—'}</code>
                      </td>
                      <td>{sourceLabel(row?.source)}</td>
                      <td>
                        <code>{row?.ord_no ?? '—'}</code>
                      </td>
                      <td>
                        <code className="order-history-strategy-cell">{row?.strategy_id ?? '—'}</code>
                      </td>
                      <td>{row?.dmst_stex_tp ?? '—'}</td>
                      <td className="subtle order-history-error-cell" title={err || undefined}>
                        {errShort || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </section>
  )
}
