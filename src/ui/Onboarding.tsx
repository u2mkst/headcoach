import { useState } from 'react'
import { clubById, competitionById } from '../data/clubs'
import { targetLabel } from '../engine/leagues'
import {
  backToOffers,
  chooseCoach,
  chooseOffer,
  createManager,
  MANAGER_STYLES,
  NATIONALITIES,
  startSeason,
} from '../engine/game'
import { PHILOSOPHY_LABEL } from '../engine/squad'
import type { Abilities, GameState } from '../engine/types'
import { BottomBar, Crest, Sheet } from './components'

export const ABILITY_INFO: { key: keyof Abilities; label: string; desc: string }[] = [
  { key: 'tactics', label: '전술', desc: '경기 전력에 작은 보너스를 더해요' },
  { key: 'leadership', label: '지도력', desc: '선수 불만·갈등을 풀어내요' },
  { key: 'communication', label: '소통', desc: '기자회견과 팬 대응에 강해져요' },
  { key: 'youth', label: '육성', desc: '어린 선수와 유망주가 더 잘 자라요' },
  { key: 'negotiation', label: '협상', desc: '이적 협상과 구단주 면담에 강해져요' },
]

export const SPECIALTY_LABEL = { tactics: '전술 코치', fitness: '체력 코치', youth: '유소년 코치' } as const
const SPECIALTY_DESC = {
  tactics: '팀 전술 완성도를 높여 경기 전력이 조금 올라요',
  fitness: '매 라운드 컨디션 회복이 빨라지고 노장의 하락이 줄어요',
  youth: '어린 선수들의 성장이 더 커져요',
} as const

const TOTAL_STEPS = 5

function Steps({ index }: { index: number }) {
  return (
    <div className="steps" aria-label={`${TOTAL_STEPS}단계 중 ${index + 1}단계`}>
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <i key={i} className={i === index ? 'on' : i < index ? 'done' : ''} />
      ))}
    </div>
  )
}

export function Onboarding({ state, onChange }: { state: GameState; onChange: (s: GameState) => void }) {
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [nationality, setNationality] = useState(NATIONALITIES[0])
  const [style, setStyle] = useState('')
  const [pickedClub, setPickedClub] = useState('')
  const [pickedCoach, setPickedCoach] = useState('')

  if (state.phase === 'create') {
    const back = step > 0 ? () => setStep(step - 1) : undefined
    return (
      <div className="onboard">
        <Steps index={step} />
        {step === 0 && (
          <>
            <h1 className="question">{'어떤 감독이\n되고 싶나요?'}</h1>
            <p className="hint">벤치 끝에서 시작해 명장이 되는 길을 함께 걸어요.</p>
            <label className="stack" style={{ gap: 8 }}>
              <span className="label">감독 이름</span>
              <input
                className="field"
                value={name}
                maxLength={12}
                placeholder="이름을 입력해 주세요"
                onChange={(e) => setName(e.target.value)}
                autoFocus
              />
            </label>
            <div className="stack" style={{ gap: 8 }}>
              <span className="label">국적</span>
              <div className="chips">
                {NATIONALITIES.map((n) => (
                  <button key={n} className="chip" aria-pressed={nationality === n} onClick={() => setNationality(n)}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        {step === 1 && (
          <>
            <h1 className="question">{'어떤 스타일의\n감독인가요?'}</h1>
            <p className="hint">처음 잡는 전술과 강점이 정해져요. 시즌 중에 전술은 언제든 바꿀 수 있어요.</p>
            <div className="list">
              {MANAGER_STYLES.map((m) => {
                const top = (Object.keys(m.abilities) as (keyof Abilities)[])
                  .sort((x, y) => m.abilities[y] - m.abilities[x])
                  .slice(0, 2)
                return (
                  <button key={m.id} className="option" aria-pressed={style === m.id} onClick={() => setStyle(m.id)}>
                    <div className="grow">
                      <div className="title">{m.label}</div>
                      <div className="desc">{m.tagline}</div>
                      <div className="desc" style={{ marginTop: 2 }}>
                        {m.desc}
                      </div>
                      <div className="chips" style={{ marginTop: 8 }}>
                        <span className="tag">
                          {PHILOSOPHY_LABEL[m.tactics.philosophy]} · {m.tactics.formation}
                        </span>
                        {top.map((k) => (
                          <span key={k} className="tag accent">
                            {ABILITY_INFO.find((a) => a.key === k)?.label} {m.abilities[k]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className="radio" />
                  </button>
                )
              })}
            </div>
          </>
        )}
        <BottomBar>
          {back && (
            <button className="btn ghost" style={{ flex: '0 0 96px' }} onClick={back}>
              이전
            </button>
          )}
          <button
            className="btn primary"
            disabled={(step === 0 && !name.trim()) || (step === 1 && !style)}
            onClick={() => {
              if (step < 1) setStep(step + 1)
              else onChange(createManager(state, { name, nationality, style }))
            }}
          >
            {step < 1 ? '다음' : '구단 고르러 가기'}
          </button>
        </BottomBar>
      </div>
    )
  }

  if (state.phase === 'offers') {
    const groups = ['k1', 'k2'].map((lg) => ({
      lg,
      offers: state.offers.filter((o) => clubById(o.clubId).league === lg),
    }))
    return (
      <div className="onboard">
        <Steps index={2} />
        <h1 className="question">{'어느 구단에서\n시작할까요?'}</h1>
        <p className="hint">맡고 싶은 구단을 직접 골라요. K리그에서 시작해 유럽 정상까지 올라가는 길이에요.</p>
        {groups.map((g) => (
          <section key={g.lg} className="stack" style={{ gap: 8 }}>
            <h2 className="card-title" style={{ padding: '0 4px' }}>
              {competitionById(g.lg).name}
            </h2>
            <div className="list">
              {g.offers.map((o) => {
                const c = clubById(o.clubId)
                return (
                  <button key={o.clubId} className="option" aria-pressed={pickedClub === o.clubId} onClick={() => setPickedClub(o.clubId)}>
                    <Crest clubId={o.clubId} size={44} />
                    <div className="grow">
                      <div className="title" style={{ fontSize: 15 }}>
                        {c.name}
                      </div>
                      <div className="desc">
                        목표 {o.targetRank}위 이내 · {targetLabel(o.targetRank, g.lg)}
                      </div>
                    </div>
                    <span className="tag">예산 {o.budget}억</span>
                    <span className="radio" />
                  </button>
                )
              })}
            </div>
          </section>
        ))}
        <BottomBar>
          <button className="btn primary" disabled={!pickedClub} onClick={() => onChange(chooseOffer(state, pickedClub))}>
            {pickedClub ? `${clubById(pickedClub).short} 결정` : '구단을 골라 주세요'}
          </button>
        </BottomBar>
      </div>
    )
  }

  if (state.phase === 'coach') {
    return (
      <div className="onboard">
        <Steps index={3} />
        <h1 className="question">{'수석코치는\n누구로 할까요?'}</h1>
        <p className="hint">함께할 코치는 팀의 색깔을 바꿔요.</p>
        <div className="list">
          {state.coachCandidates.map((c) => (
            <button key={c.id} className="option" aria-pressed={pickedCoach === c.id} onClick={() => setPickedCoach(c.id)}>
              <div className="ovr">{c.rating}</div>
              <div className="grow">
                <div className="title">
                  {c.name} · {SPECIALTY_LABEL[c.specialty]}
                </div>
                <div className="desc">{SPECIALTY_DESC[c.specialty]}</div>
              </div>
              <span className="radio" />
            </button>
          ))}
        </div>
        <BottomBar>
          <button className="btn primary" disabled={!pickedCoach} onClick={() => onChange(chooseCoach(state, pickedCoach))}>
            선임하기
          </button>
        </BottomBar>
      </div>
    )
  }

  // confirm — 수석코치 화면 위에 확인 시트를 올린다
  const club = clubById(state.userClubId as string)
  const coach = state.coach
  return (
    <div className="onboard">
      <Steps index={4} />
      <h1 className="question">{'수석코치는\n누구로 할까요?'}</h1>
      <div className="list" aria-hidden="true">
        {state.coachCandidates.map((c) => (
          <div key={c.id} className="option" aria-pressed={coach?.id === c.id}>
            <div className="ovr">{c.rating}</div>
            <div className="grow">
              <div className="title">
                {c.name} · {SPECIALTY_LABEL[c.specialty]}
              </div>
            </div>
          </div>
        ))}
      </div>
      <Sheet>
        <h2 className="question" style={{ fontSize: 24 }}>
          이대로 시작할까요?
        </h2>
        <div className="row">
          <Crest clubId={club.id} size={56} />
          <div className="grow">
            <div className="card-title">{club.name}</div>
            <div className="label">{competitionById(club.league).name}</div>
          </div>
        </div>
        <div className="stack" style={{ gap: 8 }}>
          <div className="row between">
            <span className="label">감독</span>
            <b>
              {state.manager?.name} · {state.manager?.background}
            </b>
          </div>
          <div className="row between">
            <span className="label">수석코치</span>
            <b>{coach ? `${coach.name} · ${SPECIALTY_LABEL[coach.specialty]}` : '-'}</b>
          </div>
          <div className="row between">
            <span className="label">시즌 목표</span>
            <b>{state.targetRank}위 이내</b>
          </div>
          <div className="row between">
            <span className="label">예산</span>
            <b>{Math.round(state.clubs[club.id].budget)}억</b>
          </div>
        </div>
        <div className="row">
          <button className="btn ghost" style={{ flex: '0 0 120px' }} onClick={() => onChange(backToOffers(state))}>
            다시 보기
          </button>
          <button className="btn primary" style={{ flex: 1 }} onClick={() => onChange(startSeason(state))}>
            시즌 시작
          </button>
        </div>
      </Sheet>
    </div>
  )
}
