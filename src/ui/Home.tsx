import { clubById, competitionById } from '../data/clubs'
import { describeEvent } from '../engine/events'
import { EXPOSURE_AFTER } from '../engine/season'
import { PHILOSOPHY_LABEL } from '../engine/squad'
import { userClub } from '../engine/helpers'
import type { GameState } from '../engine/types'
import { Bar, Chevron, CompetitionLogo, Crest, FormDots } from './components'
import { MATCHUP_LABEL, matchupOf, nextFixture, standingsOf, userRank, userResults } from './derive'
import type { TabId } from './App'

export function Home({
  state,
  onPlay,
  onOpenEvent,
  onGo,
  onDismissReport,
}: {
  state: GameState
  onPlay: () => void
  onOpenEvent: (uid: string) => void
  onGo: (tab: TabId) => void
  onDismissReport: () => void
}) {
  const uid = state.userClubId as string
  const club = clubById(uid)
  const table = standingsOf(state)
  const rank = userRank(state)
  const row = table.find((x) => x.clubId === uid)
  const next = nextFixture(state)
  const sim = userClub(state)
  const injured = sim.squad.filter((p) => p.injuredRounds > 0)
  const streak = state.tacticMemory.streak
  const trust = Math.round(state.ownerTrust)
  const oppSim = next ? state.clubs[next.oppId] : null

  const todos: { key: string; label: string; sub: string; onClick: () => void }[] = []
  for (const ev of state.events) {
    const v = describeEvent(ev)
    todos.push({ key: ev.uid, label: v.title, sub: v.tag, onClick: () => onOpenEvent(ev.uid) })
  }
  if (streak >= EXPOSURE_AFTER - 1) {
    todos.push({
      key: 'exposure',
      label: `같은 전술 ${streak}경기째`,
      sub: streak >= EXPOSURE_AFTER ? '상대가 대응하기 시작했어요' : '다음 경기부터 상대가 대응해요',
      onClick: () => onGo('squad'),
    })
  }
  if (injured.length) {
    todos.push({
      key: 'injured',
      label: `부상 선수 ${injured.length}명`,
      sub: injured.map((p) => p.name).slice(0, 3).join(', '),
      onClick: () => onGo('squad'),
    })
  }

  return (
    <div className="screen">
      <h1 className="screen-title">홈</h1>

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
              {competitionById(club.league).name} · {state.season}시즌 · {state.manager?.name} 감독
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
        <FormDots results={userResults(state)} clubId={uid} />
        <div className="divider" style={{ margin: 0 }} />
        <div className="stack" style={{ gap: 8 }}>
          <div className="row between">
            <span className="label">시즌 목표</span>
            <b>{state.targetRank}위 이내</b>
          </div>
          <div className="row between">
            <span className="label">구단주 신뢰</span>
            <b className="tnum">{trust}%</b>
          </div>
          <Bar value={trust} />
        </div>
      </section>

      <section className="card flush" aria-label="확인할 일">
        <h2 className="card-title" style={{ padding: '12px 20px 4px' }}>
          확인할 일
        </h2>
        {todos.length === 0 && <p className="empty">지금은 확인할 일이 없어요</p>}
        {todos.map((t) => (
          <button key={t.key} className="item" onClick={t.onClick}>
            <span className="dot" aria-label="새 알림" />
            <div className="grow">
              <div style={{ fontWeight: 600 }}>{t.label}</div>
              <div className="label ellipsis">{t.sub}</div>
            </div>
            <Chevron />
          </button>
        ))}
      </section>

      {next && oppSim && (
        <section className="card stack" aria-label="다음 경기">
          <div className="row between">
            <h2 className="card-title">다음 경기</h2>
            <span className="tag">
              {next.round}/18라운드 · {next.home ? '홈' : '원정'}
            </span>
          </div>
          <div className="row">
            <Crest clubId={next.oppId} size={48} />
            <div className="grow">
              <div style={{ fontWeight: 700, fontSize: 17 }}>{clubById(next.oppId).name}</div>
              <div className="chips" style={{ marginTop: 4 }}>
                <span className="tag">{PHILOSOPHY_LABEL[oppSim.philosophy]} 성향</span>
                <span className="tag accent">{MATCHUP_LABEL[matchupOf(state.tactics.philosophy, oppSim.philosophy)]}</span>
              </div>
            </div>
          </div>
          <button className="btn primary block" onClick={onPlay}>
            경기 진행
          </button>
        </section>
      )}
    </div>
  )
}
