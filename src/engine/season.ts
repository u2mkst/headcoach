import type { Rng } from './rng'
import { simulateMatch, type TeamSide } from './match'
import { pickLineup, resolveLineup, clamp } from './squad'
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

export const ROUNDS = 18
export const EXPOSURE_AFTER = 5

/** 원형 배치 방식 풀리그: 전반 9라운드 + 홈/원정을 뒤집은 후반 9라운드 */
export function generateSchedule(rng: Rng, clubIds: string[]): Fixture[][] {
  const ids = rng.shuffle(clubIds)
  const n = ids.length
  const half: Fixture[][] = []
  const arr = [...ids]
  for (let r = 0; r < n - 1; r++) {
    const round: Fixture[] = []
    for (let i = 0; i < n / 2; i++) {
      const a = arr[i]
      const b = arr[n - 1 - i]
      // 홈/원정이 한쪽에 쏠리지 않도록 교대로 배치
      round.push((r + i) % 2 === 0 ? { home: a, away: b } : { home: b, away: a })
    }
    half.push(round)
    arr.splice(1, 0, arr.pop() as string)
  }
  const second = half.map((round) => round.map((f) => ({ home: f.away, away: f.home })))
  return [...half, ...second]
}

export function computeStandings(results: MatchResult[], clubIds: string[]): Standing[] {
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

export const familiarityBonus = (fam: number) => 0.04 * (fam / 100)
export const exposurePenalty = (streak: number) =>
  streak >= EXPOSURE_AFTER ? Math.min(0.03, 0.015 * (streak - EXPOSURE_AFTER + 1)) : 0

/** 경기 후 숙련도 상승 */
export const afterMatchMemory = (mem: TacticMemory): TacticMemory => ({
  ...mem,
  familiarity: clamp(mem.familiarity + 12, 0, 100),
})

export function userMultiplier(state: GameState, mem: TacticMemory): number {
  const mgr = state.manager
  let m = 1 + familiarityBonus(mem.familiarity) - exposurePenalty(mem.streak)
  if (mgr) m += (mgr.abilities.tactics - 5) * 0.003
  if (state.coach?.specialty === 'tactics') m += state.coach.rating * 0.0006
  if (state.difficulty === 'easy') m += 0.015
  if (state.difficulty === 'hard') m -= 0.015
  return m
}

function aiTactics(club: ClubSim): Tactics {
  return { philosophy: club.philosophy, formation: club.formation, pressing: 'mid', line: 'mid' }
}

interface RoundOutput {
  results: MatchResult[]
  userMemory: TacticMemory
}

export function simulateRound(state: GameState, rng: Rng): RoundOutput {
  const fixtures = state.fixtures[state.round]
  const results: MatchResult[] = []
  const userMemory = nextTacticMemory(state.tacticMemory, state.tactics)
  const lineups = new Map<string, Player[]>()

  const sideFor = (clubId: string): TeamSide => {
    const club = state.clubs[clubId]
    if (clubId === state.userClubId) {
      const lineup = resolveLineup(club.squad, state.tactics.formation, state.manualLineup)
      lineups.set(clubId, lineup)
      return { clubId, lineup, tactics: state.tactics, mult: userMultiplier(state, userMemory) }
    }
    const lineup = pickLineup(club.squad, club.formation)
    lineups.set(clubId, lineup)
    const diff = state.difficulty === 'easy' ? 0.985 : state.difficulty === 'hard' ? 1.015 : 1
    return { clubId, lineup, tactics: aiTactics(club), mult: diff }
  }

  for (const f of fixtures) {
    const sim = simulateMatch(rng, sideFor(f.home), sideFor(f.away))
    results.push({ season: state.season, round: state.round + 1, ...sim.result })
  }

  for (const r of results) {
    for (const clubId of [r.home, r.away]) {
      const club = state.clubs[clubId]
      const lineup = lineups.get(clubId) as Player[]
      const mine = clubId === r.home ? r.hg : r.ag
      const theirs = clubId === r.home ? r.ag : r.hg
      const pressing = clubId === state.userClubId ? state.tactics.pressing : 'mid'
      applyMatchToSquad(rng, club.squad, lineup, r, mine - theirs, pressing, clubId)
    }
  }
  return { results, userMemory }
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
      p.condition = clamp(p.condition - drain + 6, 20, 100)
      p.morale = clamp(p.morale + resultMorale + g * 2, 10, 100)
      const injuryRisk = 0.018 + (p.condition < 55 ? 0.025 : 0) + (pressing === 'high' ? 0.006 : 0)
      if (rng.chance(injuryRisk)) {
        const roll = rng.next()
        p.injuredRounds = roll < 0.6 ? rng.int(1, 2) : roll < 0.92 ? rng.int(3, 5) : rng.int(6, 9)
      }
    } else {
      p.benchStreak++
      p.condition = clamp(p.condition + 9, 20, 100)
      // 못 뛰는 주전급 선수의 불만 누적
      const isNotable = p.ovr >= 66
      p.morale = clamp(p.morale + (resultMorale > 0 ? 1 : 0) - (isNotable && p.benchStreak >= 3 ? 3 : 0), 10, 100)
    }
  }
}
