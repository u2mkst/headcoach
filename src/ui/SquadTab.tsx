import { useState } from 'react'
import { clubById } from '../data/clubs'
import { buyPlayer, buyPrice, resetLineup, sellPlayer, sellPrice, setTactics, swapStarter } from '../engine/game'
import { userClub } from '../engine/helpers'
import { copula, josa } from '../engine/josa'
import { EXPOSURE_AFTER, nextTacticMemory } from '../engine/season'
import {
  FORMATION_IDS,
  LEVEL_LABEL,
  PHILOSOPHY_BEATS,
  PHILOSOPHY_DESC,
  PHILOSOPHY_LABEL,
  POS_LABEL,
  resolveLineup,
} from '../engine/squad'
import type { GameState, Level, Philosophy, Player, Position } from '../engine/types'
import { Bar, Segmented, Sheet } from './components'
import { MATCHUP_LABEL, matchupOf, nextFixture } from './derive'

type Sub = 'tactics' | 'lineup' | 'players' | 'market'
const POS_ORDER: Position[] = ['GK', 'DF', 'MF', 'FW']
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
          { id: 'lineup', label: '선발' },
          { id: 'players', label: '선수' },
          { id: 'market', label: '이적' },
        ]}
      />
      {sub === 'tactics' && <Tactics state={state} onChange={onChange} />}
      {sub === 'lineup' && <Lineup state={state} onChange={onChange} />}
      {sub === 'players' && <Players state={state} onChange={onChange} toast={toast} />}
      {sub === 'market' && <Market state={state} onChange={onChange} toast={toast} />}
    </div>
  )
}

function Tactics({ state, onChange }: { state: GameState; onChange: (s: GameState) => void }) {
  const t = state.tactics
  const next = nextFixture(state)
  const opp = next ? state.clubs[next.oppId] : null
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
        {opp && (
          <div className="row between" style={{ background: 'var(--bg)', borderRadius: 12, padding: '10px 14px' }}>
            <span className="label">
              다음 상대 {clubById(opp.id).short} · {PHILOSOPHY_LABEL[opp.philosophy]}
            </span>
            <span className="tag accent">{MATCHUP_LABEL[matchupOf(t.philosophy, opp.philosophy)]}</span>
          </div>
        )}
        {opp && PHILOSOPHY_BEATS[t.philosophy] !== opp.philosophy && (
          <span className="label">
            {PHILOSOPHY_LABEL[opp.philosophy]}에 강한 철학은{' '}
            {copula(PHILOSOPHY_LABEL[(Object.keys(PHILOSOPHY_BEATS) as Philosophy[]).find((p) => PHILOSOPHY_BEATS[p] === opp.philosophy) as Philosophy])}.
          </span>
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

function CondBar({ v }: { v: number }) {
  return (
    <div className="condbar" title={`컨디션 ${Math.round(v)}`}>
      <i style={{ width: `${v}%`, background: v < 55 ? 'var(--gold)' : 'var(--accent)' }} />
    </div>
  )
}

function Lineup({ state, onChange }: { state: GameState; onChange: (s: GameState) => void }) {
  const club = userClub(state)
  const lineup = resolveLineup(club.squad, state.tactics.formation, state.manualLineup)
  const ids = lineup.map((p) => p.id)
  const [swapping, setSwapping] = useState<Player | null>(null)
  const candidates = swapping
    ? club.squad.filter((p) => p.pos === swapping.pos && p.id !== swapping.id && !ids.includes(p.id) && p.injuredRounds === 0)
    : []
  return (
    <>
      <section className="card flush">
        {POS_ORDER.map((pos) =>
          lineup
            .filter((p) => p.pos === pos)
            .map((p) => (
              <button key={p.id} className="item" onClick={() => setSwapping(p)}>
                <span className="pos">{pos}</span>
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  <div className="label">
                    {p.age}세 · 사기 {Math.round(p.morale)}
                  </div>
                </div>
                <CondBar v={p.condition} />
                <div className="ovr">{p.ovr}</div>
              </button>
            )),
        )}
      </section>
      <p className="label" style={{ padding: '0 4px' }}>
        {state.manualLineup ? '직접 고른 선발이에요.' : '컨디션을 보고 자동으로 뽑은 선발이에요.'} 선수를 눌러 같은 포지션끼리 바꿀 수 있어요.
      </p>
      {state.manualLineup && (
        <button className="btn secondary block" onClick={() => onChange(resetLineup(state))}>
          자동 선발로 되돌리기
        </button>
      )}
      {swapping && (
        <Sheet onClose={() => setSwapping(null)}>
          <h2 className="card-title">{swapping.name} 대신 누구를 뛰게 할까요?</h2>
          {candidates.length === 0 && <p className="empty">바꿀 수 있는 선수가 없어요</p>}
          <div className="list">
            {candidates.map((c) => (
              <button
                key={c.id}
                className="option"
                onClick={() => {
                  onChange(swapStarter(state, swapping.id, c.id, ids))
                  setSwapping(null)
                }}
              >
                <span className="pos">{c.pos}</span>
                <div className="grow">
                  <div className="title" style={{ fontSize: 15 }}>
                    {c.name}
                  </div>
                  <div className="desc">
                    {c.age}세 · 컨디션 {Math.round(c.condition)} · 사기 {Math.round(c.morale)}
                  </div>
                </div>
                <div className="ovr">{c.ovr}</div>
              </button>
            ))}
          </div>
          <button className="btn ghost block" onClick={() => setSwapping(null)}>
            닫기
          </button>
        </Sheet>
      )}
    </>
  )
}

function Players({ state, onChange, toast }: { state: GameState; onChange: (s: GameState) => void; toast: (m: string) => void }) {
  const club = userClub(state)
  const [open, setOpen] = useState<string | null>(null)
  const [selling, setSelling] = useState<Player | null>(null)
  const sorted = [...club.squad].sort((a, b) => POS_ORDER.indexOf(a.pos) - POS_ORDER.indexOf(b.pos) || b.ovr - a.ovr)
  return (
    <>
      <section className="card flush">
        {sorted.map((p) => (
          <div key={p.id}>
            <button className="item" onClick={() => setOpen(open === p.id ? null : p.id)} aria-expanded={open === p.id}>
              <span className="pos">{p.pos}</span>
              <div className="grow">
                <div style={{ fontWeight: 600 }}>
                  {p.name}{' '}
                  {p.injuredRounds > 0 && <span className="tag alert">부상 {p.injuredRounds}R</span>}
                  {p.age <= 21 && <span className="tag">유망주</span>}
                </div>
                <div className="label">
                  {p.age}세 · 사기 {Math.round(p.morale)}
                </div>
              </div>
              <CondBar v={p.condition} />
              <div className="ovr">{p.ovr}</div>
            </button>
            {open === p.id && (
              <div className="stack" style={{ padding: '4px 20px 16px', background: 'var(--surface)' }}>
                <div className="row between">
                  <span className="label">{POS_LABEL[p.pos]}</span>
                  <span className="label">
                    잠재력 {p.pot} · 계약 {p.contractYears}년
                  </span>
                </div>
                <div className="row between">
                  <span className="label">이번 시즌</span>
                  <b>
                    {p.seasonApps}경기 {p.seasonGoals}골
                  </b>
                </div>
                <div className="row between">
                  <span className="label">통산</span>
                  <b>
                    {p.careerApps}경기 {p.careerGoals}골
                  </b>
                </div>
                <button className="btn small secondary" onClick={() => setSelling(p)}>
                  이적 등록 (+{sellPrice(p)}억)
                </button>
              </div>
            )}
          </div>
        ))}
      </section>
      {selling && (
        <Sheet onClose={() => setSelling(null)}>
          <h2 className="card-title">{josa(selling.name, '을/를')} 보낼까요?</h2>
          <p className="label">이적료 {sellPrice(selling)}억이 예산에 들어와요. 되돌릴 수 없어요.</p>
          <div className="row">
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setSelling(null)}>
              취소
            </button>
            <button
              className="btn primary"
              style={{ flex: 1 }}
              onClick={() => {
                const [next, err] = sellPlayer(state, selling.id)
                if (err) toast(err)
                else {
                  onChange(next)
                  toast(`${selling.name} 이적 완료`)
                }
                setSelling(null)
                setOpen(null)
              }}
            >
              보내기
            </button>
          </div>
        </Sheet>
      )}
    </>
  )
}

function Market({ state, onChange, toast }: { state: GameState; onChange: (s: GameState) => void; toast: (m: string) => void }) {
  const club = userClub(state)
  const [buying, setBuying] = useState<Player | null>(null)
  return (
    <>
      <section className="card row between">
        <div className="col">
          <span className="label">내 예산</span>
          <span className="big tnum">{Math.round(club.budget * 10) / 10}억</span>
        </div>
        <span className="tag">선수단 {club.squad.length}/30</span>
      </section>
      <section className="card flush">
        {state.market.map((p) => (
          <button key={p.id} className="item" onClick={() => setBuying(p)}>
            <span className="pos">{p.pos}</span>
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div className="label">
                {p.age}세 · 잠재력 {p.pot} · {buyPrice(state, p)}억
              </div>
            </div>
            <div className="ovr">{p.ovr}</div>
          </button>
        ))}
        {state.market.length === 0 && <p className="empty">시장에 나온 선수가 없어요</p>}
      </section>
      <p className="notice">이적 시장은 4라운드마다, 그리고 오프시즌에 새로 바뀌어요.</p>
      {buying && (
        <Sheet onClose={() => setBuying(null)}>
          <h2 className="card-title">{buying.name} 영입</h2>
          <div className="stack">
            <div className="row between">
              <span className="label">포지션</span>
              <b>{POS_LABEL[buying.pos]}</b>
            </div>
            <div className="row between">
              <span className="label">능력치 / 잠재력</span>
              <b>
                {buying.ovr} / {buying.pot}
              </b>
            </div>
            <div className="row between">
              <span className="label">영입 비용</span>
              <b>{buyPrice(state, buying)}억</b>
            </div>
          </div>
          <div className="row">
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setBuying(null)}>
              취소
            </button>
            <button
              className="btn primary"
              style={{ flex: 1 }}
              onClick={() => {
                const [next, err] = buyPlayer(state, buying.id)
                if (err) toast(err)
                else {
                  onChange(next)
                  toast(`${buying.name} 영입 완료`)
                }
                setBuying(null)
              }}
            >
              영입하기
            </button>
          </div>
        </Sheet>
      )}
    </>
  )
}

