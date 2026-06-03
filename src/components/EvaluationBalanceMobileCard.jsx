import { getEvaluationBalanceRowDisplay } from '../lib/evaluationDisplay.js'

export default function EvaluationBalanceMobileCard({
  item,
  buyDatesByStkCd = null,
  showAmountFields = true,
}) {
  const d = getEvaluationBalanceRowDisplay(item, buyDatesByStkCd)
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
          <span className="evaluation-balance-card-label">매수일</span>
          <span className="evaluation-balance-card-value">{d.buyOrdDtText}</span>
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
        {showAmountFields ? (
          <>
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
          </>
        ) : null}
      </div>
    </li>
  )
}
