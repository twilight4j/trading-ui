import { useEffect, useState } from 'react'
import { requestJson } from '../lib/api.js'
import {
  buildProfitOverview,
  fetchRealizedProfitDailySummary,
  getKstTodayYmd,
  PROFIT_TRACKING_START_DATE,
} from '../lib/accountProfitOverview.js'
import { fetchRealizedProfitByPeriod } from '../lib/realizedProfitByPeriod.js'
import AccountEvaluationDetailTabs from '../components/AccountEvaluationDetailTabs.jsx'
import AccountProfitOverviewCards from '../components/AccountProfitOverviewCards.jsx'
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
  const [realizedByPeriodRows, setRealizedByPeriodRows] = useState([])
  const [realizedByPeriodError, setRealizedByPeriodError] = useState('')
  const [realizedByPeriodTruncated, setRealizedByPeriodTruncated] = useState(false)
  const [rows, setRows] = useState([])
  const [buyDatesByStkCd, setBuyDatesByStkCd] = useState({})
  const [isAccountsLoading, setIsAccountsLoading] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [accountsError, setAccountsError] = useState('')

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
    setRealizedByPeriodError('')
    setRealizedByPeriodTruncated(false)
    try {
      await kiwoomRequestJson('POST', '/auth/active', { params: { account_id: accountId } })
      const [firstBalanceResponse, buyDatesResponse, realizedResult, depositResponse, realizedByPeriodResult] =
        await Promise.all([
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
          fetchRealizedProfitByPeriod(kiwoomRequestJson, {
            accountId,
            strtDt: PROFIT_TRACKING_START_DATE,
            endDt: getKstTodayYmd(),
          }).catch((realizedByPeriodFetchError) => ({
            rows: [],
            truncated: false,
            error:
              realizedByPeriodFetchError instanceof Error
                ? realizedByPeriodFetchError.message
                : String(realizedByPeriodFetchError),
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
      setRealizedByPeriodRows(
        Array.isArray(realizedByPeriodResult?.rows) ? realizedByPeriodResult.rows : [],
      )
      setRealizedByPeriodTruncated(Boolean(realizedByPeriodResult?.truncated))
      if (realizedByPeriodResult?.error) {
        setRealizedByPeriodError(realizedByPeriodResult.error)
      }
      let response = firstBalanceResponse
      let allRows = Array.isArray(response?.acnt_evlt_remn_indv_tot) ? response.acnt_evlt_remn_indv_tot : []

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
      setRealizedByPeriodRows([])
      setRealizedByPeriodError('')
      setRealizedByPeriodTruncated(false)
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

  return (
    <section className="dashboard">
      <section className="card">
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

      <AccountEvaluationDetailTabs
        balanceRows={rows}
        buyDatesByStkCd={buyDatesByStkCd}
        realizedRows={realizedByPeriodRows}
        realizedError={realizedByPeriodError}
        realizedTruncated={realizedByPeriodTruncated}
        isBalanceLoading={isLoading}
        isRealizedLoading={isLoading}
      />
    </section>
  )
}
