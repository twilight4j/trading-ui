import { useEffect, useMemo, useState } from 'react'
import { requestJson } from '../lib/api.js'
import { parseNumericString } from '../lib/numbers.js'
import {
  buildProfitOverview,
  fetchRealizedProfitDailySummary,
} from '../lib/accountProfitOverview.js'
import {
  getBuyOrdDtSortKey,
  getEvaluationBalanceRowDisplay,
  evalBalanceSortControlMeta,
} from '../lib/evaluationDisplay.js'
import AccountProfitOverviewCards from '../components/AccountProfitOverviewCards.jsx'
import EvaluationBalanceMobileCard from '../components/EvaluationBalanceMobileCard.jsx'
import InfoHelpTooltip from '../components/InfoHelpTooltip.jsx'
import { formatRegisteredAccountListLabel, normalizeRegisteredAccountRow } from '../lib/registeredAccounts.js'

import {
  delay,
  EVAL_BALANCE_NEXT_PAGE_DELAY_MS,
  kiwoomRequestJson,
} from '../lib/kiwoomRateLimit.js'

export default function AccountEvaluationBalanceView() {
  const [accounts, setAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [qryTp, setQryTp] = useState('1')
  const [dmstStexTp, setDmstStexTp] = useState('KRX')

  const [profitOverview, setProfitOverview] = useState(null)
  const [realizedError, setRealizedError] = useState('')
  const [rows, setRows] = useState([])
  const [buyDatesByStkCd, setBuyDatesByStkCd] = useState({})
  const [isAccountsLoading, setIsAccountsLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [accountsError, setAccountsError] = useState('')
  /** null: API 순서, 그 외: buy_ord_dt | evltv_prft | prft_rt 단일 컬럼 정렬 */
  const [evalBalanceSort, setEvalBalanceSort] = useState(null)

  async function loadAccountsAndInitialize() {
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

  async function fetchEvaluationBalance(accountId, nextQryTp, nextDmstStexTp) {
    if (!accountId) {
      return
    }
    const MAX_PAGES = 100
    setIsLoading(true)
    setError('')
    setRealizedError('')
    try {
      await kiwoomRequestJson('POST', '/auth/active', { params: { account_id: accountId } })
      const [firstBalanceResponse, buyDatesResponse, realizedResult, depositResponse] = await Promise.all([
        kiwoomRequestJson('POST', '/stk/acnt/evaluation-balance', {
          params: {
            cont_yn: 'N',
            next_key: '',
          },
          body: {
            qry_tp: nextQryTp,
            dmst_stex_tp: nextDmstStexTp,
          },
        }),
        requestJson('GET', '/stk/acnt/holding-buy-dates'),
        fetchRealizedProfitDailySummary(kiwoomRequestJson).catch((realizedFetchError) => ({
          summary: null,
          truncated: false,
          error: realizedFetchError instanceof Error ? realizedFetchError.message : String(realizedFetchError),
        })),
        kiwoomRequestJson('POST', '/stk/acnt/deposit-detail', {
          params: { cont_yn: 'N', next_key: '' },
          body: { qry_tp: '3' },
        }).catch((depositFetchError) => ({
          d2_pymn_alow_amt: null,
          error: depositFetchError instanceof Error ? depositFetchError.message : String(depositFetchError),
        })),
      ])
      setBuyDatesByStkCd(
        buyDatesResponse?.buy_dates && typeof buyDatesResponse.buy_dates === 'object'
          ? buyDatesResponse.buy_dates
          : {},
      )
      if (realizedResult?.error) {
        setRealizedError(realizedResult.error)
      }
      let response = firstBalanceResponse
      let allRows = Array.isArray(response?.acnt_evlt_remn_indv_tot) ? response.acnt_evlt_remn_indv_tot : []

      setEvalBalanceSort(null)
      const evaluationSummary = {
        totPurAmt: response?.tot_pur_amt ?? null,
        totEvltAmt: response?.tot_evlt_amt ?? null,
        totEvltPl: response?.tot_evlt_pl ?? null,
        totPrftRt: response?.tot_prft_rt ?? null,
        dbstBal: depositResponse?.d2_pymn_alow_amt ?? null,
      }
      setProfitOverview(
        buildProfitOverview({
          evaluationSummary,
          realizedSummary: realizedResult?.summary ?? null,
        }),
      )

      let pagingMeta = response?._paging || {}
      let contYnValue = String(pagingMeta?.cont_yn || 'N').toUpperCase()
      let nextKeyValue = String(pagingMeta?.next_key || '')
      let pages = 1

      while (contYnValue === 'Y' && nextKeyValue.length > 0 && pages < MAX_PAGES) {
        // eslint-disable-next-line no-await-in-loop
        await delay(EVAL_BALANCE_NEXT_PAGE_DELAY_MS)
        // eslint-disable-next-line no-await-in-loop
        response = await kiwoomRequestJson('POST', '/stk/acnt/evaluation-balance', {
          params: {
            cont_yn: 'Y',
            next_key: nextKeyValue,
          },
          body: {
            qry_tp: nextQryTp,
            dmst_stex_tp: nextDmstStexTp,
          },
        })
        const nextChunk = Array.isArray(response?.acnt_evlt_remn_indv_tot) ? response.acnt_evlt_remn_indv_tot : []
        allRows = [...allRows, ...nextChunk]
        pagingMeta = response?._paging || {}
        contYnValue = String(pagingMeta?.cont_yn || 'N').toUpperCase()
        nextKeyValue = String(pagingMeta?.next_key || '')
        pages++
      }

      setRows(allRows)

      if (pages >= MAX_PAGES && contYnValue === 'Y' && nextKeyValue.length > 0) {
        setError(`연속 페이지가 많아 처음 ${MAX_PAGES}페이지만 불러왔습니다.`)
      }
    } catch (fetchError) {
      setProfitOverview(null)
      setRealizedError('')
      setRows([])
      setBuyDatesByStkCd({})
      setError(fetchError instanceof Error ? fetchError.message : String(fetchError))
    } finally {
      setIsLoading(false)
    }
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

  const sortedRows = useMemo(() => {
    if (!evalBalanceSort) {
      return rows
    }
    const { field, dir } = evalBalanceSort
    const resolveSortValue = (item) => {
      if (field === 'buy_ord_dt') {
        return getBuyOrdDtSortKey(item, buyDatesByStkCd)
      }
      return parseNumericString(item?.[field])
    }
    return [...rows].sort((a, b) => {
      const va = resolveSortValue(a)
      const vb = resolveSortValue(b)
      if (va === null && vb === null) return 0
      if (va === null) return 1
      if (vb === null) return -1
      return dir === 'asc' ? va - vb : vb - va
    })
  }, [rows, evalBalanceSort, buyDatesByStkCd])

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

  const sortMetaBuyDt = evalBalanceSortControlMeta('buy_ord_dt', evalBalanceSort)
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
                    {formatRegisteredAccountListLabel(item)}
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
              onClick={() => fetchEvaluationBalance(selectedAccountId, qryTp, dmstStexTp)}
              disabled={!selectedAccountId || isLoading}
            >
              {isLoading ? '조회 중...' : '조회'}
            </button>
          </div>
        </div>

        {accountsError ? <p className="error-text">계좌 목록 로드 실패: {accountsError}</p> : null}
        {error ? <p className="debug-box">{error}</p> : null}
      </section>

      <AccountProfitOverviewCards
        profitOverview={profitOverview}
        isLoading={isLoading}
        realizedError={realizedError}
      />

      <section className="card">
        <div className="section-header evaluation-list-section-header">
          <div className="snapshot-chart-title-row">
            <h2>종목별 평가잔고 목록</h2>
            <InfoHelpTooltip ariaLabel="종목별 평가잔고 목록 설명">
              <p className="subtle snapshot-chart-help-text">
                선택한 계좌·조회구분·거래소 기준 보유 종목별 평가잔고입니다. 연속조회 응답을 합쳐 목록을
                구성합니다.
                <br />
                사용 API: <code>kt00018</code> (계좌평가잔고내역요청)
              </p>
            </InfoHelpTooltip>
          </div>
          <span className="caption">총 {rows.length}건</span>
        </div>
        {isLoading ? <p className="subtle">데이터를 조회하는 중입니다...</p> : null}
        {!isLoading && rows.length === 0 ? (
          <p className="subtle">조회된 평가잔고 데이터가 없습니다.</p>
        ) : null}
        {!isLoading && rows.length > 0 ? (
          <>
            <div className="table-scroll evaluation-table-desktop-wrap">
              <table className="data-table evaluation-table evaluation-table--balance-list">
              <colgroup>
                <col className="col-name" />
                <col className="col-buy-date" />
                <col className="col-pl" />
                <col className="col-rate" />
                <col className="col-price" />
                <col className="col-qty" />
                <col className="col-price" />
              </colgroup>
              <thead>
                <tr>
                  <th>종목명</th>
                  <th
                    className="col-buy-date th-sortable"
                    aria-sort={
                      evalBalanceSort?.field === 'buy_ord_dt'
                        ? evalBalanceSort.dir === 'asc'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                    }
                  >
                    <button
                      type="button"
                      className="th-sort-btn"
                      onClick={() => cycleEvalBalanceSort('buy_ord_dt')}
                      title="클릭: 최근순 → 과거순 → 원래 순서"
                    >
                      매수일
                      <span className="th-sort-icons" aria-hidden="true">
                        {evalBalanceSort?.field === 'buy_ord_dt'
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
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((item, index) => {
                  const d = getEvaluationBalanceRowDisplay(item, buyDatesByStkCd)
                  return (
                    <tr key={`${item?.stk_cd || 'stk'}-${index}`}>
                      <td>
                        <span className="stock-name-with-code" data-code={d.stockCode}>
                          {d.stockName}
                        </span>
                      </td>
                      <td className="col-buy-date">{d.buyOrdDtText}</td>
                      <td className={`num ${d.pnlTone ? `delta ${d.pnlTone}` : ''}`}>{d.evltvPrftText}</td>
                      <td className={`num ${d.profitTone ? `delta ${d.profitTone}` : ''}`}>{d.prftRtText}</td>
                      <td className="num">{d.purPricText}</td>
                      <td className="num">{d.rmndQtyText}</td>
                      <td className="num">{d.curPrcText}</td>
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
                  onClick={() => cycleEvalBalanceSort('buy_ord_dt')}
                  aria-pressed={sortMetaBuyDt.ariaPressed}
                  aria-label={sortMetaBuyDt.ariaLabel}
                >
                  {sortMetaBuyDt.name}
                  <span aria-hidden="true">{sortMetaBuyDt.icon}</span>
                </button>
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
                    buyDatesByStkCd={buyDatesByStkCd}
                    showAmountFields={false}
                  />
                ))}
              </ul>
            </div>
          </>
        ) : null}
      </section>
    </section>
  )
}
