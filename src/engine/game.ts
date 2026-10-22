import { clubById } from '../data/clubs'
import { josa } from './josa'
import { createRng, type Rng } from './rng'
import {
  evaluateSeason,
  newClubSims,
  PHILOSOPHIES,
  runOffseason,
  startOffers,
  targetFor,
} from './career'
import { clRunNext, setupCl, userInCl } from './champions'
import { expireEvents, resolveEvent, rollEvents } from './events'
import { addTrust, newId, pushFeed, pushTimeline, userClub } from './helpers'
import { generateMonthMedia } from './media'
import { INITIAL_FAN, updateFan } from './fans'
import { budgetFor, calOf, CL_MONTH_TOKENS, economyScale, isEuropeLeagueId } from './leagues'
import { applyPlan, planCost, planScale } from './reinforce'
import {
  computeStandings,
  leagueClubIds,
  leagueTable,
  scheduleFor,
  simulateFixtures,
  splitFixtures,
  splitGroups,
  userLeagueId,
} from './season'
import { randomName, FORMATIONS, wageBill, clamp } from './squad'
import type {
  Abilities,
  Coach,
  EventOutcome,
  GameState,
  MatchResult,
  MonthPlan,
  MonthReport,
  Tactics,
} from './types'

export const SAVE_VERSION = 4

export const DEFAULT_TACTICS: Tactics = { philosophy: 'possession', formation: '4-4-2', pressing: 'mid', line: 'mid' }

/** 모든 감독은 같은 명성에서 시작한다 */
export const START_REPUTATION = 30

export interface ManagerStyle {
  id: string
  label: string
  /** 한 줄 성향 */
  tagline: string
  desc: string
  /** 능력치 합은 모두 27 (기본 3씩 + 12점) */
  abilities: Abilities
  /** 이 감독이 처음 잡는 전술 */
  tactics: Tactics
}

export const MANAGER_STYLES: ManagerStyle[] = [
  {
    id: 'defensive',
    label: '수비적 · 보수적',
    tagline: '실점부터 줄이는 단단한 팀',
    desc: '라인을 내리고 수비를 두텁게 세워요. 흔들림 없는 운영과 협상에 강해요.',
    abilities: { tactics: 7, leadership: 6, communication: 4, youth: 4, negotiation: 6 },
    tactics: { philosophy: 'defense', formation: '5-3-2', pressing: 'low', line: 'low' },
  },
  {
    id: 'attacking',
    label: '공격적 · 역동적',
    tagline: '높이 올라가 몰아붙이는 팀',
    desc: '압박하고 라인을 올려 먼저 공격해요. 말솜씨가 좋아 팬을 끌어모아요.',
    abilities: { tactics: 6, leadership: 5, communication: 7, youth: 4, negotiation: 5 },
    tactics: { philosophy: 'attack', formation: '4-3-3', pressing: 'high', line: 'high' },
  },
  {
    id: 'tactician',
    label: '지략가 · 분석적',
    tagline: '공을 쥐고 경기를 설계하는 팀',
    desc: '점유와 짜임새로 경기를 풀어요. 전술 완성도가 가장 높아요.',
    abilities: { tactics: 8, leadership: 4, communication: 5, youth: 5, negotiation: 5 },
    tactics: { philosophy: 'possession', formation: '4-2-3-1', pressing: 'mid', line: 'mid' },
  },
  {
    id: 'builder',
    label: '실리적 · 육성형',
    tagline: '어린 선수를 키워 역습으로 찌르는 팀',
    desc: '유소년을 키우고 선수단을 하나로 묶어요. 역습으로 효율적으로 싸워요.',
    abilities: { tactics: 5, leadership: 6, communication: 4, youth: 8, negotiation: 4 },
    tactics: { philosophy: 'counter', formation: '4-4-2', pressing: 'mid', line: 'low' },
  },
]

export const NATIONALITIES = ['대한민국', '일본', '브라질', '스페인', '독일', '기타']

export function emptyState(seed: number): GameState {
  const s: GameState = {
    version: SAVE_VERSION,
    rng: seed >>> 0,
    phase: 'create',
    manager: null,
    userClubId: null,
    coach: null,
    offers: [],
    coachCandidates: [],
    season: 1,
    round: 0,
    month: 0,
    clubs: {},
    fixtures: [],
    split: null,
    lastFinal: {},
    cl: null,
    clHistory: [],
    promo: null,
    clTitles: 0,
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
  setupCl(s, rng)
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

export function createManager(
  state: GameState,
  input: { name: string; nationality: string; style: string },
): GameState {
  return act(state, (s) => {
    const style = MANAGER_STYLES.find((m) => m.id === input.style) ?? MANAGER_STYLES[0]
    s.manager = {
      name: input.name.trim() || '무명',
      nationality: input.nationality,
      background: style.label,
      style: style.id,
      abilities: { ...style.abilities },
      reputation: START_REPUTATION,
    }
    s.offers = startOffers(s)
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
    if (!offer) throw new Error('구단을 찾을 수 없어요')
    joinClub(s, rng, offer.clubId)
    s.coachCandidates = makeCoachCandidates(s, rng)
    s.phase = 'coach'
  })[0]
}

function joinClub(s: GameState, rng: Rng, clubId: string) {
  s.userClubId = clubId
  const club = s.clubs[clubId]
  s.targetRank = targetFor(s, clubId)
  const budget = budgetFor(clubById(clubId).strength)
  club.budget = budget
  s.seasonStartBudget = budget
  // 소속 리그에 맞는 일정으로 새 시즌을 시작한다
  s.round = 0
  s.month = 0
  s.split = null
  s.results = []
  s.fixtures = scheduleFor(rng, club.league, leagueClubIds(s, club.league))
  s.ownerTrust = 55
  const style = MANAGER_STYLES.find((m) => m.id === s.manager?.style)
  s.tactics = style ? { ...style.tactics } : { ...DEFAULT_TACTICS, philosophy: club.philosophy, formation: club.formation }
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
    if (plan && planCost(plan, planScale(s)) > userClub(s).budget) return '예산이 부족해요'
    s.monthPlan = plan
    return null
  })
}

/* ───────── 한 달 진행 ───────── */

/** 내 경기 하나가 끝난 뒤의 신뢰·재정 반영 */
function afterUserMatch(s: GameState, r: MatchResult, leagueRound: boolean): void {
  const uid = s.userClubId as string
  const club = userClub(s)
  const scale = economyScale(clubById(uid).strength)
  const gf = r.home === uid ? r.hg : r.ag
  const ga = r.home === uid ? r.ag : r.hg
  if (leagueRound) {
    club.budget = Math.round((club.budget + scale * (1.5 + (gf > ga ? 0.5 : 0)) - wageBill(club.squad, clubById(uid).strength)) * 10) / 10
    if (s.coach?.specialty === 'fitness') {
      for (const p of club.squad) p.condition = clamp(p.condition + Math.round(s.coach.rating * 0.4), 20, 100)
    }
  } else {
    club.budget = Math.round((club.budget + scale * (r.home === uid ? 1.2 : 0.4)) * 10) / 10
  }
  addTrust(s, gf > ga ? 1 : gf < ga ? -1 : 0)
}

/** 내 리그의 다음 한 라운드를 진행하고 내 경기 결과를 돌려준다 */
function stepLeagueRound(s: GameState, rng: Rng): MatchResult {
  const uid = s.userClubId as string
  const league = userLeagueId(s)
  const cal = calOf(league)
  const results = simulateFixtures(s, rng, s.fixtures[s.round], { comp: league, round: s.round + 1 })
  s.results.push(...results)
  s.round += 1
  const mine = results.find((r) => r.home === uid || r.away === uid) as MatchResult
  afterUserMatch(s, mine, true)

  // K리그1: 33라운드가 끝나면 상위 6 / 하위 6으로 나눠 5라운드를 더 치른다
  if (cal.split && s.round === cal.baseRounds && !s.split) {
    const t = computeStandings(
      s.results.filter((r) => r.comp === league),
      leagueClubIds(s, league),
    )
    s.split = splitGroups(t)
    s.fixtures.push(...splitFixtures(rng, s.split))
  }

  const table = leagueTable(s)
  const rank = table.findIndex((x) => x.clubId === uid) + 1
  addTrust(s, rank <= s.targetRank ? 0.3 : -0.3)
  if (s.round >= Math.floor(cal.rounds / 2) && rank >= table.length - 1) s.wasInDanger = true
  return mine
}

export interface MonthOutcome {
  report: MonthReport
  newEvents: number
  expired: EventOutcome[]
  seasonOver: boolean
}

/** 이번 달 일정: 리그 라운드 수와, 내가 챔피언스리그에 있다면 그 달 CL 경기 수 */
export function monthSchedule(s: GameState): { leagueRounds: number; clTokens: number } {
  const cal = calOf(userLeagueId(s))
  const clTokens = userInCl(s) && isEuropeLeagueId(userLeagueId(s)) ? (CL_MONTH_TOKENS[s.month] ?? []).length : 0
  return { leagueRounds: cal.monthRounds[s.month] ?? 0, clTokens }
}

/** 한 달을 진행한다: 보강 계획 적용 → 경기(리그·챔피언스리그) → 지지도 → 기사·커뮤니티 → 이벤트 */
export function playMonth(state: GameState): [GameState, MonthOutcome] {
  return act(state, (s, rng) => {
    const league = userLeagueId(s)
    const cal = calOf(league)
    if (s.phase !== 'play' || s.month >= cal.months.length) throw new Error('지금은 진행할 수 없어요')
    const club = userClub(s)
    const uid = s.userClubId as string
    const label = cal.months[s.month]
    const rankBefore = s.round === 0 ? 0 : leagueTable(s).findIndex((x) => x.clubId === uid) + 1
    const fanBefore = { ...s.fan }
    const trustBefore = s.ownerTrust
    const injuredBefore = new Set(club.squad.filter((p) => p.injuredRounds > 0).map((p) => p.id))

    // 이번 달 보강 계획 적용
    const plan = s.monthPlan
    const applied = plan ? applyPlan(s, rng, plan) : null
    s.monthPlan = null

    const mine: MatchResult[] = []
    const { leagueRounds, clTokens } = monthSchedule(s)
    for (let i = 0; i < Math.max(leagueRounds, clTokens); i++) {
      if (i < leagueRounds) mine.push(stepLeagueRound(s, rng))
      if (i < clTokens) {
        for (const r of clRunNext(s, rng)) {
          s.results.push(r)
          mine.push(r)
          afterUserMatch(s, r, false)
        }
      }
    }
    s.month += 1
    s.fitnessBoost = 0

    const table = leagueTable(s)
    const rankAfter = table.findIndex((x) => x.clubId === uid) + 1
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
      month: s.month - 1,
      label,
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
    report.highlights = generateMonthMedia(s, rng, report, table, plan, !!applied?.applied)
    s.monthReport = report
    pushTimeline(s, 'result', `${label} ${w}승 ${d}무 ${l}패 · ${rankAfter}위 · 지지도 ${Math.round(s.fan.support)}%`)

    const expired = expireEvents(s, rng)
    const fresh = rollEvents(s, rng, {
      injuredBefore,
      summary: `${label} ${w}승 ${d}무 ${l}패를 마친 직후, 기자들이 감독 앞으로 몰려들었어요.`,
      userRank: rankAfter,
      recentNoWin: w === 0 || s.fan.support < 30,
    })
    s.events.push(...fresh)

    const seasonOver = s.month >= cal.months.length
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
      joinClub(s, rng, offer.clubId)
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
