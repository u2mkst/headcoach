import { clubById } from '../data/clubs'
import { josa } from './josa'
import { createRng, type Rng } from './rng'
import {
  evaluateSeason,
  makeOffers,
  newClubSims,
  PHILOSOPHIES,
  refreshMarket,
  runOffseason,
  strengthRanking,
  targetRankFor,
  budgetFor,
} from './career'
import { expireEvents, resolveEvent, rollEvents } from './events'
import { addTrust, newId, pushFeed, pushTimeline, userClub } from './helpers'
import { generateRoundMedia } from './media'
import {
  afterMatchMemory,
  computeStandings,
  generateSchedule,
  ROUNDS,
  simulateRound,
} from './season'
import { assignNumber, clamp, playerLabel, playerValue, randomName, SQUAD_MAX, FORMATIONS, isAvailable, wageBill } from './squad'
import type {
  Abilities,
  Coach,
  Difficulty,
  EventOutcome,
  GameState,
  MatchResult,
  Player,
  Tactics,
} from './types'

export const SAVE_VERSION = 2

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
    manualLineup: null,
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
    market: [],
    pendingCareer: null,
    lastRound: null,
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
  s.manualLineup = null
  s.tacticMemory = { streak: 0, lastKey: null, familiarity: 0, lastPhilosophy: null }
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
  return act(state, (s, rng) => {
    s.market = refreshMarket(s, rng)
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

/* ───────── 전술·선발 ───────── */

export function setTactics(state: GameState, patch: Partial<Tactics>): GameState {
  return act(state, (s) => {
    const prevFormation = s.tactics.formation
    s.tactics = { ...s.tactics, ...patch }
    if (s.tactics.formation !== prevFormation) s.manualLineup = null
  })[0]
}

/** 선발 한 명을 같은 포지션 후보와 바꾼다 */
export function swapStarter(state: GameState, outId: string, inId: string, currentLineup: string[]): GameState {
  return act(state, (s) => {
    const squad = userClub(s).squad
    const a = squad.find((p) => p.id === outId)
    const b = squad.find((p) => p.id === inId)
    if (!a || !b || a.pos !== b.pos || !isAvailable(b)) return
    s.manualLineup = currentLineup.map((id) => (id === outId ? inId : id))
  })[0]
}

export function resetLineup(state: GameState): GameState {
  return act(state, (s) => {
    s.manualLineup = null
  })[0]
}

/* ───────── 라운드 진행 ───────── */

export interface RoundReport {
  userResult: MatchResult
  newEvents: number
  expired: EventOutcome[]
  seasonOver: boolean
}

export function playRound(state: GameState): [GameState, RoundReport] {
  return act(state, (s, rng) => {
    if (s.phase !== 'play' || s.round >= ROUNDS) throw new Error('지금은 경기를 진행할 수 없어요')
    const club = userClub(s)
    const uid = s.userClubId as string
    const injuredBefore = new Set(club.squad.filter((p) => p.injuredRounds > 0).map((p) => p.id))

    const out = simulateRound(s, rng)
    s.results.push(...out.results)
    s.lastRound = out.results
    s.round += 1
    s.tacticMemory = afterMatchMemory(out.userMemory)

    const mine = out.results.find((r) => r.home === uid || r.away === uid) as MatchResult
    const gf = mine.home === uid ? mine.hg : mine.ag
    const ga = mine.home === uid ? mine.ag : mine.hg

    // 재정·신뢰·체력 보정
    club.budget = Math.round((club.budget + 1.5 + (gf > ga ? 0.5 : 0) - wageBill(club.squad)) * 10) / 10
    if (s.coach?.specialty === 'fitness') {
      for (const p of club.squad) p.condition = clamp(p.condition + Math.round(s.coach.rating * 0.4), 20, 100)
    }
    const standings = computeStandings(s.results, Object.keys(s.clubs))
    const rank = standings.findIndex((x) => x.clubId === uid) + 1
    addTrust(s, gf > ga ? 1 : gf < ga ? -1 : 0)
    addTrust(s, rank <= s.targetRank ? 0.3 : -0.3)
    if (s.round >= 9 && rank >= 9) s.wasInDanger = true

    const opp = clubById(mine.home === uid ? mine.away : mine.home).short
    const verdict = gf > ga ? '승리' : gf < ga ? '패배' : '무승부'
    pushTimeline(s, 'result', `${s.round}라운드 ${opp}전 ${mine.hg}-${mine.ag} ${verdict}`)
    generateRoundMedia(s, rng, mine, standings, out.results)

    // 최근 3경기 무승
    const mineAll = s.results.filter((r) => r.home === uid || r.away === uid).slice(-3)
    const recentNoWin =
      mineAll.length >= 3 &&
      mineAll.every((r) => (r.home === uid ? r.hg <= r.ag : r.ag <= r.hg))

    const expired = expireEvents(s, rng)
    const fresh = rollEvents(s, rng, {
      injuredBefore,
      summary: `${opp}전 ${mine.hg}-${mine.ag} ${verdict} 직후, 기자들이 감독 앞으로 몰려들었어요.`,
      userRank: rank,
      recentNoWin,
    })
    s.events.push(...fresh)

    if (s.round % 4 === 0 && s.round < ROUNDS) s.market = refreshMarket(s, rng)

    const seasonOver = s.round >= ROUNDS
    if (seasonOver) evaluateSeason(s, rng)
    return { userResult: mine, newEvents: fresh.length, expired, seasonOver }
  })
}

export function chooseEvent(state: GameState, uid: string, choiceId: string): [GameState, EventOutcome] {
  return act(state, (s, rng) => resolveEvent(s, rng, uid, choiceId))
}

/* ───────── 이적 시장 ───────── */

export function buyPrice(s: GameState, p: Player): number {
  const discount = 1 - ((s.manager?.abilities.negotiation ?? 5) - 5) * 0.02
  return Math.round(playerValue(p) * discount * 10) / 10
}

export function sellPrice(p: Player): number {
  return Math.round(playerValue(p) * 0.75 * 10) / 10
}

export function buyPlayer(state: GameState, playerId: string): [GameState, string | null] {
  return act(state, (s) => {
    const club = userClub(s)
    const i = s.market.findIndex((p) => p.id === playerId)
    if (i < 0) return '이미 다른 곳으로 떠난 선수예요'
    const p = s.market[i]
    const price = buyPrice(s, p)
    if (club.squad.length >= SQUAD_MAX) return `선수단은 최대 ${SQUAD_MAX}명이에요`
    if (club.budget < price) return '예산이 부족해요'
    club.budget -= price
    s.market.splice(i, 1)
    p.contractYears = 3
    p.morale = 70
    assignNumber(club.squad, p)
    club.squad.push(p)
    pushTimeline(s, 'event', `${playerLabel(p)}(능력치 ${p.ovr}) 영입 — ${price}억`)
    return null
  })
}

export function sellPlayer(state: GameState, playerId: string): [GameState, string | null] {
  return act(state, (s) => {
    const club = userClub(s)
    const p = club.squad.find((x) => x.id === playerId)
    if (!p) return '선수를 찾을 수 없어요'
    if (club.squad.length <= 18) return '선수단이 18명 아래로 줄어들 수 없어요'
    if (p.pos === 'GK' && club.squad.filter((x) => x.pos === 'GK').length <= 2) return '골키퍼는 최소 2명이 필요해요'
    const price = sellPrice(p)
    club.squad = club.squad.filter((x) => x.id !== playerId)
    if (s.manualLineup) s.manualLineup = s.manualLineup.filter((id) => id !== playerId)
    club.budget += price
    for (const q of club.squad) q.morale = clamp(q.morale - (p.ovr >= 70 ? 1 : 0), 10, 100)
    pushTimeline(s, 'event', `${playerLabel(p)}(능력치 ${p.ovr}) 이적 — +${price}억`)
    return null
  })
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
      s.market = refreshMarket(s, rng)
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
