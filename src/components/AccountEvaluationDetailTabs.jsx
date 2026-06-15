import { useState } from 'react'
import {
  formatProfitTrackingStartDate,
  PROFIT_TRACKING_START_DATE,
} from '../lib/accountProfitOverview.js'
import EvaluationBalanceListCard from './EvaluationBalanceListCard.jsx'
import InfoHelpTooltip from './InfoHelpTooltip.jsx'
import RealizedProfitByPeriodCard from './RealizedProfitByPeriodCard.jsx'

const TAB_BALANCE = 'balance'
const TAB_REALIZED = 'realized'

export default function AccountEvaluationDetailTabs({
  balanceRows = [],
  buyDatesByStkCd = {},
  realizedRows = [],
  realizedError = '',
  realizedTruncated = false,
  isBalanceLoading = false,
  isRealizedLoading = false,
}) {
  const [activeTab, setActiveTab] = useState(TAB_BALANCE)

  return (
    <section className="card evaluation-detail-tabs">
      <div className="evaluation-detail-tab-list" role="tablist" aria-label="평가잔고 및 실현손익">
        <div
          className={`evaluation-detail-tab-entry${activeTab === TAB_BALANCE ? ' evaluation-detail-tab-entry--active' : ''}`}
        >
          <button
            type="button"
            role="tab"
            id="evaluation-detail-tab-balance"
            className="evaluation-detail-tab"
            aria-selected={activeTab === TAB_BALANCE}
            aria-controls="evaluation-detail-panel-balance"
            onClick={() => setActiveTab(TAB_BALANCE)}
          >
            평가 손익 상세 ({balanceRows.length})
          </button>
          <InfoHelpTooltip ariaLabel="평가 손익 상세 설명">
            <p className="subtle snapshot-chart-help-text">
              선택한 계좌·조회구분·거래소 기준 보유 종목별 평가잔고입니다. 연속조회 응답을 합쳐 목록을
              구성합니다.
              <br />
              사용 API: <code>kt00018</code> (계좌평가잔고내역요청)
            </p>
          </InfoHelpTooltip>
        </div>
        <div
          className={`evaluation-detail-tab-entry${activeTab === TAB_REALIZED ? ' evaluation-detail-tab-entry--active' : ''}`}
        >
          <button
            type="button"
            role="tab"
            id="evaluation-detail-tab-realized"
            className="evaluation-detail-tab"
            aria-selected={activeTab === TAB_REALIZED}
            aria-controls="evaluation-detail-panel-realized"
            onClick={() => setActiveTab(TAB_REALIZED)}
          >
            실현 손익 상세 ({realizedRows.length})
          </button>
          <InfoHelpTooltip ariaLabel="일자별·종목별 실현손익 설명">
            <p className="subtle snapshot-chart-help-text">
              시작일({formatProfitTrackingStartDate(PROFIT_TRACKING_START_DATE)})~오늘 기간의 매도 확정 실현손익
              내역입니다. 전체 종목 기준이며 체결 단위 행으로 표시됩니다.
              <br />
              사용 API: <code>ka10073</code> (일자별종목별실현손익요청_기간)
            </p>
          </InfoHelpTooltip>
        </div>
      </div>

      {activeTab === TAB_BALANCE ? (
        <div
          role="tabpanel"
          id="evaluation-detail-panel-balance"
          className="evaluation-detail-tab-panel"
          aria-labelledby="evaluation-detail-tab-balance"
        >
          <EvaluationBalanceListCard
            embedded
            rows={balanceRows}
            buyDatesByStkCd={buyDatesByStkCd}
            isLoading={isBalanceLoading}
          />
        </div>
      ) : null}

      {activeTab === TAB_REALIZED ? (
        <div
          role="tabpanel"
          id="evaluation-detail-panel-realized"
          className="evaluation-detail-tab-panel"
          aria-labelledby="evaluation-detail-tab-realized"
        >
          <RealizedProfitByPeriodCard
            embedded
            rows={realizedRows}
            isLoading={isRealizedLoading}
            error={realizedError}
            truncated={realizedTruncated}
          />
        </div>
      ) : null}
    </section>
  )
}
