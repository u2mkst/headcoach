import { useState } from 'react'
import { clubById } from '../data/clubs'
import { OUTCOME_LABEL, targetLabel } from '../engine/career'
import { finishSeason } from '../engine/game'
import { josa } from '../engine/josa'
import type { GameState } from '../engine/types'
import { BottomBar, Crest, Icon } from './components'

export function SeasonEnd({ state, onChange }: { state: GameState; onChange: (s: GameState) => void }) {
  const summary = state.seasons[state.seasons.length - 1]
  const pc = state.pendingCareer
  const fired = pc?.decision.kind === 'fired'
  const [pick, setPick] = useState<string>(fired ? '' : 'stay')
  if (!summary || !pc) return null
  const club = clubById(summary.clubId)
  const champion = summary.outcome === 'champion'
  const delta = Math.round(pc.trustDelta)

  return (
    <div className="overlay">
      <div className="inner">
        <div>
          <span className="tag">{summary.season}시즌 결산</span>
        </div>
        <div className="row">
          {champion && <Icon name="trophy" className="trophy" />}
          <h1 className="question" style={{ color: champion ? 'var(--gold)' : 'var(--ink)' }}>
            {OUTCOME_LABEL[summary.outcome]}
          </h1>
        </div>
        {summary.upgraded && <p className="hint">순위는 아쉬웠지만 다른 성과를 인정받아 평가가 한 단계 올랐어요.</p>}

        <section className="card stack">
          <div className="row">
            <Crest clubId={club.id} size={48} />
            <div className="grow">
              <div className="card-title">{club.name}</div>
              <div className="label">
                목표 {summary.targetRank}위 이내 ({targetLabel(summary.targetRank)})
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 0 }}>
            <div className="col grow">
              <span className="label">최종 순위</span>
              <span className="big">{summary.rank}위</span>
            </div>
            <div className="col grow">
              <span className="label">승점</span>
              <span className="big">{summary.points}</span>
            </div>
            <div className="col grow">
              <span className="label">전적</span>
              <b style={{ fontSize: 17, marginTop: 4 }}>
                {summary.w}-{summary.d}-{summary.l}
              </b>
            </div>
          </div>
        </section>

        {(summary.achievements.length > 0 || summary.promiseNotes.length > 0) && (
          <section className="card stack">
            <h2 className="card-title">성과와 약속</h2>
            {summary.achievements.length > 0 && (
              <div className="chips">
                {summary.achievements.map((a) => (
                  <span key={a} className="tag gold">
                    {a}
                  </span>
                ))}
              </div>
            )}
            {summary.promiseNotes.map((n, i) => (
              <p key={i} className="label" style={{ color: 'var(--ink)' }}>
                {n}
              </p>
            ))}
          </section>
        )}

        <section className="card stack">
          <div className="row between">
            <h2 className="card-title">구단주 평가</h2>
            <b className="tnum">
              {Math.round(state.ownerTrust)}%{' '}
              {delta !== 0 && <span className={delta > 0 ? 'up' : 'muted'}>{delta > 0 ? `▲${delta}` : `▼${-delta}`}</span>}
            </b>
          </div>
          <p>
            {fired
              ? '구단주의 신뢰를 잃어 결별하게 됐어요. 다른 구단에서 다시 시작해요.'
              : pc.offers.length > 0
                ? '구단이 재계약을 제안했어요. 다른 구단에서도 연락이 왔어요.'
                : '구단이 재계약을 제안했어요.'}
          </p>
          <div className="list">
            {!fired && (
              <button className="option" aria-pressed={pick === 'stay'} onClick={() => setPick('stay')}>
                <Crest clubId={club.id} size={36} />
                <div className="grow">
                  <div className="title" style={{ fontSize: 15 }}>
                    {josa(club.short, '과/와')} 재계약
                  </div>
                  <div className="desc">이 팀과 다음 시즌을 이어가요</div>
                </div>
                <span className="radio" />
              </button>
            )}
            {pc.offers.map((o) => (
              <button key={o.clubId} className="option" aria-pressed={pick === o.clubId} onClick={() => setPick(o.clubId)}>
                <Crest clubId={o.clubId} size={36} />
                <div className="grow">
                  <div className="title" style={{ fontSize: 15 }}>
                    {clubById(o.clubId).name}
                  </div>
                  <div className="desc">
                    {fired ? '새 감독으로 부임' : '이적 제안'} · 목표 {o.targetRank}위 이내 · 예산 {o.budget}억
                  </div>
                </div>
                <span className="radio" />
              </button>
            ))}
          </div>
        </section>

        <BottomBar>
          <button
            className="btn primary"
            disabled={!pick}
            onClick={() => onChange(finishSeason(state, pick === 'stay' ? null : pick))}
          >
            {pick === 'stay' ? `${state.season + 1}시즌 시작` : '이 구단으로 부임'}
          </button>
        </BottomBar>
      </div>
    </div>
  )
}
