import { defaultMarketStatus } from '../../data/marketStatusMock.js'
import './market-dashboard.css'

/** @typedef {typeof defaultMarketStatus} MarketStatusData */

/** @param {object} props
 * @param {MarketStatusData} [props.data]
 */
export default function MarketStatusDashboard({ data = defaultMarketStatus }) {
  const { headline, indices, breadth, supply, turnover, sectors, scoreBreakdown } = data
  const breadthTotal = breadth.up + breadth.flat + breadth.down || 1
  const segUp = (breadth.up / breadthTotal) * 100
  const segFlat = (breadth.flat / breadthTotal) * 100
  const segDown = (breadth.down / breadthTotal) * 100

  return (
    <div className="mdash-root mdash-num" aria-label="시장 상태 대시보드 목 데이터">
      <div className="mdash-stack">
        <section className="mdash-panel" aria-labelledby="mdash-head-title">
          <div className="mdash-status-head">
            <div>
              <p className="muted-inline mdash-muted" style={{ margin: '0 0 4px' }}>
                {headline.sectionTitle}
              </p>
              <h2 id="mdash-head-title" className="mdash-status-title">
                {headline.regimeLabel}
              </h2>
              <p className="mdash-status-sub">{headline.subtitle}</p>
            </div>
            <div className="mdash-score-block">
              <p className="mdash-score-big">
                {headline.score}
                <span className="mdash-score-suffix">
                  {' '}
                  / {headline.scoreMax}점
                </span>
              </p>
            </div>

            <div className="mdash-gauge-wrap">
              <div style={{ position: 'relative' }}>
                <div className="mdash-gauge-track" role="presentation">
                  {headline.gaugeZones.map((z) => (
                    <div key={z.id} className={`mdash-gz mdash-gz--${z.tone}`} />
                  ))}
                </div>
                <div
                  className="mdash-gauge-mark"
                  style={{ left: `${Math.min(100, Math.max(0, headline.indicatorPct))}%` }}
                  aria-hidden
                />
              </div>
              <div className="mdash-gauge-labels">
                {headline.gaugeZones.map((z) => (
                  <span key={z.id}>{z.label}</span>
                ))}
              </div>
            </div>

            <div className="mdash-indices">
              {indices.map((idx) => (
                <article key={idx.id} className="mdash-idx-cell">
                  <h3 className="mdash-idx-name">{idx.name}</h3>
                  {idx.isFx ? (
                    <p
                      className={`mdash-idx-chg ${
                        idx.changeFxWon < 0 ? 'mdash-idx-chg--down' : 'mdash-idx-chg--up'
                      }`}
                    >
                      {idx.changeFxWon > 0 ? '+' : ''}
                      {idx.changeFxWon}원
                    </p>
                  ) : (
                    <p
                      className={`mdash-idx-chg ${
                        (idx.changePct ?? 0) >= 0 ? 'mdash-idx-chg--up' : 'mdash-idx-chg--down'
                      }`}
                    >
                      {idx.changePct !== undefined
                        ? `${idx.changePct > 0 ? '+' : ''}${idx.changePct}%`
                        : '—'}
                    </p>
                  )}
                  <p className="mdash-idx-val">{idx.valueLabel}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <div className="mdash-row-2">
          <section className="mdash-panel" aria-label="시장 폭">
            <h3 className="mdash-caption">시장 폭</h3>
            <div className="mdash-breadth-top">
              <span>
                <span className="mdash-dot mdash-dot--up" aria-hidden />상승 {breadth.up}
              </span>
              <span>
                <span className="mdash-dot mdash-dot--flat" aria-hidden />
                보합 {breadth.flat}
              </span>
              <span>
                <span className="mdash-dot mdash-dot--down" aria-hidden />
                하락 {breadth.down}
              </span>
            </div>
            <div className="mdash-breadth-bar" role="img" aria-label="상승 보합 하락 비율">
              <span className="mdash-bb-up" style={{ width: `${segUp}%` }} />
              <span className="mdash-bb-flat" style={{ width: `${segFlat}%` }} />
              <span className="mdash-bb-down" style={{ width: `${segDown}%` }} />
            </div>
            <p className="mdash-breadth-foot">
              {breadth.ratioSummary} · <strong>{breadth.strengthLabel}</strong>
            </p>
            <ul className="mdash-badge-list">
              {breadth.badges.map((b) => (
                <li key={b.id} className="mdash-badge-row">
                  <span>{b.label}</span>
                  <span className={`mdash-badge-pill mdash-badge-pill--${b.tone}`}>{b.count}종목</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="mdash-panel" aria-label="외국인 기관 수급">
            <h3 className="mdash-caption">외국인·기관 수급</h3>
            <div className="mdash-supply-highlight">
              <p className="mdash-supply-title">{supply.highlight.title}</p>
              <p className="mdash-supply-amt">{supply.highlight.amountEKRLabel}</p>
              <span className="mdash-supply-tag">{supply.highlight.tag}</span>
            </div>
            <div className="mdash-supply-table">
              {supply.rows.map((r) => (
                <div key={r.id} className="mdash-supply-line">
                  <span className="mdash-muted">{r.label}</span>
                  <span
                    className={
                      r.tone === 'up'
                        ? 'mdash-tone-up'
                        : r.tone === 'down'
                          ? 'mdash-tone-down'
                          : 'mdash-tone-neutral'
                    }
                  >
                    {r.amountEKRLabel}
                  </span>
                </div>
              ))}
            </div>
            <p className="mdash-supply-callout">{supply.callout}</p>
          </section>
        </div>

        <section className="mdash-panel" aria-labelledby="mdash-tov-title">
          <h3 id="mdash-tov-title" className="mdash-caption">
            거래대금
          </h3>
          <div className="mdash-tov-summary">
            <div className="mdash-tov-sum-cell">
              <span className="label">KOSPI</span>
              <span className="val">{turnover.kospiTrillion}조</span>
            </div>
            <div className="mdash-tov-sum-cell">
              <span className="label">KOSDAQ</span>
              <span className="val">{turnover.kosdaqTrillion}조</span>
            </div>
            <div className="mdash-tov-sum-cell">
              <span className="label">전일 대비</span>
              <span className="val up">+{turnover.vsPrevPct}%</span>
            </div>
            <div className="mdash-tov-sum-cell">
              <span className="label">합계</span>
              <span className="val">{turnover.totalTrillion}조</span>
            </div>
          </div>
          <div className="mdash-chart" role="img" aria-label="시간대별 거래대금">
            {turnover.hourlyBars.map((bar) => (
              <div key={bar.time} className="mdash-chart-col">
                <div className="mdash-bar-stack">
                  <div
                    className="mdash-bar-base"
                    style={{ height: `${bar.baseline}%` }}
                    aria-hidden
                  />
                  <div
                    className="mdash-bar-cur"
                    style={{ height: `${bar.current}%` }}
                    aria-hidden
                  />
                </div>
                <span className="mdash-chart-time">{bar.time}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mdash-panel" aria-labelledby="mdash-sector-title">
          <h3 id="mdash-sector-title" className="mdash-caption">
            주도 섹터 히트맵
          </h3>
          <div className="mdash-sector-grid">
            {sectors.map((s) => (
              <article key={s.id} className="mdash-sector-cell" style={sectorHeatStyle(s.changePct)}>
                <h4 className="mdash-sector-name">{s.label}</h4>
                <p
                  className={`mdash-sector-pct ${
                    s.changePct >= 0 ? 'mdash-tone-up' : 'mdash-tone-down'
                  }`}
                >
                  {s.changePct > 0 ? '+' : ''}
                  {s.changePct}%
                </p>
              </article>
            ))}
          </div>
          <p className="mdash-sector-legend">
            색상: 짙은 빨강 = 강세 / 짙은 파랑 = 약세
          </p>
        </section>

        <section className="mdash-panel" aria-labelledby="mdash-score-bd-title">
          <h3 id="mdash-score-bd-title" className="mdash-caption">
            시장 점수 구성
          </h3>
          <div className="mdash-break-list">
            {scoreBreakdown.map((row) => {
              const ratio = row.max > 0 ? row.earned / row.max : 0
              const fillTone = ratio >= 0.85 ? 'up' : ratio >= 0.35 ? 'mid' : 'down'
              return (
                <div key={row.id} className="mdash-break-row">
                  <div className="mdash-break-head">
                    <span className="mdash-break-label">{row.label}</span>
                    <span className="mdash-break-score">
                      {row.earned} / {row.max}
                    </span>
                  </div>
                  <div
                    className="mdash-progress"
                    role="progressbar"
                    aria-valuenow={row.earned}
                    aria-valuemin={0}
                    aria-valuemax={row.max}
                  >
                    <div
                      className={`mdash-progress-fill mdash-fill-${fillTone}`}
                      style={{ width: `${Math.min(100, ratio * 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

/** @param {number} changePct */
function sectorHeatStyle(changePct) {
  const clamped = Math.min(4.5, Math.max(-4.5, changePct))
  if (clamped >= 0) {
    const t = clamped / 4.5
    return {
      backgroundColor: `color-mix(in srgb, var(--up) ${Math.round((0.06 + t * 0.28) * 100)}%, var(--surface))`,
    }
  }
  const t = Math.abs(clamped) / 4.5
  return {
    backgroundColor: `color-mix(in srgb, var(--down) ${Math.round((0.06 + t * 0.28) * 100)}%, var(--surface))`,
  }
}
