import { useState } from 'react'
import { clubById, competitionById } from '../data/clubs'
import { targetLabel } from '../engine/career'
import {
  ABILITY_BASE,
  ABILITY_MAX,
  ABILITY_POINTS,
  abilityPointsLeft,
  backToOffers,
  BACKGROUNDS,
  chooseCoach,
  chooseOffer,
  createManager,
  NATIONALITIES,
  startSeason,
} from '../engine/game'
import type { Abilities, Difficulty, GameState } from '../engine/types'
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

const TOTAL_STEPS = 6

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
  const [background, setBackground] = useState('')
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [abilities, setAbilities] = useState<Abilities>({
    tactics: ABILITY_BASE,
    leadership: ABILITY_BASE,
    communication: ABILITY_BASE,
    youth: ABILITY_BASE,
    negotiation: ABILITY_BASE,
  })
  const [pickedClub, setPickedClub] = useState('')
  const [pickedCoach, setPickedCoach] = useState('')

  if (state.phase === 'create') {
    const left = abilityPointsLeft(abilities)
    const bump = (k: keyof Abilities, d: number) => setAbilities((a) => ({ ...a, [k]: a[k] + d }))
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
            <h1 className="question">{'어떤 길을\n걸어왔나요?'}</h1>
            <p className="hint">이력에 따라 시작 명성과 능력치 보너스가 달라져요.</p>
            <div className="list">
              {BACKGROUNDS.map((b) => (
                <button key={b.id} className="option" aria-pressed={background === b.id} onClick={() => setBackground(b.id)}>
                  <div className="grow">
                    <div className="title">{b.label}</div>
                    <div className="desc">{b.desc}</div>
                    <div className="chips" style={{ marginTop: 6 }}>
                      <span className="tag">명성 {b.reputation}</span>
                      {(Object.keys(b.bonus) as (keyof Abilities)[]).map((k) => (
                        <span key={k} className="tag accent">
                          {ABILITY_INFO.find((a) => a.key === k)?.label} +{b.bonus[k]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="radio" />
                </button>
              ))}
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h1 className="question">{'강점을 어떻게\n나눌까요?'}</h1>
            <p className="hint">
              {ABILITY_POINTS}점을 나눠 주세요. 남은 점수 <b style={{ color: left === 0 ? 'var(--ink)' : 'var(--accent)' }}>{left}</b>점
            </p>
            <div className="card flush">
              {ABILITY_INFO.map((a) => (
                <div key={a.key} className="item">
                  <div className="grow">
                    <div style={{ fontWeight: 700 }}>{a.label}</div>
                    <div className="label">{a.desc}</div>
                  </div>
                  <div className="stepper">
                    <button aria-label={`${a.label} 낮추기`} disabled={abilities[a.key] <= ABILITY_BASE} onClick={() => bump(a.key, -1)}>
                      −
                    </button>
                    <output>{abilities[a.key]}</output>
                    <button aria-label={`${a.label} 높이기`} disabled={left <= 0 || abilities[a.key] >= ABILITY_MAX} onClick={() => bump(a.key, 1)}>
                      +
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <span className="label">난이도</span>
              <div className="chips">
                {(
                  [
                    ['easy', '쉬움'],
                    ['normal', '보통'],
                    ['hard', '어려움'],
                  ] as [Difficulty, string][]
                ).map(([id, label]) => (
                  <button key={id} className="chip" aria-pressed={difficulty === id} onClick={() => setDifficulty(id)}>
                    {label}
                  </button>
                ))}
              </div>
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
            disabled={(step === 0 && !name.trim()) || (step === 1 && !background) || (step === 2 && left !== 0)}
            onClick={() => {
              if (step < 2) setStep(step + 1)
              else onChange(createManager(state, { name, nationality, background, abilities, difficulty }))
            }}
          >
            {step < 2 ? '다음' : '구단 제안 받기'}
          </button>
        </BottomBar>
      </div>
    )
  }

  if (state.phase === 'offers') {
    return (
      <div className="onboard">
        <Steps index={3} />
        <h1 className="question">{'어느 구단에서\n시작할까요?'}</h1>
        <p className="hint">{state.manager?.name} 감독에게 세 구단이 연락했어요.</p>
        <div className="list">
          {state.offers.map((o) => {
            const c = clubById(o.clubId)
            return (
              <button key={o.clubId} className="option" aria-pressed={pickedClub === o.clubId} onClick={() => setPickedClub(o.clubId)}>
                <Crest clubId={o.clubId} size={48} />
                <div className="grow">
                  <div className="title">{c.name}</div>
                  <div className="desc">
                    {competitionById(c.league).name} · 목표 {o.targetRank}위 이내 ({targetLabel(o.targetRank)})
                  </div>
                  <div className="chips" style={{ marginTop: 6 }}>
                    <span className="tag">예산 {o.budget}억</span>
                    <span className="tag">인내심 {o.patience}시즌</span>
                  </div>
                </div>
                <span className="radio" />
              </button>
            )
          })}
        </div>
        <BottomBar>
          <button className="btn primary" disabled={!pickedClub} onClick={() => onChange(chooseOffer(state, pickedClub))}>
            이 구단으로 결정
          </button>
        </BottomBar>
      </div>
    )
  }

  if (state.phase === 'coach') {
    return (
      <div className="onboard">
        <Steps index={4} />
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
      <Steps index={5} />
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
