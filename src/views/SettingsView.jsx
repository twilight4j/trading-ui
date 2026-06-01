import { useEffect, useMemo, useRef, useState } from 'react'
import { requestJson } from '../lib/api.js'
import { parseCommaInt, toComma } from '../lib/numbers.js'
import {
  UNSELECTED_OPTION,
  flattenDeclarativeRuleOptionsFromRulesList,
  resolveDeclarativeRuleIdsFromStrategy,
  assembleStrategyEmbeddedRulesFromMultiSelectors,
  isMissingActiveStrategyError,
} from '../lib/strategyRules.js'
import { formatRegisteredAccountListLabel, normalizeRegisteredAccountRow } from '../lib/registeredAccounts.js'

export default function SettingsView() {
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
  const [entryActiveFromInput, setEntryActiveFromInput] = useState('')
  const [savedEntryActiveFromInput, setSavedEntryActiveFromInput] = useState('')
  const [selectedTakeProfitRuleIds, setSelectedTakeProfitRuleIds] = useState([])
  const [savedTakeProfitRuleIds, setSavedTakeProfitRuleIds] = useState([])
  const [selectedStopLossRuleIds, setSelectedStopLossRuleIds] = useState([])
  const [savedStopLossRuleIds, setSavedStopLossRuleIds] = useState([])
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
  const ruleIdsEqual = (a, b) => {
    const left = Array.isArray(a) ? [...a].sort() : []
    const right = Array.isArray(b) ? [...b].sort() : []
    if (left.length !== right.length) {
      return false
    }
    return left.every((value, index) => value === right[index])
  }
  const hasUnsavedSelectionChanges =
    selectedSignalSec !== savedSelectedSignalSec ||
    entryActiveFromInput !== savedEntryActiveFromInput ||
    !ruleIdsEqual(selectedTakeProfitRuleIds, savedTakeProfitRuleIds) ||
    !ruleIdsEqual(selectedStopLossRuleIds, savedStopLossRuleIds)

  function toggleRuleId(currentIds, ruleId) {
    const set = new Set(Array.isArray(currentIds) ? currentIds : [])
    if (set.has(ruleId)) {
      set.delete(ruleId)
    } else {
      set.add(ruleId)
    }
    return [...set]
  }

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
    setEntryActiveFromInput('')
    setSavedEntryActiveFromInput('')
    setSelectedTakeProfitRuleIds([])
    setSavedTakeProfitRuleIds([])
    setTakeProfitRuleOptions([])
    setStopLossRuleOptions([])
    setSelectedStopLossRuleIds([])
    setSavedStopLossRuleIds([])

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
        const loadedActiveFrom = String(strategy?.entry_filter?.active_from || '').trim()
        const loadedStopLossRuleIds = resolveDeclarativeRuleIdsFromStrategy(
          strategy.rules,
          slOptionsFlat,
          'STOP_LOSS',
        )
        const loadedTakeProfitRuleIds = resolveDeclarativeRuleIdsFromStrategy(
          strategy.rules,
          tpOptionsFlat,
          'TAKE_PROFIT',
        )
        setActiveStrategy(strategy)
        setLoadedAccountId(accountId)
        setSelectedSignalSec(loadedSignalSec)
        setSavedSelectedSignalSec(loadedSignalSec)
        setEntryActiveFromInput(loadedActiveFrom)
        setSavedEntryActiveFromInput(loadedActiveFrom)
        setSelectedTakeProfitRuleIds(loadedTakeProfitRuleIds)
        setSavedTakeProfitRuleIds(loadedTakeProfitRuleIds)
        setSelectedStopLossRuleIds(loadedStopLossRuleIds)
        setSavedStopLossRuleIds(loadedStopLossRuleIds)
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
        ? rows.map((item) => normalizeRegisteredAccountRow(item)).filter(Boolean)
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
      const rules = assembleStrategyEmbeddedRulesFromMultiSelectors(
        selectedStopLossRuleIds,
        selectedTakeProfitRuleIds,
        stopLossRuleOptions,
        takeProfitRuleOptions,
      )
      const slRows = rules.filter((r) => String(r?.type || '').toUpperCase() === 'STOP_LOSS')
      const tpRows = rules.filter((r) => String(r?.type || '').toUpperCase() === 'TAKE_PROFIT')

      if (selectedStopLossRuleIds.some((id) => !stopLossRuleOptions.some((o) => o.value === id))) {
        throw new Error('선택한 손절 규칙 템플릿을 찾을 수 없습니다. 계좌를 다시 동기화한 뒤 선택하세요.')
      }
      if (selectedTakeProfitRuleIds.some((id) => !takeProfitRuleOptions.some((o) => o.value === id))) {
        throw new Error('선택한 익절 규칙 템플릿을 찾을 수 없습니다. 계좌를 다시 동기화한 뒤 선택하세요.')
      }
      if (slRows.length !== selectedStopLossRuleIds.length || tpRows.length !== selectedTakeProfitRuleIds.length) {
        throw new Error('선택한 손절·익절 규칙을 확인하세요.')
      }
      if (budgetAmount === null || budgetAmount < 10000 || budgetAmount > 10000000) {
        throw new Error('1회 매수금액을 올바르게 입력하세요. (10,000~10,000,000)')
      }
      if (maxHoldings === null || maxHoldings < 1 || maxHoldings > 2000) {
        throw new Error('최대 보유 종목 수를 올바르게 입력하세요. (1~2000)')
      }

      const entryFilter = {
        signal_sec: selectedSignalSec,
        signal_name: signalMap[selectedSignalSec] || '',
      }
      const trimmedActiveFrom = String(entryActiveFromInput || '').trim()
      if (trimmedActiveFrom) {
        entryFilter.active_from = trimmedActiveFrom
      }

      const payload = {
        budget_amount: budgetAmount,
        max_holdings: maxHoldings,
        entry_filter: entryFilter,
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
      setSavedEntryActiveFromInput(entryActiveFromInput)
      setEntryActiveFromInput(entryActiveFromInput)
      setSavedTakeProfitRuleIds(selectedTakeProfitRuleIds)
      setSavedStopLossRuleIds(selectedStopLossRuleIds)
      setSelectedTakeProfitRuleIds(selectedTakeProfitRuleIds)
      setSelectedStopLossRuleIds(selectedStopLossRuleIds)
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
                    {formatRegisteredAccountListLabel(item)}
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
              <label htmlFor="entry-active-from">진입 시작 시각 (KST)</label>
              <input
                id="entry-active-from"
                type="time"
                value={entryActiveFromInput}
                onChange={(event) => setEntryActiveFromInput(event.target.value)}
                disabled={bodyBlocked}
              />
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
          <p className="subtle">
            검증 범위: 매수금액 10,000~10,000,000원 / 보유수 1~2000. 진입 시작 시각을 비우면 스케줄 cron부터
            즉시 진입 후보를 스캔합니다.
          </p>

          <h2>익절 / 손절 규칙 (복수 선택 가능)</h2>
          <div className="settings-grid">
            <div className="form-field">
              <span className="field-label">익절 규칙</span>
              <div className="checkbox-list" id="buy-rule">
                {takeProfitRuleOptions.length === 0 ? (
                  <p className="subtle">등록된 익절 템플릿이 없습니다.</p>
                ) : (
                  takeProfitRuleOptions.map((item) => (
                    <label key={item.value} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedTakeProfitRuleIds.includes(item.value)}
                        onChange={() =>
                          setSelectedTakeProfitRuleIds((prev) => toggleRuleId(prev, item.value))
                        }
                        disabled={bodyBlocked}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="form-field">
              <span className="field-label">손절 규칙</span>
              <div className="checkbox-list" id="sell-rule">
                {stopLossRuleOptions.length === 0 ? (
                  <p className="subtle">등록된 손절 템플릿이 없습니다.</p>
                ) : (
                  stopLossRuleOptions.map((item) => (
                    <label key={item.value} className="checkbox-row">
                      <input
                        type="checkbox"
                        checked={selectedStopLossRuleIds.includes(item.value)}
                        onChange={() =>
                          setSelectedStopLossRuleIds((prev) => toggleRuleId(prev, item.value))
                        }
                        disabled={bodyBlocked}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
          <p className="subtle">규칙을 선택하지 않으면 해당 유형의 자동 청산 규칙 없이 저장됩니다.</p>
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
