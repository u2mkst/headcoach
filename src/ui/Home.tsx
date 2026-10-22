import { clubById, competitionById } from '../data/clubs'
import { describeEvent } from '../engine/events'
import { EXPOSURE_AFTER } from '../engine/season'
import { LEVEL_LABEL as TACTIC_LEVEL, PHILOSOPHY_LABEL, playerLabel } from '../engine/squad'
import { userClub } from '../engine/helpers'
import type { GameState } from '../engine/types'
import { Bar, Chevron, CompetitionLogo, Crest, FormDots } from './components'
import { currentMonthLabel, MATCHUP_LABEL, matchupOf, monthClFixtures, monthFixtures, standingsOf, userRank, userResults } from './derive'
import { planSummary } from './Plan'
import { planScale } from '../engine/reinforce'
import type { TabId } from './App'

export const Delta = ({ v }: { v: number }) => {
  const r = Math.round(v)
  if (r === 0) return <span className="muted">-</span>
  return r > 0 ? <span className="up">▲{r}</span> : <span className="muted">▼{-r}</span>
}

export function Home({
  state,
  onPlay,
  onOpenEvent,
  onGo,
  onPlan,
  onDismissReport,
}: {
  state: GameState
  onPlay: () => void
  onOpenEvent: (uid: string) => void
  onGo: (tab: TabId) => void
  onPlan: () => void
  onDismissReport: () => void
}) {
  const uid = state.userClubId as string
  const club = clubById(uid)
  const table = standingsOf(state)
  const rank = userRank(state)
  const row = table.find((x) => x.clubId === uid)
  const fixtures = monthFixtures(state)
  const clFixtures = monthClFixtures(state)
  const sim = userClub(state)
  const injured = sim.squad.filter((p) => p.injuredRounds > 0)
  const streak = state.tacticMemory.streak
  const trust = Math.round(state.ownerTrust)
  const fan = state.fan
  const rep = state.monthReport && state.monthReport.season === state.season ? state.monthReport : null
  const t = state.tactics
  const monthLabel = currentMonthLabel(state)

  const todos: { key: string; label: string; sub: string; onClick: () => void }[] = []
  for (const ev of state.events) {
    const v = describeEvent(ev)
    todos.push({ key: ev.uid, label: v.title, sub: v.tag, onClick: () => onOpenEvent(ev.uid) })
  }
  if (streak >= EXPOSURE_AFTER - 1) {
    todos.push({
      key: 'exposure',
      label: `같은 전술 ${streak}경기째`,
      sub: streak >= EXPOSURE_AFTER ? '상대가 대응하기 시작했어요' : '이대로면 곧 상대가 대응해요',
      onClick: () => onGo('squad'),
    })
  }
  if (injured.length) {
    todos.push({
      key: 'injured',
      label: `부상 선수 ${injured.length}명`,
      sub: injured.map((p) => playerLabel(p)).slice(0, 3).join(', '),
      onClick: () => onGo('squad'),
    })
  }

  return (
    <div className="screen">
      <div className="row between" style={{ padding: '4px 4px 0' }}>
        <h1 className="screen-title" style={{ padding: 0 }}>
          홈
        </h1>
        <span className="tag accent">
          {state.season}시즌 · {monthLabel}
        </span>
      </div>

      {state.offseasonReport && (
        <section className="card stack" aria-label="오프시즌 소식">
          <div className="row between">
            <h2 className="card-title">{state.season}시즌 준비 소식</h2>
            <button className="btn small ghost" onClick={onDismissReport}>
              닫기
            </button>
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {state.offseasonReport.map((l, i) => (
              <li key={i} className="label" style={{ color: 'var(--ink)' }}>
                {l}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card stack" aria-label="감독 요약">
        <div className="row">
          <Crest clubId={uid} size={56} />
          <div className="grow">
            <div className="card-title ellipsis">{club.name}</div>
            <div className="label row" style={{ gap: 4 }}>
              <CompetitionLogo src={competitionById(club.league).logo} />
              {competitionById(club.league).name} · {state.manager?.name} 감독
            </div>
          </div>
        </div>
        <div className="row" style={{ gap: 0 }}>
          <div className="col grow">
            <span className="label">순위</span>
            <span className="big tnum">{state.round === 0 ? '-' : `${rank}위`}</span>
          </div>
          <div className="col grow">
            <span className="label">승점</span>
            <span className="big tnum">{row?.pts ?? 0}</span>
          </div>
          <div className="col grow">
            <span className="label">득실</span>
            <span className="big tnum">{row ? (row.gf - row.ga > 0 ? `+${row.gf - row.ga}` : row.gf - row.ga) : 0}</span>
          </div>
        </div>
        <div className="row between" style={{ background: 'var(--gold-soft)', borderRadius: 12, padding: '8px 12px' }}>
          <span className="label" style={{ color: '#a9791f' }}>
            최종 목표
          </span>
          <b style={{ color: '#a9791f', fontSize: 13 }}>UEFA 챔피언스리그 우승{state.clTitles > 0 ? ` · ${state.clTitles}회 달성` : ''}</b>
        </div>
        <FormDots results={userResults(state).filter((r) => r.comp === club.league)} clubId={uid} />
        <div className="divider" style={{ margin: 0 }} />
        <div className="stack" style={{ gap: 8 }}>
          <div className="row between">
            <span className="label">시즌 목표</span>
            <b>{state.targetRank}위 이내</b>
          </div>
          <div className="row between">
            <span className="label">구단주 신뢰</span>
            <b className="tnum">
              {trust}% {rep && <Delta v={rep.trustDelta} />}
            </b>
          </div>
          <Bar value={trust} />
        </div>
      </section>

      <section className="card stack" aria-label="팬 지지도">
        <div className="row between">
          <h2 className="card-title">팬 지지도</h2>
          <button className="btn small ghost" onClick={() => onGo('reaction')}>
            커뮤니티 보기
          </button>
        </div>
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <span className="big tnum">{Math.round(fan.support)}%</span>
          {rep && (
            <b className="tnum">
              지난달 <Delta v={rep.fanAfter.support - rep.fanBefore.support} />
            </b>
          )}
        </div>
        <Bar value={fan.support} />
        <div className="row" style={{ gap: 16 }}>
          <div className="grow stack" style={{ gap: 4 }}>
            <div className="row between">
              <span className="label">성적 만족</span>
              <b className="tnum">{Math.round(fan.results)}%</b>
            </div>
            <Bar value={fan.results} thin />
          </div>
          <div className="grow stack" style={{ gap: 4 }}>
            <div className="row between">
              <span className="label">스타일 만족</span>
              <b className="tnum">{Math.round(fan.style)}%</b>
            </div>
            <Bar value={fan.style} thin />
          </div>
        </div>
      </section>

      <section className="card flush" aria-label="확인할 일">
        <h2 className="card-title" style={{ padding: '12px 20px 4px' }}>
          확인할 일
        </h2>
        {todos.length === 0 && <p className="empty">지금은 확인할 일이 없어요</p>}
        {todos.map((x) => (
          <button key={x.key} className="item" onClick={x.onClick}>
            <span className="dot" aria-label="새 알림" />
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{x.label}</div>
              <div className="label ellipsis">{x.sub}</div>
            </div>
            <Chevron />
          </button>
        ))}
      </section>

      <section className="card flush" aria-label="이번 달 결정">
        <h2 className="card-title" style={{ padding: '12px 20px 4px' }}>
          {monthLabel} 결정
        </h2>
        <button className="item" onClick={() => onGo('squad')}>
          <div className="grow">
            <div className="label">전술</div>
            <div style={{ fontWeight: 600 }}>
              {PHILOSOPHY_LABEL[t.philosophy]} · {t.formation} · 압박 {TACTIC_LEVEL[t.pressing]} · 라인 {TACTIC_LEVEL[t.line]}
            </div>
          </div>
          <Chevron />
        </button>
        <button className="item" onClick={onPlan}>
          <div className="grow">
            <div className="label">전력 보강 예산 · 내 예산 {Math.round(sim.budget)}억</div>
            <div style={{ fontWeight: 600, color: state.monthPlan ? 'var(--ink)' : 'var(--muted)' }}>{planSummary(state.monthPlan, planScale(state))}</div>
          </div>
          <Chevron />
        </button>
      </section>

      {(fixtures.length > 0 || clFixtures.length > 0) && (
        <section className="card stack" aria-label="이번 달 일정">
          <div className="row between">
            <h2 className="card-title">{monthLabel} 일정</h2>
            <span className="tag">{fixtures.length + clFixtures.length}경기</span>
          </div>
          <div>
            {fixtures.map((f) => {
              const opp = state.clubs[f.oppId]
              return (
                <div key={`l${f.round}`} className="row" style={{ padding: '8px 0' }}>
                  <span className="label tnum" style={{ width: 30 }}>
                    {f.round}R
                  </span>
                  <Crest clubId={f.oppId} size={28} />
                  <div className="grow" style={{ fontWeight: 600 }}>
                    {clubById(f.oppId).short} <span className="label">{f.home ? '홈' : '원정'}</span>
                  </div>
                  <span className="tag">{PHILOSOPHY_LABEL[opp.philosophy]}</span>
                  <span className="tag accent">{MATCHUP_LABEL[matchupOf(t.philosophy, opp.philosophy)]}</span>
                </div>
              )
            })}
            {clFixtures.map((f, i) => (
              <div key={`c${i}`} className="row" style={{ padding: '8px 0' }}>
                <span className="tag gold" style={{ width: 30, justifyContent: 'center', padding: 0 }}>
                  CL
                </span>
                {f.oppId ? <Crest clubId={f.oppId} size={28} /> : <span style={{ width: 28 }} />}
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>
                    {f.oppId ? clubById(f.oppId).short : '상대 미정'} {f.home !== undefined && <span className="label">{f.home ? '홈' : '원정'}</span>}
                  </div>
                  <div className="label ellipsis">{f.label}</div>
                </div>
              </div>
            ))}
          </div>
          <button className="btn primary block" onClick={onPlay}>
            {monthLabel} 진행
          </button>
        </section>
      )}
    </div>
  )
}

