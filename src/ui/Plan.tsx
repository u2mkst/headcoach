import { useState } from 'react'
import { userClub } from '../engine/helpers'
import {
  FOCUS_DESC,
  FOCUS_LABEL,
  FOCUS_ORDER,
  LEVEL_LABEL,
  LEVEL_ORDER,
  LINE_POS,
  planDelta,
} from '../engine/reinforce'
import type { GameState, MonthPlan, SpendFocus, SpendLevel } from '../engine/types'
import { Sheet } from './components'
import { lineInfos } from './derive'

export const planSummary = (p: MonthPlan | null) =>
  p ? `${FOCUS_LABEL[p.focus]} · ${LEVEL_LABEL[p.level]} (${p.focus === 'save' ? '+' : '-'}${Math.abs(planDelta(p))}억)` : '아직 정하지 않았어요'

/** "이번 달 전력 보강 예산, 어디에 쓸까요?" 한 줄 결정 시트 */
export function PlanSheet({
  state,
  onSave,
  onClose,
}: {
  state: GameState
  onSave: (plan: MonthPlan | null) => void
  onClose: () => void
}) {
  const budget = userClub(state).budget
  const lines = lineInfos(state)
  const [focus, setFocus] = useState<SpendFocus>(state.monthPlan?.focus ?? 'attack')
  const [level, setLevel] = useState<SpendLevel>(state.monthPlan?.level ?? 'medium')
  const lineOf = (f: SpendFocus) => lines.find((l) => l.pos === LINE_POS[f])
  const affordable = (l: SpendLevel) => focus === 'save' || -planDelta({ focus, level: l }) <= budget

  return (
    <Sheet onClose={onClose}>
      <div className="col">
        <h2 className="card-title" style={{ fontSize: 20 }}>
          이번 달 보강 예산, 어디에 쓸까요?
        </h2>
        <span className="label">내 예산 {Math.round(budget * 10) / 10}억 · 선택은 다음 달 진행과 함께 적용돼요</span>
      </div>
      <div className="list">
        {FOCUS_ORDER.map((f) => {
          const line = lineOf(f)
          return (
            <button key={f} className="option" style={{ padding: 12 }} aria-pressed={focus === f} onClick={() => setFocus(f)}>
              <div className="grow">
                <div className="title" style={{ fontSize: 15 }}>
                  {FOCUS_LABEL[f]}
                  {line && (
                    <span className="tag" style={{ marginLeft: 8 }}>
                      {line.label} {line.rank}위 · {line.rating}
                    </span>
                  )}
                </div>
                {focus === f && <div className="desc">{FOCUS_DESC[f]}</div>}
              </div>
              <span className="radio" />
            </button>
          )
        })}
      </div>
      <div className="chips">
        {LEVEL_ORDER.map((l) => {
          const d = planDelta({ focus, level: l })
          return (
            <button key={l} className="chip" aria-pressed={level === l} disabled={!affordable(l)} onClick={() => setLevel(l)} style={!affordable(l) ? { opacity: 0.4 } : undefined}>
              {LEVEL_LABEL[l]} {d > 0 ? `+${d}` : d}억
            </button>
          )
        })}
      </div>
      <div className="row">
        {state.monthPlan ? (
          <button className="btn ghost" style={{ flex: '0 0 112px' }} onClick={() => onSave(null)}>
            계획 취소
          </button>
        ) : (
          <button className="btn ghost" style={{ flex: '0 0 112px' }} onClick={onClose}>
            닫기
          </button>
        )}
        <button className="btn primary" style={{ flex: 1 }} disabled={!affordable(level)} onClick={() => onSave({ focus, level })}>
          결정
        </button>
      </div>
    </Sheet>
  )
}
