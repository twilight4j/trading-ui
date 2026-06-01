import { ApiError } from './api.js'

export const UNSELECTED_OPTION = '__UNSELECTED__'
export const NO_RULE = '__NO_RULE__'

export function declarativeRuleStableId(rule) {
  const raw = rule?.rule_id ?? rule?._id ?? rule?.id
  if (raw === null || raw === undefined) {
    return ''
  }
  const s = String(raw).trim()
  return s
}

/** GET /rules RuleRecord[] 에서 템플릿 옵션 생성 */
export function flattenDeclarativeRuleOptionsFromRulesList(flatRules, ruleTypeUpper) {
  const want = String(ruleTypeUpper || '').toUpperCase()
  const out = []
  if (!Array.isArray(flatRules)) {
    return out
  }
  const seen = new Set()
  for (const r of flatRules) {
    if (String(r?.type || '').toUpperCase() !== want) {
      continue
    }
    const rid = String(r?.rule_id || '').trim()
    if (!rid || seen.has(rid)) {
      continue
    }
    seen.add(rid)
    const label = String(r?.name || '').trim() || rid
    out.push({
      value: rid,
      label,
      rule: r,
      rule_id: rid,
    })
  }
  return out
}

export function normalizeOperator(op) {
  return String(op || '')
    .trim()
    .toLowerCase()
}

export function declarativeRulesRoughlyEqual(a, b) {
  if (!a || !b) {
    return false
  }
  return (
    String(a.base || '').trim() === String(b.base || '').trim() &&
    String(a.target || '').trim() === String(b.target || '').trim() &&
    Number(a.offset) === Number(b.offset) &&
    normalizeOperator(a.operator) === normalizeOperator(b.operator) &&
    String(a.sell_qty_mode || 'full').trim() === String(b.sell_qty_mode || 'full').trim()
  )
}

/** 활성 전략 임베드 규칙 한 축(templateOptions와 매칭) → select value */
export function resolveDeclarativeRuleSelectValueFromStrategy(strategyRules, templateOptions, ruleTypeUpper) {
  const ids = resolveDeclarativeRuleIdsFromStrategy(strategyRules, templateOptions, ruleTypeUpper)
  if (ids.length === 0) {
    return NO_RULE
  }
  if (ids.length === 1) {
    return ids[0]
  }
  return UNSELECTED_OPTION
}

/** 활성 전략 임베드 규칙 → rule_id 배열 (복수 선택 UI용) */
export function resolveDeclarativeRuleIdsFromStrategy(strategyRules, templateOptions, ruleTypeUpper) {
  const kind = String(ruleTypeUpper || '').toUpperCase()
  const typed = (Array.isArray(strategyRules) ? strategyRules : []).filter(
    (r) => String(r?.type || '').toUpperCase() === kind,
  )
  const ids = []
  for (const embedded of typed) {
    const eid = declarativeRuleStableId(embedded)
    if (eid) {
      const byId = templateOptions.find((o) => declarativeRuleStableId(o.rule) === eid)
      if (byId) {
        ids.push(byId.value)
        continue
      }
    }
    const byShape = templateOptions.find((o) => declarativeRulesRoughlyEqual(embedded, o.rule))
    if (byShape) {
      ids.push(byShape.value)
    }
  }
  return ids
}

/** POST/PATCH 규칙 본문: 백엔드 DeclarativeRule 과 필드 호환 (_id 포함) */
export function declarativeRuleToStrategyPayload(rule, ruleTypeUpper) {
  if (!rule || typeof rule !== 'object') {
    return null
  }
  const type = String(ruleTypeUpper || rule.type || '').toUpperCase()
  if (type !== 'STOP_LOSS' && type !== 'TAKE_PROFIT') {
    return null
  }
  const payload = {
    type,
    base: String(rule.base || '').trim(),
    target: String(rule.target || '').trim(),
    offset: Number(rule.offset),
    operator: normalizeOperator(rule.operator),
    name: String(rule.name || '').trim(),
  }
  const sellQtyMode = String(rule.sell_qty_mode || '').trim()
  if (sellQtyMode) {
    payload.sell_qty_mode = sellQtyMode
  }
  const oid = declarativeRuleStableId(rule)
  if (oid) {
    payload.rule_id = oid
  }
  return payload
}

/** 손절 먼저, 익절 다음 순서로 임베드 규칙 배열 생성 (복수 선택, 빈 배열 허용) */
export function assembleStrategyEmbeddedRulesFromMultiSelectors(
  stopLossRuleIds,
  takeProfitRuleIds,
  stopLossRuleOptions,
  takeProfitRuleOptions,
) {
  const rules = []
  const slIds = Array.isArray(stopLossRuleIds) ? stopLossRuleIds : []
  const tpIds = Array.isArray(takeProfitRuleIds) ? takeProfitRuleIds : []

  for (const ruleId of slIds) {
    const slPick = stopLossRuleOptions.find((o) => o.value === ruleId)
    if (!slPick) {
      continue
    }
    const sl = declarativeRuleToStrategyPayload(slPick.rule, 'STOP_LOSS')
    if (sl?.base && sl.operator) {
      rules.push(sl)
    }
  }
  for (const ruleId of tpIds) {
    const tpPick = takeProfitRuleOptions.find((o) => o.value === ruleId)
    if (!tpPick) {
      continue
    }
    const tp = declarativeRuleToStrategyPayload(tpPick.rule, 'TAKE_PROFIT')
    if (tp?.base && tp.operator) {
      rules.push(tp)
    }
  }
  return rules
}

/** @deprecated 단일 선택 UI 호환 — assembleStrategyEmbeddedRulesFromMultiSelectors 사용 권장 */
export function assembleStrategyEmbeddedRulesFromSelectors(
  simpleSellRule,
  simpleBuyRule,
  stopLossRuleOptions,
  takeProfitRuleOptions,
) {
  const stopLossRuleIds = simpleSellRule === NO_RULE ? [] : [simpleSellRule]
  const takeProfitRuleIds = simpleBuyRule === NO_RULE ? [] : [simpleBuyRule]
  return assembleStrategyEmbeddedRulesFromMultiSelectors(
    stopLossRuleIds.filter((id) => id && id !== UNSELECTED_OPTION),
    takeProfitRuleIds.filter((id) => id && id !== UNSELECTED_OPTION),
    stopLossRuleOptions,
    takeProfitRuleOptions,
  )
}

export function isMissingActiveStrategyError(error) {
  if (!(error instanceof ApiError)) {
    return false
  }
  return error.status === 404 || error.status === 400
}
