# Trading Dashboard Home

## 1) Design Intent
- 목적: 사용자가 시장 상황을 빠르게 파악하고, 즉시 매수/매도 판단으로 이동할 수 있는 홈 대시보드를 제공한다.
- 핵심 사용자 행동: (1) 관심 종목 상태 확인 (2) 즉시 주문 진입
- 톤&무드 키워드(3개): 신뢰감, 명확함, 절제된 세련미

## 2) Layout Spec
- 그리드: 12-column desktop grid, tablet 8-column, mobile single column
- 최대 너비/브레이크포인트: `max-w-7xl`, `sm/md/lg/xl` 기본 Tailwind 브레이크포인트 사용
- 섹션 구조:
  - Top Bar: 계정 요약, 시장 상태, 빠른 액션 버튼
  - Summary Row: 총 자산, 일일 손익, 평가손익률, 주문 가능 금액 카드 4개
  - Main Split:
    - Left(8 cols): 관심 종목 테이블 + 포지션 요약
    - Right(4 cols): 빠른 주문 패널 + 알림/리스크 배지
  - Bottom: 최근 체결/주문 이력
- 여백 규칙(8px 스케일 기준): 외곽 `px-6 py-6`, 섹션 간 `gap-6`, 카드 내부 `p-4`, 카드 내 요소 간 `gap-2/gap-3`

## 3) Typography Spec
- Headline: `text-2xl font-semibold tracking-tight`
- Title: `text-base font-semibold`
- Body: `text-sm font-normal leading-6`
- Caption: `text-xs font-medium leading-5`
- 숫자 데이터: 금액/수량 영역은 탭형 정렬 우선, 숫자 가독성 높은 폰트 렌더링 유지

## 4) Color & Surface Spec
- Primary: `blue-600` (주요 CTA, 선택 상태)
- Neutral:
  - 배경 `slate-50`
  - 카드 `white`
  - 기본 텍스트 `slate-900`
  - 보조 텍스트 `slate-500`
  - 경계선 `slate-200`
- Semantic(success/warn/error):
  - 상승/이익 `emerald-600`
  - 주의 `amber-500`
  - 하락/손실 `rose-600`
- 배경/카드/보더 규칙:
  - 카드 기본 `rounded-xl border border-slate-200 bg-white shadow-sm`
  - 강조 카드만 `shadow-md` 허용
  - 그라디언트는 기본 금지, 필요 시 헤더 배지 등 작은 영역에서만 제한적으로 사용

## 5) Component Spec
- Button:
  - Primary: `bg-blue-600 text-white hover:bg-blue-700`
  - Secondary: `bg-white border border-slate-300 text-slate-700 hover:bg-slate-50`
  - 높이 기본 `h-10`, `rounded-lg`, `px-4`
- Input:
  - 기본 `h-10 rounded-lg border-slate-300`
  - 포커스 `focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500`
  - 금액 입력은 우측 정렬
- Card:
  - 헤더(제목 + 보조 액션), 본문(핵심 지표), 푸터(보조 설명) 구조 고정
- Table/List:
  - 헤더 `text-xs font-semibold uppercase tracking-wide text-slate-500`
  - 행 높이 `h-11` 기준
  - 숫자 컬럼 우측 정렬, 퍼센트 컬럼은 색상 의미 일관 적용
- Empty/Error/Loading 상태:
  - Empty: 아이콘 + 한 줄 안내 + CTA 버튼
  - Error: 인라인 에러 박스 + 재시도 버튼
  - Loading: 스켈레톤(카드 4개, 테이블 5행)

## 6) Interaction Spec
- Hover/Focus/Pressed:
  - 카드 hover: `shadow-sm -> shadow-md` (상호작용 가능 카드만)
  - 버튼 pressed: `scale-[0.99]` 이내로 미세 반응
  - 포커스: 모든 입력/버튼에 명확한 링 표시
- Transition(ms, easing):
  - 일반 전환 `duration-150 ease-out`
  - 패널 열기/닫기 `duration-200 ease-in-out`
- 피드백 패턴(토스트/인라인 에러):
  - 성공: 우상단 토스트 2.5초
  - 검증 실패: 필드 하단 인라인 에러 우선
  - 주문 실패: 상단 경고 배너 + 상세 로그 링크

## 7) Accessibility Checklist
- 대비 기준: 본문 텍스트 WCAG AA(최소 4.5:1) 충족
- 키보드 포커스: 탭 순서가 시각적 흐름과 동일, 포커스 트랩 없는 구조
- aria/label 고려사항:
  - 아이콘 버튼은 `aria-label` 필수
  - 상승/하락 색상은 텍스트/아이콘으로 중복 표현
  - 실시간 업데이트 수치는 스크린리더 과도 알림 방지(`aria-live` 최소화)

## 8) Tailwind Mapping Notes
- 토큰 -> Tailwind 클래스 매핑 원칙:
  - 색상: `blue/slate/emerald/rose` 중심으로 제한
  - radius: `rounded-lg`(컨트롤), `rounded-xl`(카드)
  - 그림자: `shadow-sm` 기본, `shadow-md` 제한 사용
  - 간격: `2/3/4/6/8` 중심으로 통일
- 커스텀 확장 필요 항목:
  - 브랜드 색상 고정이 필요하면 `tailwind.config`에 `brand` 팔레트 추가
  - 숫자 데이터 가독성을 위해 폰트 기능(tabular-nums) 유틸리티 적용 고려
