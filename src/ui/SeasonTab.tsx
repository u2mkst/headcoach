import { useState } from 'react'
import { clubById, competitionById } from '../data/clubs'
import { OUTCOME_LABEL } from '../engine/career'
import { CL_PHASE_LABEL, clTable, userInCl } from '../engine/champions'
import { calOf } from '../engine/leagues'
import { userLeagueId } from '../engine/season'
import type { ClTie, GameState, Standing } from '../engine/types'
import { Crest, Segmented } from './components'
import { KIND_LABEL, resultOf, standingsOf } from './derive'

type Sub = 'schedule' | 'table' | 'results' | 'cl'

export function SeasonTab({ state }: { state: GameState }) {
  const [sub, setSub] = useState<Sub>('schedule')
  const uid = state.userClubId as string
  const league = userLeagueId(state)
  const cal = calOf(league)
  const [viewRound, setViewRound] = useState(Math.max(1, state.round))
  const leagueResults = state.results.filter((r) => r.comp === league)

  // 달 머리글 위치: 각 달이 시작하는 라운드 번호(0부터)
  const monthStart: Record<number, string> = {}
  let acc = 0
  cal.monthRounds.forEach((n, i) => {
    monthStart[acc] = cal.months[i]
    acc += n
  })

  return (
    <div className="screen">
      <h1 className="screen-title">시즌</h1>
      <p className="screen-sub">
        {state.season}시즌 · {competitionById(league).name} · {state.round}/{cal.rounds}라운드 완료 ({state.month}/{cal.months.length}개월)
      </p>
      <Segmented
        value={sub}
        onChange={setSub}
        options={[
          { id: 'schedule', label: '일정' },
          { id: 'table', label: '순위표' },
          { id: 'results', label: '결과' },
          { id: 'cl', label: '챔스' },
        ]}
      />

      {sub === 'schedule' && (
        <section className="card flush">
          {state.fixtures.map((round, i) => {
            const f = round.find((x) => x.home === uid || x.away === uid)
            if (!f) return null
            const home = f.home === uid
            const oppId = home ? f.away : f.home
            const r = leagueResults.find((x) => x.round === i + 1 && (x.home === uid || x.away === uid))
            const res = r ? resultOf(r, uid) : null
            return (
              <div key={i}>
                {monthStart[i] && (
                  <div className="label" style={{ padding: '12px 20px 4px', fontWeight: 700 }}>
                    {monthStart[i]}
                  </div>
                )}
                {i === cal.baseRounds && cal.split && (
                  <div className="label" style={{ padding: '12px 20px 4px', fontWeight: 700, color: 'var(--accent)' }}>
                    스플릿 라운드 (상위 6 / 하위 6)
                  </div>
                )}
                <div className="item" style={i === state.round ? { background: 'var(--accent-soft)' } : undefined}>
                  <span className="label tnum" style={{ width: 28 }}>
                    {i + 1}R
                  </span>
                  <Crest clubId={oppId} size={28} />
                  <div className="grow">
                    <span style={{ fontWeight: 600 }}>{clubById(oppId).short}</span> <span className="label">{home ? '홈' : '원정'}</span>
                  </div>
                  {res ? (
                    <>
                      <b className="tnum">
                        {res.gf}-{res.ga}
                      </b>
                      <span className={`tag ${res.kind === 'w' ? 'accent' : ''}`} style={{ width: 28, justifyContent: 'center', padding: 0 }}>
                        {KIND_LABEL[res.kind]}
                      </span>
                    </>
                  ) : (
                    <span className="label">{i === state.round ? '다음 경기' : ''}</span>
                  )}
                </div>
              </div>
            )
          })}
          {cal.split && state.fixtures.length <= cal.baseRounds && (
            <p className="notice">{cal.baseRounds}라운드가 끝나면 상위·하위 스플릿 5라운드가 추가돼요.</p>
          )}
        </section>
      )}

      {sub === 'table' && <Table state={state} />}

      {sub === 'results' && (
        <>
          <div className="row between">
            <button className="btn small ghost" disabled={viewRound <= 1} onClick={() => setViewRound(viewRound - 1)}>
              이전
            </button>
            <b>{state.round === 0 ? '아직 경기가 없어요' : `${viewRound}라운드`}</b>
            <button className="btn small ghost" disabled={viewRound >= state.round} onClick={() => setViewRound(viewRound + 1)}>
              다음
            </button>
          </div>
          <section className="card flush">
            {leagueResults
              .filter((r) => r.round === viewRound)
              .map((r, i) => (
                <div key={i} className="item" style={r.home === uid || r.away === uid ? { background: 'var(--accent-soft)' } : undefined}>
                  <Crest clubId={r.home} size={26} />
                  <span className="grow ellipsis" style={{ fontWeight: 600 }}>
                    {clubById(r.home).short}
                  </span>
                  <b className="tnum" style={{ flex: 'none' }}>
                    {r.hg} : {r.ag}
                  </b>
                  <span className="grow ellipsis" style={{ fontWeight: 600, textAlign: 'right' }}>
                    {clubById(r.away).short}
                  </span>
                  <Crest clubId={r.away} size={26} />
                </div>
              ))}
            {state.round === 0 && <p className="empty">첫 경기를 치르면 결과가 쌓여요</p>}
          </section>
        </>
      )}

      {sub === 'cl' && <Champions state={state} />}

      {state.seasons.length > 0 && sub === 'table' && (
        <section className="card stack">
          <h2 className="card-title">지난 시즌</h2>
          {state.seasons
            .slice()
            .reverse()
            .map((s) => (
              <div key={s.season} className="row between">
                <span>
                  {s.season}시즌 · {clubById(s.clubId).short}
                </span>
                <b>
                  {s.rank}위 · {OUTCOME_LABEL[s.outcome]}
                </b>
              </div>
            ))}
        </section>
      )}
    </div>
  )
}

function zoneTag(league: string, rank: number, size: number): string | null {
  if (league === 'k1') return rank === size ? '강등' : rank === size - 1 ? '승강 PO' : null
  if (league === 'k2') return rank === 1 ? '승격' : rank === 2 ? '승강 PO' : null
  return null
}

function Table({ state }: { state: GameState }) {
  const league = userLeagueId(state)
  const table = standingsOf(state)
  const split = state.split
  const topSet = new Set(split?.top ?? [])
  return (
    <section className="card" style={{ padding: '8px 12px 12px' }}>
      <table className="table">
        <thead>
          <tr>
            <th className="rk">#</th>
            <th className="left">구단</th>
            <th>경기</th>
            <th>승무패</th>
            <th>득실</th>
            <th>승점</th>
          </tr>
        </thead>
        <tbody>
          {table.map((t: Standing, i) => {
            const zone = zoneTag(league, i + 1, table.length)
            return (
              <tr key={t.clubId} className={t.clubId === state.userClubId ? 'me' : ''}>
                <td className="rk">{i + 1}</td>
                <td className="left">
                  <span className="row" style={{ gap: 8 }}>
                    <Crest clubId={t.clubId} size={22} />
                    <span style={{ fontWeight: 600 }}>{clubById(t.clubId).short}</span>
                    {split && <span className="tag" style={{ height: 18, fontSize: 10 }}>{topSet.has(t.clubId) ? '상위' : '하위'}</span>}
                    {zone && <span className="tag alert" style={{ height: 18, fontSize: 10 }}>{zone}</span>}
                  </span>
                </td>
                <td className="tnum">{t.p}</td>
                <td className="tnum">
                  {t.w}-{t.d}-{t.l}
                </td>
                <td className="tnum">{t.gf - t.ga > 0 ? `+${t.gf - t.ga}` : t.gf - t.ga}</td>
                <td className="tnum pts">{t.pts}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {league === 'k1' && <p className="notice">1~6위는 상위 스플릿, 7~12위는 하위 스플릿. 12위는 자동 강등, 11위는 K2 2위와 승강 플레이오프를 치러요.</p>}
      {league === 'k2' && <p className="notice">1위는 K1 자동 승격, 2위는 K1 11위와 승강 플레이오프를 치러요.</p>}
    </section>
  )
}

function TieRow({ t, uid }: { t: ClTie; uid: string | null }) {
  const agg = (id: string) => t.legs.reduce((s, l) => s + (l.home === id ? l.hg : l.ag), 0)
  const done = !!t.winner
  const line = (id: string) => (
    <span className="row" style={{ gap: 6, fontWeight: t.winner === id ? 800 : 500, color: done && t.winner !== id ? 'var(--muted)' : 'var(--ink)' }}>
      <Crest clubId={id} size={20} />
      {clubById(id).short}
    </span>
  )
  return (
    <div className="item" style={t.a === uid || t.b === uid ? { background: 'var(--accent-soft)' } : undefined}>
      <div className="grow">{line(t.a)}</div>
      <b className="tnum">{t.legs.length ? `${agg(t.a)} : ${agg(t.b)}` : '-'}</b>
      <div className="grow" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        {line(t.b)}
      </div>
      {t.pens && <span className="tag" style={{ height: 18, fontSize: 10 }}>승부차기</span>}
    </div>
  )
}

function Champions({ state }: { state: GameState }) {
  const cl = state.cl
  const uid = state.userClubId
  const mine = userInCl(state)
  const table = cl ? clTable(cl) : []
  const played = !!cl && cl.matches.length > 0
  const stages: [string, ClTie[]][] = cl
    ? [
        ['플레이오프', cl.po],
        ['16강', cl.r16],
        ['8강', cl.qf],
        ['4강', cl.sf],
        ['결승', cl.final],
      ]
    : []
  return (
    <>
      <section className="card stack">
        <div className="row between">
          <h2 className="card-title">UEFA 챔피언스리그</h2>
          <span className="tag gold">최종 목표</span>
        </div>
        {cl && (
          <p className="label">
            {state.season}시즌 · {CL_PHASE_LABEL[cl.phase]} ·{' '}
            {mine ? '우리 구단이 출전해요' : '우리 구단은 출전하지 않아요 (유럽 구단 감독이 되면 도전할 수 있어요)'}
          </p>
        )}
        {!mine && <p className="label">내가 뛰지 않는 시즌의 대회는 시즌이 끝날 때 결과가 정해져요.</p>}
      </section>

      {mine && played && (
        <section className="card" style={{ padding: '8px 12px 12px' }}>
          <h2 className="card-title" style={{ padding: '8px 8px 4px' }}>
            리그 페이즈 순위
          </h2>
          <table className="table">
            <thead>
              <tr>
                <th className="rk">#</th>
                <th className="left">구단</th>
                <th>경기</th>
                <th>득실</th>
                <th>승점</th>
              </tr>
            </thead>
            <tbody>
              {table.map((t, i) => (
                <tr key={t.clubId} className={t.clubId === uid ? 'me' : ''}>
                  <td className="rk">{i + 1}</td>
                  <td className="left">
                    <span className="row" style={{ gap: 8 }}>
                      <Crest clubId={t.clubId} size={20} />
                      <span style={{ fontWeight: 600 }}>{clubById(t.clubId).short}</span>
                      {i < 8 && <span className="tag accent" style={{ height: 18, fontSize: 10 }}>16강</span>}
                      {i >= 8 && i < 24 && <span className="tag" style={{ height: 18, fontSize: 10 }}>PO</span>}
                    </span>
                  </td>
                  <td className="tnum">{t.p}</td>
                  <td className="tnum">{t.gf - t.ga > 0 ? `+${t.gf - t.ga}` : t.gf - t.ga}</td>
                  <td className="tnum pts">{t.pts}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="notice">1~8위는 16강 직행, 9~24위는 플레이오프, 25위 아래는 탈락이에요.</p>
        </section>
      )}

      {stages
        .filter(([, ties]) => ties.length > 0)
        .map(([name, ties]) => (
          <section key={name} className="card flush">
            <h2 className="card-title" style={{ padding: '12px 20px 4px' }}>
              {name}
            </h2>
            {ties.map((t, i) => (
              <TieRow key={i} t={t} uid={uid} />
            ))}
          </section>
        ))}

      <section className="card stack">
        <h2 className="card-title">역대 우승</h2>
        {state.clHistory.length === 0 && <p className="label">아직 기록이 없어요. 시즌이 끝나면 쌓여요.</p>}
        {[...state.clHistory].reverse().map((h) => (
          <div key={h.season} className="row between">
            <span className="label">{h.season}시즌</span>
            <span className="row" style={{ gap: 8 }}>
              <Crest clubId={h.winner} size={22} />
              <b style={{ color: h.winner === uid ? 'var(--gold)' : 'var(--ink)' }}>{clubById(h.winner).short}</b>
              <span className="label">준우승 {clubById(h.runnerUp).short}</span>
            </span>
          </div>
        ))}
      </section>
    </>
  )
}
