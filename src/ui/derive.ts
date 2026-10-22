import { computeStandings, MONTH_LABEL, MONTH_ROUNDS } from '../engine/season'
import { PHILOSOPHY_BEATS } from '../engine/squad'
import { LINE_SLOTS } from '../engine/reinforce'
import type { GameState, MatchResult, Philosophy, Player, Position } from '../engine/types'

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

/* ───────── 월 단위 ───────── */

/** 지금 진행할 달 (0~5) */
export const currentMonthIndex = (s: GameState) => Math.min(5, Math.floor(s.round / MONTH_ROUNDS))
export const currentMonthLabel = (s: GameState) => MONTH_LABEL[currentMonthIndex(s)]

/** 이번 달에 치를 내 경기들 */
export function monthFixtures(s: GameState) {
  const out: { round: number; home: boolean; oppId: string }[] = []
  for (let r = s.round; r < Math.min(s.fixtures.length, (currentMonthIndex(s) + 1) * MONTH_ROUNDS); r++) {
    const f = s.fixtures[r].find((x) => x.home === s.userClubId || x.away === s.userClubId)
    if (f) out.push({ round: r + 1, home: f.home === s.userClubId, oppId: f.home === s.userClubId ? f.away : f.home })
  }
  return out
}

export interface LineInfo {
  pos: Position
  label: string
  /** 주전 능력치 평균 */
  rating: number
  /** 리그 10개 구단 중 순위 */
  rank: number
  condition: number
  morale: number
  injured: number
  count: number
  avgAge: number
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const LINE_LABEL: Record<Position, string> = { GK: '골키퍼', DF: '수비', MF: '중원', FW: '공격' }

const lineRating = (squad: Player[], pos: Position) =>
  avg(
    squad
      .filter((p) => p.pos === pos)
      .map((p) => p.ovr)
      .sort((a, b) => b - a)
      .slice(0, LINE_SLOTS[pos]),
  )

/** 포지션 라인별 전력과 리그 내 순위 */
export function lineInfos(s: GameState): LineInfo[] {
  const mine = s.clubs[s.userClubId as string].squad
  return (['FW', 'MF', 'DF', 'GK'] as Position[]).map((pos) => {
    const rating = lineRating(mine, pos)
    const better = Object.values(s.clubs).filter((c) => c.id !== s.userClubId && lineRating(c.squad, pos) > rating).length
    const line = mine.filter((p) => p.pos === pos)
    return {
      pos,
      label: LINE_LABEL[pos],
      rating: Math.round(rating * 10) / 10,
      rank: better + 1,
      condition: Math.round(avg(line.map((p) => p.condition))),
      morale: Math.round(avg(line.map((p) => p.morale))),
      injured: line.filter((p) => p.injuredRounds > 0).length,
      count: line.length,
      avgAge: Math.round(avg(line.map((p) => p.age)) * 10) / 10,
    }
  })
}
