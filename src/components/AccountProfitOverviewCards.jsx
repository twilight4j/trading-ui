import {
  formatProfitTrackingStartDate,
  PROFIT_TRACKING_START_DATE,
} from '../lib/accountProfitOverview.js'
import { formatApiAmount, formatApiNumber, formatApiPercent, getToneByNumericString } from '../lib/formatApi.js'
import InfoHelpTooltip from './InfoHelpTooltip.jsx'

function ProfitSplitMetric({ label, value, valueType = 'number' }) {
  const displayValue = valueType === 'amount' ? formatApiAmount(value) : formatApiNumber(value)
  return (
    <div className="profit-overview-metric">
      <p className="caption">{label}</p>
      <p className="profit-overview-metric-value">{displayValue}</p>
    </div>
  )
}

function ProfitSplitCard({
  title,
  pl,
  prftRt,
  leftMetrics,
  rightMetrics,
  isLoading,
  hasError,
  metricEmphasis = false,
  helpAriaLabel,
  helpContent,
}) {
  const plTone = getToneByNumericString(pl)
  const prftTone = getToneByNumericString(prftRt)

  return (
    <article
      className={`card profit-overview-split-card${metricEmphasis ? ' profit-overview-split-card--metric-emphasis' : ''}`}
    >
      <header className="profit-overview-split-header">
        <div className="snapshot-chart-title-row profit-overview-split-title-row">
          <p className="profit-overview-split-title">{title}</p>
          {helpContent ? (
            <InfoHelpTooltip ariaLabel={helpAriaLabel || `${title} 설명`}>{helpContent}</InfoHelpTooltip>
          ) : null}
        </div>
        <div className="profit-overview-split-headline">
          {isLoading ? (
            <p className="subtle">조회 중...</p>
          ) : hasError ? (
            <p className="subtle">조회 실패</p>
          ) : (
            <>
              <p className={`profit-overview-split-pl ${plTone ? `delta ${plTone}` : ''}`}>
                {formatApiAmount(pl)}
              </p>
              <p className={`profit-overview-split-rate ${prftTone ? `delta ${prftTone}` : ''}`}>
                {formatApiPercent(prftRt)}
              </p>
            </>
          )}
        </div>
      </header>
      <div className="profit-overview-split-body">
        <div className="profit-overview-split-col">
          {leftMetrics.map((metric) => (
            <ProfitSplitMetric
              key={metric.label}
              label={metric.label}
              value={isLoading || hasError ? null : metric.value}
              valueType={metric.valueType}
            />
          ))}
        </div>
        <div className="profit-overview-split-col">
          {rightMetrics.map((metric) => (
            <ProfitSplitMetric
              key={metric.label}
              label={metric.label}
              value={isLoading || hasError ? null : metric.value}
              valueType={metric.valueType}
            />
          ))}
        </div>
      </div>
    </article>
  )
}

export default function AccountProfitOverviewCards({
  profitOverview,
  isLoading = false,
  realizedError = '',
}) {
  const cumulativeTone = getToneByNumericString(profitOverview?.cumulativePl)
  const startDateLabel = formatProfitTrackingStartDate(profitOverview?.startDate)

  return (
    <section className="profit-overview" aria-label="계좌 손익 요약">
      <article className="card profit-overview-cumulative">
        <div className="profit-overview-cumulative-left">
          <div className="snapshot-chart-title-row">
            <h2>추정 손익</h2>
            <InfoHelpTooltip ariaLabel="추정 손익 설명">
              <p className="subtle snapshot-chart-help-text">
                시작일({formatProfitTrackingStartDate(PROFIT_TRACKING_START_DATE)}) 이후{' '}
                <strong>평가 손익</strong>(보유 종목 미실현)과 <strong>실현 손익</strong>(매도 확정)을 합산한
                추정값입니다. 키움 계좌 API 기준이며 수수료·세금 반영 방식은 각 카드와 동일합니다.
              </p>
              <p className="subtle snapshot-chart-help-text">
                사용 API: <code>kt00018</code>(평가) + <code>ka10074</code>(실현)
              </p>
            </InfoHelpTooltip>
          </div>
          <p className="profit-overview-start-date caption">시작일 {startDateLabel}</p>
        </div>
        <div className="profit-overview-cumulative-right">
          {isLoading ? (
            <p className="subtle">조회 중...</p>
          ) : (
            <p className={`profit-overview-cumulative-value ${cumulativeTone ? `delta ${cumulativeTone}` : ''}`}>
              {formatApiAmount(profitOverview?.cumulativePl)}
            </p>
          )}
        </div>
      </article>

      <div className="profit-overview-bottom">
        <ProfitSplitCard
          title="평가 손익"
          pl={profitOverview?.evaluation?.pl}
          prftRt={profitOverview?.evaluation?.prftRt}
          isLoading={isLoading}
          hasError={!isLoading && !profitOverview}
          metricEmphasis
          helpAriaLabel="평가 손익 설명"
          helpContent={
            <>
              <p className="subtle snapshot-chart-help-text">
                현재 보유 종목의 평가손익(미실현)입니다. 매도로 확정된 실현손익은 포함하지 않습니다.
                <br />
                사용 API: <code>kt00018</code> (계좌평가잔고내역요청)
              </p>
              <p className="subtle snapshot-chart-help-text">
                예수금은 <code>kt00001</code> (예수금상세현황요청)의 d+2출금가능금액(
                <code>d2_pymn_alow_amt</code>) 기준입니다.
              </p>
            </>
          }
          leftMetrics={[{ label: '총 매입', value: profitOverview?.evaluation?.totPurAmt }]}
          rightMetrics={[
            { label: '총 평가', value: profitOverview?.evaluation?.totEvltAmt },
            { label: '예수금', value: profitOverview?.evaluation?.dbstBal, valueType: 'amount' },
          ]}
        />
        <ProfitSplitCard
          title="실현 손익"
          pl={profitOverview?.realized?.pl}
          prftRt={profitOverview?.realized?.prftRt}
          isLoading={isLoading}
          hasError={Boolean(realizedError) || (!isLoading && profitOverview && profitOverview.realized?.pl === null)}
          metricEmphasis
          helpAriaLabel="실현 손익 설명"
          helpContent={
            <p className="subtle snapshot-chart-help-text">
              시작일({formatProfitTrackingStartDate(PROFIT_TRACKING_START_DATE)})~오늘 기간의 매매 실현손익(매도
              확정)입니다. 보유 종목 평가손익은 포함하지 않습니다.
              <br />
              사용 API: <code>ka10074</code> (일자별실현손익요청)
            </p>
          }
          leftMetrics={[
            { label: '총 매수', value: profitOverview?.realized?.totBuyAmt },
            { label: '수수료', value: profitOverview?.realized?.trdeCmsn },
          ]}
          rightMetrics={[
            { label: '총 매도', value: profitOverview?.realized?.totSellAmt },
            { label: '세금합', value: profitOverview?.realized?.trdeTax },
          ]}
        />
      </div>

      {realizedError ? <p className="subtle profit-overview-realized-warning">실현 손익 조회 실패: {realizedError}</p> : null}
    </section>
  )
}
