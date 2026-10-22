import { useState } from 'react'
import { clubById } from '../data/clubs'
import { OUTCOME_LABEL } from '../engine/career'
import type { GameState } from '../engine/types'
import { Crest, Segmented } from './components'
import { KIND_LABEL, resultOf, standingsOf } from './derive'

type Sub = 'schedule' | 'table' | 'results'

export function SeasonTab({ state }: { state: GameState }) {
  const [sub, setSub] = useState<Sub>('schedule')
  const uid = state.userClubId as string
  const [viewRound, setViewRound] = useState(Math.max(1, state.round))

  return (
    <div className="screen">
      <h1 className="screen-title">시즌</h1>
      <p className="screen-sub">
        {state.season}시즌 · {state.round}/18라운드 완료
      </p>
      <Segmented
        value={sub}
        onChange={setSub}
        options={[
          { id: 'schedule', label: '일정' },
          { id: 'table', label: '순위표' },
          { id: 'results', label: '경기 결과' },
        ]}
      />

      {sub === 'schedule' && (
        <section className="card flush">
          {state.fixtures.map((round, i) => {
            const f = round.find((x) => x.home === uid || x.away === uid)!
            const home = f.home === uid
            const oppId = home ? f.away : f.home
            const played = i < state.round
            const r = played ? state.results.find((x) => x.round === i + 1 && (x.home === uid || x.away === uid)) : undefined
            const res = r ? resultOf(r, uid) : null
            return (
              <div key={i} className="item" style={i === state.round ? { background: 'var(--accent-soft)' } : undefined}>
                <span className="label tnum" style={{ width: 28 }}>
                  {i + 1}R
                </span>
                <Crest clubId={oppId} size={28} />
                <div className="grow">
                  <span style={{ fontWeight: 600 }}>{clubById(oppId).short}</span>{' '}
                  <span className="label">{home ? '홈' : '원정'}</span>
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
            )
          })}
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
            {state.results
              .filter((r) => r.round === viewRound)
              .map((r, i) => (
                <div key={i} className="item" style={r.home === uid || r.away === uid ? { background: 'var(--accent-soft)' } : undefined}>
                  <Crest clubId={r.home} size={26} />
                  <span className="grow" style={{ fontWeight: 600 }}>
                    {clubById(r.home).short}
                  </span>
                  <b className="tnum">
                    {r.hg} : {r.ag}
                  </b>
                  <span className="grow" style={{ fontWeight: 600, textAlign: 'right' }}>
                    {clubById(r.away).short}
                  </span>
                  <Crest clubId={r.away} size={26} />
                </div>
              ))}
            {state.round === 0 && <p className="empty">첫 경기를 치르면 결과가 쌓여요</p>}
          </section>
        </>
      )}

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

function Table({ state }: { state: GameState }) {
  const table = standingsOf(state)
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
          {table.map((t, i) => (
            <tr key={t.clubId} className={t.clubId === state.userClubId ? 'me' : ''}>
              <td className="rk">{i + 1}</td>
              <td className="left">
                <span className="row" style={{ gap: 8 }}>
                  <Crest clubId={t.clubId} size={22} />
                  <span style={{ fontWeight: 600 }}>{clubById(t.clubId).short}</span>
                </span>
              </td>
              <td className="tnum">{t.p}</td>
              <td className="tnum">
                {t.w}-{t.d}-{t.l}
              </td>
              <td className="tnum">{t.gf - t.ga > 0 ? `+${t.gf - t.ga}` : t.gf - t.ga}</td>
              <td className="tnum pts">{t.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
