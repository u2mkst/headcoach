import { computeStandings } from '../engine/season'
import { PHILOSOPHY_BEATS } from '../engine/squad'
import type { GameState, MatchResult, Philosophy } from '../engine/types'

export const standingsOf = (s: GameState) => computeStandings(s.results, Object.keys(s.clubs))

export const userRank = (s: GameState) => standingsOf(s).findIndex((x) => x.clubId === s.userClubId) + 1

export const userResults = (s: GameState): MatchResult[] =>
  s.results.filter((r) => r.home === s.userClubId || r.away === s.userClubId)

export function nextFixture(s: GameState) {
  const round = s.fixtures[s.round]
  if (!round) return null
  const f = round.find((x) => x.home === s.userClubId || x.away === s.userClubId)
  if (!f) return null
  const home = f.home === s.userClubId
  return { round: s.round + 1, home, oppId: home ? f.away : f.home }
}

export type Matchup = 'advantage' | 'even' | 'disadvantage'

export function matchupOf(mine: Philosophy, theirs: Philosophy): Matchup {
  if (PHILOSOPHY_BEATS[mine] === theirs) return 'advantage'
  if (PHILOSOPHY_BEATS[theirs] === mine) return 'disadvantage'
  return 'even'
}

export const MATCHUP_LABEL: Record<Matchup, string> = {
  advantage: '상성 우위',
  even: '상성 보통',
  disadvantage: '상성 불리',
}

export const resultOf = (r: MatchResult, clubId: string) => {
  const gf = r.home === clubId ? r.hg : r.ag
  const ga = r.home === clubId ? r.ag : r.hg
  return { gf, ga, kind: gf > ga ? ('w' as const) : gf < ga ? ('l' as const) : ('d' as const) }
}

export const KIND_LABEL = { w: '승', d: '무', l: '패' } as const
