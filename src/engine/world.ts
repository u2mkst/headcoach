import { LEAGUE_IDS } from '../data/clubs'
import { clFinishAll } from './champions'
import { calOf } from './leagues'
import { quickResult, type TeamSide } from './match'
import type { Rng } from './rng'
import {
  computeStandings,
  leagueClubIds,
  leagueTable,
  orderWithSplit,
  scheduleFor,
  splitFixtures,
  splitGroups,
  userLeagueId,
} from './season'
import { pickLineup, teamOverall } from './squad'
import type { Fixture, GameState, MiniResult, PromoResult } from './types'

function sideOf(s: GameState, id: string): TeamSide {
  const c = s.clubs[id]
  return {
    clubId: id,
    lineup: pickLineup(c.squad, c.formation),
    tactics: { philosophy: c.philosophy, formation: c.formation, pressing: 'mid', line: 'mid' },
    mult: 1,
  }
}

/** 내가 뛰지 않는 리그의 한 시즌을 한꺼번에 돌려 최종 순위(구단 id 순서)를 돌려준다 */
export function quickLeague(s: GameState, rng: Rng, leagueId: string): string[] {
  const ids = leagueClubIds(s, leagueId)
  const cal = calOf(leagueId)
  const cache = new Map<string, TeamSide>()
  const side = (id: string) => cache.get(id) ?? cache.set(id, sideOf(s, id)).get(id)!
  const results: MiniResult[] = []
  const play = (rounds: Fixture[][]) => {
    for (const round of rounds) {
      for (const f of round) results.push({ home: f.home, away: f.away, ...quickResult(rng, side(f.home), side(f.away)) })
    }
  }
  play(scheduleFor(rng, leagueId, ids))
  let split = null
  if (cal.split) {
    split = splitGroups(computeStandings(results, ids))
    play(splitFixtures(rng, split))
  }
  return orderWithSplit(computeStandings(results, ids), split).map((t) => t.clubId)
}

/** 승부차기 포함 두 경기 합산 승강 플레이오프 (K1 11위 vs K2 2위) */
function playoffWinner(s: GameState, rng: Rng, k1: string, k2: string): { winner: string; agg: string } {
  const a = sideOf(s, k1)
  const b = sideOf(s, k2)
  const l1 = quickResult(rng, b, a) // 1차전: K2 팀 홈
  const l2 = quickResult(rng, a, b) // 2차전: K1 팀 홈
  const g1 = l2.hg + l1.ag
  const g2 = l1.hg + l2.ag
  let winner: string
  if (g1 !== g2) winner = g1 > g2 ? k1 : k2
  else winner = rng.chance(0.5 + (teamOverall(s.clubs[k1].squad) - teamOverall(s.clubs[k2].squad)) * 0.006) ? k1 : k2
  return { winner, agg: `${g1}-${g2}${g1 === g2 ? ' (승부차기)' : ''}` }
}

/** K2 1위 자동 승격, K1 12위 자동 강등, K1 11위 vs K2 2위 플레이오프 */
function decidePromotion(s: GameState, rng: Rng): PromoResult {
  const k1 = s.lastFinal.k1
  const k2 = s.lastFinal.k2
  const up = [k2[0]]
  const down = [k1[k1.length - 1]]
  const po = playoffWinner(s, rng, k1[k1.length - 2], k2[1])
  if (po.winner === k2[1]) {
    up.push(k2[1])
    down.push(k1[k1.length - 2])
  }
  return { up, down, playoff: { k1: k1[k1.length - 2], k2: k2[1], winner: po.winner, agg: po.agg } }
}

/**
 * 내 리그가 끝난 시점에 세상의 나머지를 정리한다:
 * 다른 리그 최종 순위, 챔피언스리그 우승팀, K리그 승강.
 */
export function finishWorldSeason(s: GameState, rng: Rng): void {
  const mine = userLeagueId(s)
  s.lastFinal[mine] = leagueTable(s).map((t) => t.clubId)
  for (const league of LEAGUE_IDS) {
    if (league !== mine) s.lastFinal[league] = quickLeague(s, rng, league)
  }
  clFinishAll(s, rng)
  s.promo = decidePromotion(s, rng)
}
