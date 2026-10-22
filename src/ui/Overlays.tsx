import { useEffect, useState } from 'react'
import { clubById } from '../data/clubs'
import { describeEvent } from '../engine/events'
import { computeStandings } from '../engine/season'
import type { EventOutcome, GameState, MatchResult, PendingEvent } from '../engine/types'
import { BottomBar, Crest, Icon } from './components'
import { resultOf } from './derive'

const STATUS = ['선발 명단을 확인하고 있어요', '킥오프!', '전반전이 진행 중이에요', '후반전이 진행 중이에요', '경기가 끝났어요']

export function Progress({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    if (i >= STATUS.length - 1) {
      const t = setTimeout(onDone, reduce ? 200 : 700)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setI(i + 1), reduce ? 150 : 750)
    return () => clearTimeout(t)
  }, [i, onDone, reduce])
  return (
    <div className="overlay center" role="status" aria-live="polite">
      <div className="inner" style={{ justifyContent: 'center', gap: 24 }}>
        <p className="status-line">{STATUS[i]}</p>
        <div className="bar thin" aria-hidden="true">
          <i style={{ width: `${((i + 1) / STATUS.length) * 100}%` }} />
        </div>
        <BottomBar>
          <button className="btn text" onClick={onDone}>
            건너뛰기
          </button>
        </BottomBar>
      </div>
    </div>
  )
}

export function ResultScreen({ state, onContinue }: { state: GameState; onContinue: () => void }) {
  const uid = state.userClubId as string
  const round = state.lastRound ?? []
  const mine = round.find((r) => r.home === uid || r.away === uid) as MatchResult
  const { gf, ga, kind } = resultOf(mine, uid)
  const ids = Object.keys(state.clubs)
  const before = computeStandings(state.results.filter((r) => r.round < mine.round), ids)
  const after = computeStandings(state.results, ids)
  const rankBefore = before.findIndex((x) => x.clubId === uid) + 1
  const rankAfter = after.findIndex((x) => x.clubId === uid) + 1
  const rankDiff = rankBefore - rankAfter
  const others = round.filter((r) => r !== mine)
  const headline = kind === 'w' ? '승리했어요' : kind === 'd' ? '비겼어요' : '졌어요'
  const myScorers = mine.scorers.filter((s) => s.clubId === uid)

  return (
    <div className="overlay">
      <div className="inner">
        <div className="steps" style={{ height: 'auto' }}>
          <span className="tag">
            {mine.round}라운드 · {mine.home === uid ? '홈' : '원정'}
          </span>
        </div>
        <h1 className="question" style={{ fontSize: 26 }}>
          {headline}
        </h1>

        <section className="card stack">
          <div className="versus">
            <div className="team">
              <Crest clubId={mine.home} size={48} />
              <span>{clubById(mine.home).short}</span>
            </div>
            <div className="score">
              {mine.hg}:{mine.ag}
            </div>
            <div className="team">
              <Crest clubId={mine.away} size={48} />
              <span>{clubById(mine.away).short}</span>
            </div>
          </div>
        </section>

        <section className="card stack" aria-label="주요 기록">
          <h2 className="card-title">주요 기록</h2>
          <div>
            <div className="stat-row">
              <span className="l tnum">{mine.possession}%</span>
              <span className="mid">점유율</span>
              <span className="r tnum">{100 - mine.possession}%</span>
            </div>
            <div className="pbar" aria-hidden="true">
              <i style={{ width: `${mine.possession}%` }} />
            </div>
          </div>
          <div className="stat-row">
            <span className="l tnum">{mine.shotsHome}</span>
            <span className="mid">슈팅</span>
            <span className="r tnum">{mine.shotsAway}</span>
          </div>
          <div className="row between">
            <span className="label">순위</span>
            <b>
              {rankAfter}위{' '}
              {mine.round > 1 && rankDiff > 0 && <span className="up">▲{rankDiff}</span>}
              {mine.round > 1 && rankDiff < 0 && <span className="muted">▼{-rankDiff}</span>}
            </b>
          </div>
          <div className="row between">
            <span className="label">내 득점</span>
            <b>
              {gf}골 {ga === 0 && <span className="tag accent">무실점</span>}
              {myScorers.length > 0 && myScorers.length !== new Set(myScorers.map((s) => s.playerId)).size && (
                <span className="tag gold">멀티골</span>
              )}
            </b>
          </div>
        </section>

        <details className="card accordion">
          <summary className="row between">
            <h2 className="card-title">다른 경기 결과</h2>
            <Icon name="chevron" className="chev" />
          </summary>
          <div className="stack" style={{ marginTop: 12, gap: 10 }}>
            {others.map((r, i) => (
              <div key={i} className="row between" style={{ fontSize: 14 }}>
                <span className="grow">{clubById(r.home).short}</span>
                <b className="tnum">
                  {r.hg} : {r.ag}
                </b>
                <span className="grow" style={{ textAlign: 'right' }}>
                  {clubById(r.away).short}
                </span>
              </div>
            ))}
          </div>
        </details>

        <BottomBar>
          <button className="btn primary" onClick={onContinue}>
            계속
          </button>
        </BottomBar>
      </div>
    </div>
  )
}

export function EventScreen({
  event,
  onChoose,
  onLater,
}: {
  event: PendingEvent
  onChoose: (choiceId: string) => void
  onLater: () => void
}) {
  const view = describeEvent(event)
  const [picked, setPicked] = useState('')
  return (
    <div className="overlay">
      <div className="inner">
        <div>
          <span className="tag accent">{view.tag}</span>
        </div>
        <h1 className="question">{view.title}</h1>
        <p className="hint" style={{ fontSize: 15, color: 'var(--ink)' }}>
          {view.body}
        </p>
        <div className="list" style={{ marginTop: 8 }}>
          {view.choices.map((c) => (
            <button key={c.id} className="option" aria-pressed={picked === c.id} onClick={() => setPicked(c.id)}>
              <div className="grow">
                <div className="title" style={{ fontSize: 15 }}>
                  {c.label}
                </div>
                <div className="desc">{c.hint}</div>
              </div>
              <span className="radio" />
            </button>
          ))}
        </div>
        <BottomBar>
          <button className="btn ghost" style={{ flex: '0 0 104px' }} onClick={onLater}>
            나중에
          </button>
          <button className="btn primary" disabled={!picked} onClick={() => onChoose(picked)}>
            결정
          </button>
        </BottomBar>
      </div>
    </div>
  )
}

export function EventResultScreen({ outcome, onContinue }: { outcome: EventOutcome; onContinue: () => void }) {
  const tone = outcome.tone === 'good' ? '좋은 결과' : outcome.tone === 'bad' ? '아쉬운 결과' : '결과'
  return (
    <div className="overlay">
      <div className="inner">
        <div>
          <span className={`tag ${outcome.tone === 'good' ? 'accent' : ''}`}>{tone}</span>
        </div>
        <h1 className="question">{outcome.title}</h1>
        <section className="card stack">
          <div className="label">선택: {outcome.choiceLabel}</div>
          <p style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.5 }}>{outcome.text}</p>
          {outcome.effects.length > 0 && (
            <div className="chips">
              {outcome.effects.map((e, i) => (
                <span key={i} className={`tag ${!e.includes('-') && e.includes('+') ? 'accent' : ''}`}>
                  {e}
                </span>
              ))}
            </div>
          )}
        </section>
        <BottomBar>
          <button className="btn primary" onClick={onContinue}>
            계속
          </button>
        </BottomBar>
      </div>
    </div>
  )
}

