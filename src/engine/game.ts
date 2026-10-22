import { clubById } from '../data/clubs'
import { josa } from './josa'
import { createRng, type Rng } from './rng'
import {
  evaluateSeason,
  makeOffers,
  newClubSims,
  PHILOSOPHIES,
  runOffseason,
  strengthRanking,
  targetRankFor,
  budgetFor,
} from './career'
import { expireEvents, resolveEvent, rollEvents } from './events'
import { addTrust, newId, pushFeed, pushTimeline, userClub } from './helpers'
import { generateMonthMedia } from './media'
import { INITIAL_FAN, updateFan } from './fans'
import { applyPlan, planCost } from './reinforce'
import {
  afterMatchMemory,
  computeStandings,
  generateSchedule,
  MONTH_LABEL,
  MONTH_ROUNDS,
  ROUNDS,
  simulateRound,
} from './season'
import { clamp, randomName, FORMATIONS, wageBill } from './squad'
import type {
  Abilities,
  Coach,
  Difficulty,
  EventOutcome,
  GameState,
  MatchResult,
  MonthPlan,
  MonthReport,
  Tactics,
} from './types'

export const SAVE_VERSION = 3

export const DEFAULT_TACTICS: Tactics = { philosophy: 'possession', formation: '4-4-2', pressing: 'mid', line: 'mid' }

export const BACKGROUNDS: { id: string; label: string; desc: string; reputation: number; bonus: Partial<Abilities> }[] = [
  { id: 'national', label: '전직 국가대표', desc: '이름값이 크다. 선수단이 말을 잘 따른다.', reputation: 45, bonus: { leadership: 1 } },
  { id: 'analyst', label: '전술 분석가', desc: '데이터와 영상으로 상대를 읽는다.', reputation: 22, bonus: { tactics: 2 } },
  { id: 'youth', label: '유소년 지도자', desc: '어린 선수를 키우는 데 눈이 밝다.', reputation: 18, bonus: { youth: 2 } },
  { id: 'coach', label: '프로팀 코치', desc: '현장 경험이 탄탄하고 균형이 좋다.', reputation: 32, bonus: { leadership: 1, communication: 1 } },
  { id: 'abroad', label: '해외 리그 출신', desc: '말솜씨와 협상 감각이 있다.', reputation: 36, bonus: { communication: 1, negotiation: 1 } },
]

export const ABILITY_BASE = 3
export const ABILITY_POINTS = 12
export const ABILITY_MAX = 9

export const NATIONALITIES = ['대한민국', '일본', '브라질', '스페인', '독일', '기타']

export function emptyState(seed: number): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    rng: seed >>> 0,
    difficulty: 'normal',
    phase: 'create',
    manager: null,
    userClubId: null,
    coach: null,
    offers: [],
    coachCandidates: [],
    season: 1,
    round: 0,
    clubs: {},
    fixtures: [],
    results: [],
    tactics: { ...DEFAULT_TACTICS },
    tacticMemory: { streak: 0, lastKey: null, familiarity: 0, lastPhilosophy: null },
    ownerTrust: 55,
    targetRank: 5,
    seasonStartBudget: 0,
    events: [],
    eventLog: [],
    promises: [],
    wasInDanger: false,
    feed: [],
    timeline: [],
    seasons: [],
    monthPlan: null,
    fan: { ...INITIAL_FAN },
    fitnessBoost: 0,
    youthInvest: 0,
    pendingCareer: null,
    monthReport: null,
    retired: false,
    offseasonReport: null,
    nextId: 0,
  }
  const rng = createRng(seed)
  newClubSims(s, rng)
  s.fixtures = generateSchedule(rng, Object.keys(s.clubs))
  s.rng = rng.state()
  return s
}

export function newGame(seed = Math.floor(Math.random() * 2 ** 31)): GameState {
  return emptyState(seed)
}

/** 상태를 복제해 변경하고 새 상태를 돌려준다 (React 상태와 저장에 안전) */
export function act<T = void>(state: GameState, fn: (draft: GameState, rng: Rng) => T): [GameState, T] {
  const draft = structuredClone(state)
  const rng = createRng(draft.rng)
  const value = fn(draft, rng)
  draft.rng = rng.state()
  return [draft, value]
}

/* ───────── 시작 흐름 ───────── */

export function abilityPointsLeft(a: Abilities): number {
  return ABILITY_POINTS - (Object.values(a).reduce((x, y) => x + y, 0) - ABILITY_BASE * 5)
}

export function createManager(
  state: GameState,
  input: { name: string; nationality: string; background: string; abilities: Abilities; difficulty: Difficulty },
): GameState {
  return act(state, (s, rng) => {
    const bg = BACKGROUNDS.find((b) => b.id === input.background) ?? BACKGROUNDS[3]
    const abilities = { ...input.abilities }
    for (const k of Object.keys(bg.bonus) as (keyof Abilities)[]) {
      abilities[k] = clamp(abilities[k] + (bg.bonus[k] ?? 0), 1, 10)
    }
    s.manager = {
      name: input.name.trim() || '무명',
      nationality: input.nationality,
      background: bg.label,
      abilities,
      reputation: bg.reputation,
    }
    s.difficulty = input.difficulty
    s.offers = makeOffers(s, rng, 3)
    s.phase = 'offers'
  })[0]
}

export function makeCoachCandidates(s: GameState, rng: Rng): Coach[] {
  const specs: Coach['specialty'][] = ['tactics', 'fitness', 'youth']
  return specs.map((specialty) => ({
    id: newId(s, 'c'),
    name: randomName(rng),
    specialty,
    rating: rng.int(5, 9),
  }))
}

export function chooseOffer(state: GameState, clubId: string): GameState {
  return act(state, (s, rng) => {
    const offer = s.offers.find((o) => o.clubId === clubId)
    if (!offer) throw new Error('제안을 찾을 수 없어요')
    joinClub(s, offer.clubId, offer.targetRank, offer.budget)
    s.coachCandidates = makeCoachCandidates(s, rng)
    s.phase = 'coach'
  })[0]
}

function joinClub(s: GameState, clubId: string, targetRank: number, budget: number) {
  s.userClubId = clubId
  s.targetRank = targetRank
  const club = s.clubs[clubId]
  club.budget = budget
  s.seasonStartBudget = budget
  s.ownerTrust = 55
  s.tactics = { ...DEFAULT_TACTICS, philosophy: club.philosophy, formation: club.formation }
  s.tacticMemory = { streak: 0, lastKey: null, familiarity: 0, lastPhilosophy: null }
  s.fan = { ...INITIAL_FAN }
  s.monthPlan = null
  s.youthInvest = 0
}

export function chooseCoach(state: GameState, coachId: string): GameState {
  return act(state, (s) => {
    const c = s.coachCandidates.find((x) => x.id === coachId)
    if (!c) throw new Error('코치를 찾을 수 없어요')
    s.coach = c
    s.phase = 'confirm'
  })[0]
}

/** 확인 시트의 "다시 보기" */
export function backToOffers(state: GameState): GameState {
  return act(state, (s) => {
    s.userClubId = null
    s.coach = null
    s.phase = 'offers'
  })[0]
}

export function startSeason(state: GameState): GameState {
  return act(state, (s) => {
    s.phase = 'play'
    const club = clubById(s.userClubId as string)
    pushTimeline(s, 'start', `${club.name} 감독으로 부임`)
    pushFeed(s, {
      kind: 'article',
      source: '스포츠 타임스',
      mood: 'neutral',
      text: `${club.short}, ${s.manager?.name} 감독 선임… "첫 시즌 목표는 ${s.targetRank}위 이내"`,
    })
  })[0]
}

/* ───────── 전술 ───────── */

export function setTactics(state: GameState, patch: Partial<Tactics>): GameState {
  return act(state, (s) => {
    s.tactics = { ...s.tactics, ...patch }
  })[0]
}

/* ───────── 이번 달 보강 계획 ───────── */

/** 보강 계획을 정하거나(null이면 취소) 돌려받은 오류 문구를 보여준다 */
export function setMonthPlan(state: GameState, plan: MonthPlan | null): [GameState, string | null] {
  return act(state, (s) => {
    if (plan && planCost(plan) > userClub(s).budget) return '예산이 부족해요'
    s.monthPlan = plan
    return null
  })
}

/* ───────── 한 달 진행 ───────── */

/** 한 라운드를 진행하고 내 경기 결과를 돌려준다 (기사·이벤트는 달이 끝난 뒤 한꺼번에) */
function stepRound(s: GameState, rng: Rng): MatchResult {
  const club = userClub(s)
  const uid = s.userClubId as string
  const out = simulateRound(s, rng)
  s.results.push(...out.results)
  s.round += 1
  s.tacticMemory = afterMatchMemory(out.userMemory)

  const mine = out.results.find((r) => r.home === uid || r.away === uid) as MatchResult
  const gf = mine.home === uid ? mine.hg : mine.ag
  const ga = mine.home === uid ? mine.ag : mine.hg

  club.budget = Math.round((club.budget + 1.5 + (gf > ga ? 0.5 : 0) - wageBill(club.squad)) * 10) / 10
  if (s.coach?.specialty === 'fitness') {
    for (const p of club.squad) p.condition = clamp(p.condition + Math.round(s.coach.rating * 0.4), 20, 100)
  }
  const standings = computeStandings(s.results, Object.keys(s.clubs))
  const rank = standings.findIndex((x) => x.clubId === uid) + 1
  addTrust(s, gf > ga ? 1 : gf < ga ? -1 : 0)
  addTrust(s, rank <= s.targetRank ? 0.3 : -0.3)
  if (s.round >= 9 && rank >= 9) s.wasInDanger = true
  return mine
}

export interface MonthOutcome {
  report: MonthReport
  newEvents: number
  expired: EventOutcome[]
  seasonOver: boolean
}

/** 한 달(3라운드)을 진행한다: 보강 계획 적용 → 경기 → 지지도 갱신 → 기사·커뮤니티 → 이벤트 */
export function playMonth(state: GameState): [GameState, MonthOutcome] {
  return act(state, (s, rng) => {
    if (s.phase !== 'play' || s.round >= ROUNDS) throw new Error('지금은 진행할 수 없어요')
    const club = userClub(s)
    const uid = s.userClubId as string
    const month = Math.floor(s.round / MONTH_ROUNDS) + 1
    const ids = Object.keys(s.clubs)
    const rankBefore = s.round === 0 ? 0 : computeStandings(s.results, ids).findIndex((x) => x.clubId === uid) + 1
    const fanBefore = { ...s.fan }
    const trustBefore = s.ownerTrust
    const injuredBefore = new Set(club.squad.filter((p) => p.injuredRounds > 0).map((p) => p.id))

    // 이번 달 보강 계획 적용
    const plan = s.monthPlan
    const applied = plan ? applyPlan(s, rng, plan) : null
    s.monthPlan = null

    const mine: MatchResult[] = []
    while (mine.length < MONTH_ROUNDS && s.round < ROUNDS) mine.push(stepRound(s, rng))
    s.fitnessBoost = 0

    const standings = computeStandings(s.results, ids)
    const rankAfter = standings.findIndex((x) => x.clubId === uid) + 1
    let w = 0
    let d = 0
    let l = 0
    let gf = 0
    let ga = 0
    for (const r of mine) {
      const g = r.home === uid ? r.hg : r.ag
      const c = r.home === uid ? r.ag : r.hg
      gf += g
      ga += c
      if (g > c) w++
      else if (g < c) l++
      else d++
    }

    updateFan(s, { w, d, l, gf, ga, rank: rankAfter }, applied?.applied ? (plan as MonthPlan) : null)

    const report: MonthReport = {
      season: s.season,
      month,
      results: mine,
      w,
      d,
      l,
      gf,
      ga,
      rankBefore,
      rankAfter,
      fanBefore,
      fanAfter: { ...s.fan },
      trustDelta: Math.round((s.ownerTrust - trustBefore) * 10) / 10,
      planLine: applied ? applied.line : null,
      newInjuries: club.squad.filter((p) => p.injuredRounds > 0 && !injuredBefore.has(p.id)).length,
      highlights: [],
    }
    report.highlights = generateMonthMedia(s, rng, report, standings, plan, !!applied?.applied)
    s.monthReport = report
    pushTimeline(s, 'result', `${MONTH_LABEL[month - 1]} ${w}승 ${d}무 ${l}패 · ${rankAfter}위 · 지지도 ${Math.round(s.fan.support)}%`)

    const expired = expireEvents(s, rng)
    const fresh = rollEvents(s, rng, {
      injuredBefore,
      summary: `${MONTH_LABEL[month - 1]} ${w}승 ${d}무 ${l}패를 마친 직후, 기자들이 감독 앞으로 몰려들었어요.`,
      userRank: rankAfter,
      recentNoWin: w === 0 || s.fan.support < 30,
    })
    s.events.push(...fresh)

    const seasonOver = s.round >= ROUNDS
    if (seasonOver) evaluateSeason(s, rng)
    return { report, newEvents: fresh.length, expired, seasonOver }
  })
}

export function chooseEvent(state: GameState, uid: string, choiceId: string): [GameState, EventOutcome] {
  return act(state, (s, rng) => resolveEvent(s, rng, uid, choiceId))
}

/* ───────── 시즌 결산 이후 ───────── */

/** clubId가 null이면 현 구단 재계약, 값이 있으면 그 구단으로 이동 */
export function finishSeason(state: GameState, clubId: string | null): GameState {
  return act(state, (s, rng) => {
    const pc = s.pendingCareer
    if (!pc) throw new Error('결산할 시즌이 없어요')
    const stay = clubId === null
    if (stay && pc.decision.kind === 'fired') throw new Error('경질되었어요. 다른 구단을 선택하세요')
    const prevClub = clubById(s.userClubId as string)

    let offer = stay ? null : pc.offers.find((o) => o.clubId === clubId)
    if (!stay && !offer) throw new Error('제안을 찾을 수 없어요')

    const lines = runOffseason(s, rng)
    if (offer) {
      const nextClub = clubById(offer.clubId)
      joinClub(s, offer.clubId, targetRankFor(strengthRanking(s).indexOf(offer.clubId) + 1), budgetFor(nextClub.strength))
      pushTimeline(s, 'career', `${prevClub.short} → ${nextClub.name} 감독으로 이동`)
      lines.unshift(`${nextClub.name}의 새 감독으로 부임했어요`)
    } else {
      addTrust(s, 0)
      pushTimeline(s, 'career', `${josa(prevClub.name, '과/와')} 재계약`)
      lines.unshift(`${josa(prevClub.name, '과/와')} 재계약했어요`)
    }
    s.pendingCareer = null
    s.offseasonReport = lines
    // AI 구단 철학이 한쪽으로 쏠리지 않도록 보정
    const counts = PHILOSOPHIES.map((p) => Object.values(s.clubs).filter((c) => c.philosophy === p).length)
    if (Math.max(...counts) >= 6) {
      const overP = PHILOSOPHIES[counts.indexOf(Math.max(...counts))]
      const swap = Object.values(s.clubs).find((c) => c.philosophy === overP && c.id !== s.userClubId)
      if (swap) swap.philosophy = rng.pick(PHILOSOPHIES.filter((p) => p !== overP))
    }
    const f = FORMATIONS[s.tactics.formation]
    if (!f) s.tactics.formation = '4-4-2'
  })[0]
}

export function dismissReport(state: GameState): GameState {
  return act(state, (s) => {
    s.offseasonReport = null
  })[0]
}

export function retireManager(state: GameState): GameState {
  return act(state, (s) => {
    s.retired = true
    pushTimeline(s, 'career', '감독직에서 은퇴')
  })[0]
}
