/** 목 시장 상태 데이터 — 추후 동일 형태로 API 결과를 채우면 됨 */

export const defaultMarketStatus = {
  headline: {
    sectionTitle: '오늘의 시장 상태',
    regimeLabel: '강세장',
    subtitle: '2026년 5월 13일 · 종가 기준',
    score: 78,
    scoreMax: 100,
    /** 게이지 마커 위치 (0~100). 점수와 동일하게 둠 */
    indicatorPct: 78,
    gaugeZones: [
      { id: 'z1', label: '매우 위험', tone: 'danger' },
      { id: 'z2', label: '애매', tone: 'warn' },
      { id: 'z3', label: '양호', tone: 'ok' },
      { id: 'z4', label: '매우 강세', tone: 'strong' },
    ],
  },

  indices: [
    { id: 'kospi', name: 'KOSPI', changePct: 1.24, valueLabel: '2,681.32' },
    { id: 'kosdaq', name: 'KOSDAQ', changePct: 2.11, valueLabel: '762.15' },
    { id: 'usdkrw', name: 'USD/KRW', valueLabel: '1,384.5', changeFxWon: -2.3, isFx: true },
    { id: 'k200fut', name: 'KOSPI 200 선물', changePct: 1.31, valueLabel: '352.10' },
  ],

  breadth: {
    up: 872,
    flat: 102,
    down: 446,
    upRatioPct: 61.3,
    strengthLabel: '강한 장',
    ratioSummary: '상승 비율 61.3%',
    badges: [
      { id: 'h52', label: '52주 신고가', count: 48, tone: 'up' },
      { id: 'l52', label: '52주 신저가', count: 12, tone: 'down' },
      { id: 'upper', label: '상한가', count: 7, tone: 'up' },
      { id: 'vi', label: 'VI 발동', count: 23, tone: 'up' },
      { id: 'surge', label: '10%+ 급등', count: 31, tone: 'up' },
    ],
  },

  supply: {
    highlight: {
      title: '외국인 선물 순매수',
      amountEKRLabel: '+4,217억원',
      tag: '강세 시그널',
    },
    rows: [
      { id: 'fspot', label: '외국인 현물', amountEKRLabel: '+2,841억', tone: 'up' },
      { id: 'inst', label: '기관 순매수', amountEKRLabel: '-512억', tone: 'down' },
      { id: 'prog', label: '프로그램 매매', amountEKRLabel: '+1,124억', tone: 'up' },
      { id: 'basis', label: '베이시스', amountEKRLabel: '+0.42', tone: 'neutral' },
    ],
    callout: '외국인 현물 + 선물 동시 순매수 · 매우 긍정적',
  },

  turnover: {
    kospiTrillion: 12.4,
    kosdaqTrillion: 8.1,
    vsPrevPct: 18.3,
    totalTrillion: 20.5,
    /** 시간대별: 현재봉 높이(0~100), 배경 봉(전일/비교용) 높이 */
    hourlyBars: [
      { time: '09:00', current: 42, baseline: 38 },
      { time: '10:00', current: 58, baseline: 45 },
      { time: '11:00', current: 71, baseline: 52 },
      { time: '12:00', current: 76, baseline: 60 },
      { time: '13:00', current: 82, baseline: 66 },
      { time: '14:00', current: 94, baseline: 72 },
      { time: '15:00', current: 100, baseline: 78 },
    ],
  },

  sectors: [
    { id: 'semi', label: '반도체', changePct: 3.2 },
    { id: 'ai', label: 'AI', changePct: 2.8 },
    { id: 'robot', label: '로봇', changePct: 2.1 },
    { id: 'defense', label: '방산', changePct: 1.6 },
    { id: 'ship', label: '조선', changePct: 1.1 },
    { id: 'bat2', label: '2차전지', changePct: -0.4 },
    { id: 'bio', label: '바이오', changePct: -1.8 },
    { id: 'chem', label: '화학', changePct: -0.9 },
  ],

  scoreBreakdown: [
    { id: 's1', label: '코스닥 상승', earned: 20, max: 20 },
    { id: 's2', label: '상승 종목 우세', earned: 16, max: 20 },
    { id: 's3', label: '외국인 선물 매수', earned: 18, max: 20 },
    { id: 's4', label: '거래대금 증가', earned: 13, max: 15 },
    { id: 's5', label: '주도주 강세', earned: 11, max: 15 },
    { id: 's6', label: '환율 안정', earned: 0, max: 10 },
  ],
}
