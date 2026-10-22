import type { Rng } from './rng'
import { simulateMatch, type TeamSide } from './match'
import { pickLineup, clamp } from './squad'
import type {
  ClubSim,
  Fixture,
  GameState,
  MatchResult,
  Player,
  Standing,
  TacticMemory,
  Tactics,
} from './types'

export const EXPOSURE_AFTER = 5

/** 원형 배치 방식으로 만든 한 바퀴 라운드(홈/원정 미정) */
export function circleRounds(ids: string[]): [string, string][][] {
  const n = ids.length
  const arr = [...ids]
  const rounds: [string, string][][] = []
  for (let r = 0; r < n - 1; r++) {
    const round: [string, string][] = []
    for (let i = 0; i < n / 2; i++) round.push([arr[i], arr[n - 1 - i]])
    rounds.push(round)
    arr.splice(1, 0, arr.pop() as string)
  }
  return rounds
}

/** 한 바퀴 풀리그: 홈/원정이 한쪽에 쏠리지 않도록 교대로 배치 */
export function halfRobin(rng: Rng, clubIds: string[]): Fixture[][] {
  return circleRounds(rng.shuffle(clubIds)).map((round, r) =>
    round.map(([a, b], i) => ((r + i) % 2 === 0 ? { home: a, away: b } : { home: b, away: a })),
  )
}

/** 더블 라운드 로빈: 전반 + 홈/원정을 뒤집은 후반 */
export function generateSchedule(rng: Rng, clubIds: string[]): Fixture[][] {
  const half = halfRobin(rng, clubIds)
  const second = half.map((round) => round.map((f) => ({ home: f.away, away: f.home })))
  return [...half, ...second]
}

/** 3바퀴: K리그처럼 팀 수에 비해 경기가 많을 때. 세 번째 바퀴는 라운드 순서를 섞고 홈/원정을 무작위로 정한다 */
export function tripleSchedule(rng: Rng, clubIds: string[]): Fixture[][] {
  const base = generateSchedule(rng, clubIds)
  const third = rng
    .shuffle(base.slice(0, clubIds.length - 1))
    .map((round) => round.map((f) => (rng.chance(0.5) ? f : { home: f.away, away: f.home })))
  return [...base, ...third]
}

/** 리그 종류에 맞는 일정을 만든다 (K1은 스플릿 전 33라운드까지) */
export function scheduleFor(rng: Rng, leagueId: string, clubIds: string[]): Fixture[][] {
  return leagueId === 'k1' || leagueId === 'k2' ? tripleSchedule(rng, clubIds) : generateSchedule(rng, clubIds)
}

/** 순위표 계산에 필요한 최소 정보 */
export interface ResultLike {
  home: string
  away: string
  hg: number
  ag: number
}

export function computeStandings(results: ResultLike[], clubIds: string[]): Standing[] {
  const table = new Map<string, Standing>(
    clubIds.map((id) => [id, { clubId: id, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0 }]),
  )
  for (const r of results) {
    const h = table.get(r.home)
    const a = table.get(r.away)
    if (!h || !a) continue
    h.p++
    a.p++
    h.gf += r.hg
    h.ga += r.ag
    a.gf += r.ag
    a.ga += r.hg
    if (r.hg > r.ag) {
      h.w++
      a.l++
      h.pts += 3
    } else if (r.hg < r.ag) {
      a.w++
      h.l++
      a.pts += 3
    } else {
      h.d++
      a.d++
      h.pts++
      a.pts++
    }
  }
  return [...table.values()].sort(
    (x, y) =>
      y.pts - x.pts ||
      y.gf - y.ga - (x.gf - x.ga) ||
      y.gf - x.gf ||
      x.clubId.localeCompare(y.clubId),
  )
}

/** K1 스플릿 그룹: 33라운드 순위로 상위 6 / 하위 6 */
export function splitGroups(table: Standing[]): { top: string[]; bottom: string[] } {
  const half = Math.floor(table.length / 2)
  return { top: table.slice(0, half).map((t) => t.clubId), bottom: table.slice(half).map((t) => t.clubId) }
}

/** 스플릿 이후 각 그룹 안에서 한 바퀴(5라운드). 그룹 일정을 라운드별로 합친다 */
export function splitFixtures(rng: Rng, g: { top: string[]; bottom: string[] }): Fixture[][] {
  const a = halfRobin(rng, g.top)
  const b = halfRobin(rng, g.bottom)
  return a.map((round, i) => [...round, ...b[i]])
}

/** 스플릿이 있으면 상위 그룹이 항상 하위 그룹보다 위에 놓인다 */
export function orderWithSplit(table: Standing[], split: { top: string[]; bottom: string[] } | null): Standing[] {
  if (!split) return table
  const top = new Set(split.top)
  return [...table.filter((t) => top.has(t.clubId)), ...table.filter((t) => !top.has(t.clubId))]
}

/** 지금 내 구단이 속한 리그 */
export const userLeagueId = (s: GameState): string => s.clubs[s.userClubId as string]?.league ?? 'k1'

export const leagueClubIds = (s: GameState, leagueId: string): string[] =>
  Object.values(s.clubs)
    .filter((c) => c.league === leagueId)
    .map((c) => c.id)

/** 내 리그의 현재 순위표 (K1은 스플릿 그룹 순서 반영) */
export function leagueTable(s: GameState): Standing[] {
  const league = userLeagueId(s)
  const table = computeStandings(
    s.results.filter((r) => r.comp === league),
    leagueClubIds(s, league),
  )
  return orderWithSplit(table, s.split)
}

export const tacticKey = (t: Tactics) => `${t.philosophy}|${t.formation}|${t.pressing}|${t.line}`

/** 이번 경기에 적용할 전술 기억 (경기 전에 계산) */
export function nextTacticMemory(mem: TacticMemory, t: Tactics): TacticMemory {
  const key = tacticKey(t)
  const sameKey = mem.lastKey === key
  const samePhil = mem.lastPhilosophy === t.philosophy
  return {
    streak: sameKey ? mem.streak + 1 : 1,
    lastKey: key,
    familiarity: samePhil ? mem.familiarity : Math.round(mem.familiarity * 0.35),
    lastPhilosophy: t.philosophy,
  }
}

export const familiarityBonus = (fam: number) => 0.025 * (fam / 100)
export const exposurePenalty = (streak: number) =>
  streak >= EXPOSURE_AFTER ? Math.min(0.02, 0.01 * (streak - EXPOSURE_AFTER + 1)) : 0

/** 경기 후 숙련도 상승 */
export const afterMatchMemory = (mem: TacticMemory): TacticMemory => ({
  ...mem,
  familiarity: clamp(mem.familiarity + 12, 0, 100),
})

export function userMultiplier(state: GameState, mem: TacticMemory): number {
  const mgr = state.manager
  let m = 1 + familiarityBonus(mem.familiarity) - exposurePenalty(mem.streak)
  if (mgr) m += (mgr.abilities.tactics - 5) * 0.002
  if (state.coach?.specialty === 'tactics') m += state.coach.rating * 0.0004
  return m
}

function aiTactics(club: ClubSim): Tactics {
  return { philosophy: club.philosophy, formation: club.formation, pressing: 'mid', line: 'mid' }
}

export interface FixtureMeta {
  comp: string
  round: number
  stage?: string
}

/**
 * 주어진 경기들을 진행한다. 내 구단 경기가 있으면 내 전술·숙련도를 쓰고, 선수 상태도 갱신한다.
 * (경기가 많은 리그에서도 같은 함수를 쓴다.)
 */
export function simulateFixtures(state: GameState, rng: Rng, fixtures: Fixture[], meta: FixtureMeta): MatchResult[] {
  const uid = state.userClubId
  const userPlays = fixtures.some((f) => f.home === uid || f.away === uid)
  const userMemory = userPlays ? nextTacticMemory(state.tacticMemory, state.tactics) : state.tacticMemory
  const results: MatchResult[] = []
  const lineups = new Map<string, Player[]>()

  const sideFor = (clubId: string): TeamSide => {
    const club = state.clubs[clubId]
    if (clubId === uid) {
      const lineup = pickLineup(club.squad, state.tactics.formation)
      lineups.set(clubId, lineup)
      return { clubId, lineup, tactics: state.tactics, mult: userMultiplier(state, userMemory) }
    }
    const lineup = pickLineup(club.squad, club.formation)
    lineups.set(clubId, lineup)
    return { clubId, lineup, tactics: aiTactics(club), mult: 1 }
  }

  for (const f of fixtures) {
    const sim = simulateMatch(rng, sideFor(f.home), sideFor(f.away))
    results.push({ season: state.season, round: meta.round, comp: meta.comp, stage: meta.stage, ...sim.result })
  }

  for (const r of results) {
    for (const clubId of [r.home, r.away]) {
      const club = state.clubs[clubId]
      const lineup = lineups.get(clubId) as Player[]
      const mine = clubId === r.home ? r.hg : r.ag
      const theirs = clubId === r.home ? r.ag : r.hg
      const pressing = clubId === uid ? state.tactics.pressing : 'mid'
      const care = clubId === uid ? state.fitnessBoost : 0
      applyMatchToSquad(rng, club.squad, lineup, r, mine - theirs, pressing, clubId, care)
    }
  }
  if (userPlays) state.tacticMemory = afterMatchMemory(userMemory)
  return results
}

/** 경기 후 선수 상태 갱신: 출전·득점·컨디션·사기·부상 */
function applyMatchToSquad(
  rng: Rng,
  squad: Player[],
  lineup: Player[],
  result: MatchResult,
  diff: number,
  pressing: 'low' | 'mid' | 'high',
  clubId: string,
  /** 컨디션 관리 강도 (0~3): 회복이 빨라지고 부상이 줄어든다 */
  care: number,
) {
  const started = new Set(lineup.map((p) => p.id))
  const goals = new Map<string, number>()
  for (const s of result.scorers) if (s.clubId === clubId) goals.set(s.playerId, (goals.get(s.playerId) ?? 0) + 1)
  const drain = pressing === 'high' ? 13 : pressing === 'low' ? 8 : 10
  const resultMorale = diff > 0 ? 4 : diff < 0 ? -4 : 0

  for (const p of squad) {
    const played = started.has(p.id)
    if (p.injuredRounds > 0) {
      p.injuredRounds--
      p.condition = clamp(p.condition + 4, 20, 100)
      continue
    }
    if (played) {
      p.seasonApps++
      p.careerApps++
      p.benchStreak = 0
      const g = goals.get(p.id) ?? 0
      p.seasonGoals += g
      p.careerGoals += g
      p.condition = clamp(p.condition - drain + 6 + care * 2, 20, 100)
      p.morale = clamp(p.morale + resultMorale + g * 2, 10, 100)
      const injuryRisk = (0.018 + (p.condition < 55 ? 0.025 : 0) + (pressing === 'high' ? 0.006 : 0)) * (1 - care * 0.15)
      if (rng.chance(injuryRisk)) {
        const roll = rng.next()
        p.injuredRounds = roll < 0.6 ? rng.int(1, 2) : roll < 0.92 ? rng.int(3, 5) : rng.int(6, 9)
      }
    } else {
      p.benchStreak++
      p.condition = clamp(p.condition + 9 + care * 2, 20, 100)
      // 못 뛰는 주전급 선수의 불만 누적
      const isNotable = p.ovr >= 66
      p.morale = clamp(p.morale + (resultMorale > 0 ? 1 : 0) - (isNotable && p.benchStreak >= 3 ? 3 : 0), 10, 100)
    }
  }
}
