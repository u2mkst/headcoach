import { useState } from 'react'
import { clubById } from '../data/clubs'
import { setMonthPlan, setTactics } from '../engine/game'
import { userClub } from '../engine/helpers'
import { FOCUS_LABEL, LINE_POS, planScale } from '../engine/reinforce'
import { EXPOSURE_AFTER, nextTacticMemory } from '../engine/season'
import {
  FORMATION_IDS,
  LEVEL_LABEL,
  PHILOSOPHY_DESC,
  PHILOSOPHY_LABEL,
} from '../engine/squad'
import type { GameState, Level, Philosophy } from '../engine/types'
import { Bar, Segmented } from './components'
import { currentMonthLabel, lineInfos, MATCHUP_LABEL, matchupOf, monthFixtures } from './derive'
import { PlanSheet, planSummary } from './Plan'

type Sub = 'tactics' | 'power' | 'plan'
const PHILOSOPHIES: Philosophy[] = ['attack', 'possession', 'defense', 'counter']
const LEVELS: Level[] = ['low', 'mid', 'high']

export function SquadTab({
  state,
  onChange,
  toast,
}: {
  state: GameState
  onChange: (s: GameState) => void
  toast: (m: string) => void
}) {
  const [sub, setSub] = useState<Sub>('tactics')
  return (
    <div className="screen">
      <h1 className="screen-title">선수단</h1>
      <Segmented
        value={sub}
        onChange={setSub}
        options={[
          { id: 'tactics', label: '전술' },
          { id: 'power', label: '전력' },
          { id: 'plan', label: '보강' },
        ]}
      />
      {sub === 'tactics' && <Tactics state={state} onChange={onChange} />}
      {sub === 'power' && <Power state={state} />}
      {sub === 'plan' && <Plan state={state} onChange={onChange} toast={toast} />}
    </div>
  )
}

function Tactics({ state, onChange }: { state: GameState; onChange: (s: GameState) => void }) {
  const t = state.tactics
  const fixtures = monthFixtures(state)
  const preview = nextTacticMemory(state.tacticMemory, t)
  const warn = preview.streak >= EXPOSURE_AFTER
  return (
    <>
      <section className="card stack">
        <h2 className="card-title">철학</h2>
        <div className="philo-grid">
          {PHILOSOPHIES.map((p) => (
            <button key={p} className="option" aria-pressed={t.philosophy === p} onClick={() => onChange(setTactics(state, { philosophy: p }))}>
              <span className="title">{PHILOSOPHY_LABEL[p]}</span>
              <span className="desc">{PHILOSOPHY_DESC[p]}</span>
            </button>
          ))}
        </div>
        <div className="cycle" aria-label="철학 상성">
          {(['attack', 'defense', 'possession', 'counter', 'attack'] as Philosophy[]).map((p, i) => (
            <span key={i} style={{ display: 'inline-flex', gap: 4 }}>
              {i > 0 && <span>→</span>}
              {PHILOSOPHY_LABEL[p]}
            </span>
          ))}
          <span>· 앞이 뒤에 강해요</span>
        </div>
        {fixtures.length > 0 && (
          <div className="stack" style={{ gap: 6, background: 'var(--bg)', borderRadius: 12, padding: '10px 14px' }}>
            <span className="label">{currentMonthLabel(state)} 상대</span>
            {fixtures.map((f) => {
              const opp = state.clubs[f.oppId]
              return (
                <div key={f.round} className="row between">
                  <span style={{ fontWeight: 600 }}>
                    {clubById(f.oppId).short} <span className="label">{PHILOSOPHY_LABEL[opp.philosophy]} 성향</span>
                  </span>
                  <span className="tag accent">{MATCHUP_LABEL[matchupOf(t.philosophy, opp.philosophy)]}</span>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <section className="card stack">
        <h2 className="card-title">포메이션</h2>
        <div className="chips">
          {FORMATION_IDS.map((f) => (
            <button key={f} className="chip" aria-pressed={t.formation === f} onClick={() => onChange(setTactics(state, { formation: f }))}>
              {f}
            </button>
          ))}
        </div>
        <div className="row between">
          <span>압박</span>
          <div className="chips">
            {LEVELS.map((l) => (
              <button key={l} className="chip" aria-pressed={t.pressing === l} onClick={() => onChange(setTactics(state, { pressing: l }))}>
                {LEVEL_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
        <div className="row between">
          <span>수비 라인</span>
          <div className="chips">
            {LEVELS.map((l) => (
              <button key={l} className="chip" aria-pressed={t.line === l} onClick={() => onChange(setTactics(state, { line: l }))}>
                {LEVEL_LABEL[l]}
              </button>
            ))}
          </div>
        </div>
        <span className="label">압박이 높을수록 컨디션이 빨리 닳고, 라인이 높을수록 역습에 취약해요.</span>
      </section>

      <section className="card stack">
        <h2 className="card-title">숙련도와 노출</h2>
        <div className="stack" style={{ gap: 6 }}>
          <div className="row between">
            <span className="label">{PHILOSOPHY_LABEL[t.philosophy]} 숙련도</span>
            <b className="tnum">{preview.familiarity}%</b>
          </div>
          <Bar value={preview.familiarity} />
          <span className="label">같은 철학을 쓰면 경기마다 오르고, 바꾸면 크게 떨어져요.</span>
        </div>
        <div className="stack" style={{ gap: 6 }}>
          <div className="row between">
            <span className="label">같은 설정 연속</span>
            <b className="tnum">
              {preview.streak}경기째 {warn && <span className="tag alert">노출 중</span>}
            </b>
          </div>
          <Bar value={(Math.min(preview.streak, EXPOSURE_AFTER) / EXPOSURE_AFTER) * 100} />
          <span className="label">
            철학·포메이션·압박·수비 라인이 모두 같은 채로 {EXPOSURE_AFTER}경기를 이어 쓰면 상대가 대응해 전력이 떨어져요.
          </span>
        </div>
      </section>
    </>
  )
}


function Power({ state }: { state: GameState }) {
  const lines = lineInfos(state)
  const club = userClub(state)
  const weakest = [...lines].filter((l) => l.pos !== 'GK').sort((a, b) => b.rank - a.rank || a.rating - b.rating)[0]
  const young = club.squad.filter((p) => p.age <= 21).length
  const old = club.squad.filter((p) => p.age >= 31).length
  return (
    <>
      <section className="card stack">
        <h2 className="card-title">라인별 전력</h2>
        <p className="label">숫자는 주전 능력치 평균, 순위는 리그 10개 구단 중 위치예요.</p>
        {lines.map((l) => (
          <div key={l.pos} className="stack" style={{ gap: 6 }}>
            <div className="row between">
              <b>
                {l.label} <span className="muted" style={{ fontWeight: 500 }}>{l.count}명</span>
              </b>
              <span className="row" style={{ gap: 8 }}>
                <b className="tnum">{l.rating}</b>
                <span className={`tag ${l.rank <= 3 ? 'accent' : ''}`}>{l.rank}위</span>
              </span>
            </div>
            <Bar value={((l.rating - 40) / 50) * 100} thin />
            <div className="row between">
              <span className="label">
                컨디션 {l.condition} · 사기 {l.morale}
              </span>
              <span className="label">
                {l.injured > 0 && <span className="tag alert" style={{ marginRight: 6 }}>부상 {l.injured}</span>}
                평균 {l.avgAge}세
              </span>
            </div>
          </div>
        ))}
      </section>
      <section className="card stack">
        <h2 className="card-title">선수단 한눈에</h2>
        <div className="row between">
          <span className="label">선수 수</span>
          <b>{club.squad.length}명</b>
        </div>
        <div className="row between">
          <span className="label">21세 이하</span>
          <b>{young}명</b>
        </div>
        <div className="row between">
          <span className="label">31세 이상</span>
          <b>{old}명</b>
        </div>
        {weakest && (
          <p className="label" style={{ color: 'var(--ink)' }}>
            가장 약한 라인은 <b>{weakest.label}</b>({weakest.rank}위)이에요. 보강 탭에서 예산을 쓸 수 있어요.
          </p>
        )}
      </section>
    </>
  )
}

function Plan({ state, onChange, toast }: { state: GameState; onChange: (s: GameState) => void; toast: (m: string) => void }) {
  const [open, setOpen] = useState(false)
  const club = userClub(state)
  const plan = state.monthPlan
  return (
    <>
      <section className="card stack">
        <div className="col">
          <span className="label">내 예산</span>
          <span className="big tnum">{Math.round(club.budget * 10) / 10}억</span>
        </div>
        <div className="divider" style={{ margin: 0 }} />
        <div className="col">
          <span className="label">{currentMonthLabel(state)} 보강 계획</span>
          <b style={{ color: plan ? 'var(--ink)' : 'var(--muted)' }}>{planSummary(plan, planScale(state))}</b>
        </div>
        <button className="btn primary block" onClick={() => setOpen(true)}>
          {plan ? '계획 바꾸기' : '쓸 곳 정하기'}
        </button>
        <span className="label">계획은 다음 달 진행과 함께 적용돼요. 한 번 쓴 예산은 돌려받을 수 없어요.</span>
      </section>
      <section className="card stack">
        <h2 className="card-title">어디에 쓰면 좋을까요?</h2>
        {(['attack', 'midfield', 'defense', 'keeper'] as const).map((f) => {
          const l = lineInfos(state).find((x) => x.pos === LINE_POS[f])
          return (
            <div key={f} className="row between">
              <span>{FOCUS_LABEL[f]}</span>
              <span className="label">
                {l?.label} {l?.rank}위 · {l?.rating}
              </span>
            </div>
          )
        })}
        <p className="label">투자는 팬 지지도를 올리고, 아끼면 구단주 신뢰가 올라요. 팬과 구단주의 마음을 함께 봐야 해요.</p>
      </section>
      {open && (
        <PlanSheet
          state={state}
          onClose={() => setOpen(false)}
          onSave={(p) => {
            const [next, err] = setMonthPlan(state, p)
            if (err) toast(err)
            else {
              onChange(next)
              toast(p ? '보강 계획을 정했어요' : '보강 계획을 취소했어요')
            }
            setOpen(false)
          }}
        />
      )}
    </>
  )
}
