import { useEffect, useState } from 'react'
import { clubById } from '../data/clubs'
import { describeEvent } from '../engine/events'
import type { EventOutcome, MatchResult, MonthReport, PendingEvent } from '../engine/types'
import { Bar, BottomBar, Crest } from './components'
import { KIND_LABEL, resultOf } from './derive'
import { Delta } from './Home'

const STATUS = ['이번 달 보강과 훈련을 마무리하고 있어요', '경기가 진행 중이에요', '팬 커뮤니티 반응을 모으고 있어요', '한 달이 지났어요']

export function Progress({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0)
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    if (i >= STATUS.length - 1) {
      const t = setTimeout(onDone, reduce ? 200 : 700)
      return () => clearTimeout(t)
    }
    const t = setTimeout(() => setI(i + 1), reduce ? 150 : 800)
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

const MOOD_LABEL = { good: '좋은 반응', bad: '쓴소리', neutral: '지켜보는 중' } as const

/** 한 달이 끝난 뒤 보여주는 보고서: 결과 → 순위·신뢰 → 지지도 → 커뮤니티 베스트 */
export function MonthReportScreen({ report, clubId, onContinue }: { report: MonthReport; clubId: string; onContinue: () => void }) {
  const net = report.w - report.l
  const headline = net >= 2 ? '좋은 한 달이었어요' : net <= -2 ? '힘든 한 달이었어요' : '무난한 한 달이었어요'
  const rankDiff = report.rankBefore - report.rankAfter
  const f = report.fanAfter
  const fb = report.fanBefore
  const gd = report.gf - report.ga
  return (
    <div className="overlay">
      <div className="inner">
        <div>
          <span className="tag">
            {report.season}시즌 · {report.label} 결산
          </span>
        </div>
        <h1 className="question" style={{ fontSize: 26 }}>
          {headline}
        </h1>

        <section className="card flush">
          {report.results.map((r) => (
            <MatchRow key={r.round} r={r} clubId={clubId} />
          ))}
          <div className="divider" />
          <div className="row between" style={{ padding: '12px 20px' }}>
            <b>
              {report.w}승 {report.d}무 {report.l}패
            </b>
            <span className="label tnum">
              {report.gf}득점 {report.ga}실점 ({gd > 0 ? `+${gd}` : gd})
            </span>
          </div>
        </section>

        <section className="card stack" aria-label="이번 달 변화">
          {report.rankBefore > 0 && (
            <div className="row between">
              <span className="label">순위</span>
              <b>
                {report.rankBefore}위 → {report.rankAfter}위{' '}
                {rankDiff > 0 && <span className="up">▲{rankDiff}</span>}
                {rankDiff < 0 && <span className="muted">▼{-rankDiff}</span>}
              </b>
            </div>
          )}
          {report.rankBefore === 0 && (
            <div className="row between">
              <span className="label">순위</span>
              <b>{report.rankAfter}위</b>
            </div>
          )}
          <div className="row between">
            <span className="label">구단주 신뢰</span>
            <b>
              {report.trustDelta > 0 ? <span className="up">▲{report.trustDelta}</span> : report.trustDelta < 0 ? <span className="muted">▼{-report.trustDelta}</span> : '-'}
            </b>
          </div>
          {report.planLine && (
            <div className="row between">
              <span className="label">보강</span>
              <b style={{ textAlign: 'right' }}>{report.planLine}</b>
            </div>
          )}
          {report.newInjuries > 0 && (
            <div className="row between">
              <span className="label">부상</span>
              <b>{report.newInjuries}명 발생</b>
            </div>
          )}
        </section>

        <section className="card stack" aria-label="팬 지지도">
          <div className="row between" style={{ alignItems: 'flex-end' }}>
            <div className="col">
              <h2 className="card-title">팬 지지도</h2>
              <span className="big tnum">{Math.round(f.support)}%</span>
            </div>
            <b className="tnum" style={{ fontSize: 20 }}>
              <Delta v={f.support - fb.support} />
            </b>
          </div>
          <Bar value={f.support} />
          <div className="row between">
            <span className="label">성적 만족</span>
            <b className="tnum">
              {Math.round(f.results)}% <Delta v={f.results - fb.results} />
            </b>
          </div>
          <div className="row between">
            <span className="label">스타일 만족</span>
            <b className="tnum">
              {Math.round(f.style)}% <Delta v={f.style - fb.style} />
            </b>
          </div>
        </section>

        <section className="card flush" aria-label="커뮤니티 베스트">
          <h2 className="card-title" style={{ padding: '14px 20px 4px' }}>
            커뮤니티 베스트
          </h2>
          {report.highlights.map((h, i) => (
            <div key={i} className="feed-item">
              <div className="feed-source">
                <span>{h.nick}</span>
                <span className="tag" style={{ height: 20, marginLeft: 'auto' }}>
                  {MOOD_LABEL[h.mood]}
                </span>
              </div>
              <p className="feed-text">{h.text}</p>
              <span className="label">♥ {h.likes}</span>
            </div>
          ))}
          <p className="notice">가상 반응이에요. 전체 글은 반응 탭에서 볼 수 있어요.</p>
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

function MatchRow({ r, clubId }: { r: MatchResult; clubId: string }) {
  const { kind } = resultOf(r, clubId)
  const side = (id: string) => ({ fontWeight: id === clubId ? 800 : 500, color: id === clubId ? 'var(--ink)' : 'var(--muted)' })
  return (
    <div className="item">
      <span className="label tnum" style={{ width: 28 }}>
        {r.comp === 'ucl' ? 'CL' : `${r.round}R`}
      </span>
      <Crest clubId={r.home} size={26} />
      <span className="grow ellipsis" style={side(r.home)}>
        {clubById(r.home).short}
      </span>
      <b className="tnum" style={{ flex: 'none' }}>
        {r.hg} : {r.ag}
      </b>
      <span className="grow ellipsis" style={{ ...side(r.away), textAlign: 'right' }}>
        {clubById(r.away).short}
      </span>
      <Crest clubId={r.away} size={26} />
      <span className={`tag ${kind === 'w' ? 'accent' : ''}`} style={{ width: 28, justifyContent: 'center', padding: 0 }}>
        {r.pens ? (r.pens === (r.home === clubId ? 'h' : 'a') ? '승' : '패') : KIND_LABEL[kind]}
      </span>
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

