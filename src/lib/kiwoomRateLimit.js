import { ApiError, requestJson } from './api.js'

/** 연속 키움 프록시 호출 최소 간격(ms) — 429 방지 */
export const KIWOOM_MIN_GAP_MS = 1000

/** 평가잔고 연속 페이지 조회 간격(ms) */
export const EVAL_BALANCE_NEXT_PAGE_DELAY_MS = 1000

/** 계좌 간 평가잔고 조회 추가 대기(ms) — 계좌 단위 배치 후 버퍼 */
export const SUMMARY_BETWEEN_ACCOUNTS_DELAY_MS = 1000

/** 배치 첫 계좌 조회 전 warmup(ms) — 화면 진입·재조회 직후 429/502 완화 */
export const SUMMARY_FIRST_ACCOUNT_WARMUP_DELAY_MS = 1000

/** 429 재시도 대기(ms) — 시도마다 증가 */
export const KIWOOM_429_RETRY_DELAYS_MS = [1500, 2500, 4000]

const KIWOOM_429_MAX_RETRIES = 3

let lastKiwoomCallFinishedAt = 0

export function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * 마지막 키움 호출 이후 KIWOOM_MIN_GAP_MS 가 지날 때까지 대기.
 */
export async function kiwoomThrottleWait() {
  const elapsed = Date.now() - lastKiwoomCallFinishedAt
  const remaining = KIWOOM_MIN_GAP_MS - elapsed
  if (remaining > 0) {
    await delay(remaining)
  }
}

function markKiwoomCallFinished() {
  lastKiwoomCallFinishedAt = Date.now()
}

function isRateLimitError(error) {
  return error instanceof ApiError && error.status === 429
}

/**
 * 키움 연동 API용 requestJson — 호출 전 throttle, 429 시 sleep 후 재시도.
 */
export async function kiwoomRequestJson(method, path, options = {}) {
  let lastError = null

  for (let attempt = 0; attempt <= KIWOOM_429_MAX_RETRIES; attempt += 1) {
    if (attempt > 0) {
      const retryDelay = KIWOOM_429_RETRY_DELAYS_MS[attempt - 1] ?? 4000
      await delay(retryDelay)
    } else {
      await kiwoomThrottleWait()
    }

    try {
      const data = await requestJson(method, path, options)
      markKiwoomCallFinished()
      return data
    } catch (error) {
      lastError = error
      if (isRateLimitError(error) && attempt < KIWOOM_429_MAX_RETRIES) {
        continue
      }
      markKiwoomCallFinished()
      throw error
    }
  }

  markKiwoomCallFinished()
  throw lastError
}
