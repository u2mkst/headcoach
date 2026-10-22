import { CL_SEQUENCE } from '../engine/champions'
import { calOf, CL_MONTH_TOKENS, isEuropeLeagueId } from '../engine/leagues'
import { leagueTable, userLeagueId } from '../engine/season'
import { PHILOSOPHY_BEATS } from '../engine/squad'
import { LINE_SLOTS } from '../engine/reinforce'
import type { GameState, MatchResult, Philosophy, Player, Position } from '../engine/types'

export const standingsOf = (s: GameState) => leagueTable(s)

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

export const currentCal = (s: GameState) => calOf(userLeagueId(s))
export const currentMonthLabel = (s: GameState) => currentCal(s).months[Math.min(s.month, currentCal(s).months.length - 1)]

/** 이번 달에 치를 내 리그 경기들 */
export function monthFixtures(s: GameState) {
  const cal = currentCal(s)
  const out: { round: number; home: boolean; oppId: string }[] = []
  const n = cal.monthRounds[s.month] ?? 0
  for (let r = s.round; r < Math.min(s.fixtures.length, s.round + n); r++) {
    const f = s.fixtures[r].find((x) => x.home === s.userClubId || x.away === s.userClubId)
    if (f) out.push({ round: r + 1, home: f.home === s.userClubId, oppId: f.home === s.userClubId ? f.away : f.home })
  }
  return out
}

/** 이번 달 챔피언스리그 일정(내가 출전할 때). 대진이 정해진 경기만 상대와 함께 보여준다 */
export function monthClFixtures(s: GameState): { label: string; oppId?: string; home?: boolean }[] {
  const cl = s.cl
  const uid = s.userClubId
  if (!cl || !uid || !cl.entrants.includes(uid) || !isEuropeLeagueId(userLeagueId(s))) return []
  const tokens = CL_MONTH_TOKENS[s.month] ?? []
  const out: { label: string; oppId?: string; home?: boolean }[] = []
  let step = cl.step
  let md = cl.matchday
  let undrawn = false
  for (let i = 0; i < tokens.length; i++) {
    const seq = CL_SEQ[step++] ?? ''
    if (seq === 'md') {
      const f = cl.fixtures[md]?.find((x) => x.home === uid || x.away === uid)
      if (f) out.push({ label: `챔피언스리그 · 리그 페이즈 ${md + 1}차전`, oppId: f.home === uid ? f.away : f.home, home: f.home === uid })
      md++
      continue
    }
    const stage = seq.startsWith('po') ? 'po' : seq.startsWith('r16') ? 'r16' : seq.startsWith('qf') ? 'qf' : seq.startsWith('sf') ? 'sf' : 'final'
    const ties = cl[stage as 'po' | 'r16' | 'qf' | 'sf' | 'final']
    if (ties.length === 0) {
      // 이전 단계가 끝나야 대진이 정해진다
      undrawn = true
      continue
    }
    const tie = ties.find((x) => x.a === uid || x.b === uid)
    if (!tie) continue // 이 단계에는 직행했거나 이미 탈락했다
    const name = { po1: '플레이오프 1차전', po2: '플레이오프 2차전', r16_1: '16강 1차전', r16_2: '16강 2차전', qf1: '8강 1차전', qf2: '8강 2차전', sf1: '4강 1차전', sf2: '4강 2차전', final: '결승' }[seq] ?? seq
    const opp = tie.a === uid ? tie.b : tie.a
    const leg1 = seq.endsWith('1')
    out.push({ label: `챔피언스리그 · ${name}`, oppId: opp, home: seq === 'final' ? true : leg1 ? tie.b === uid : tie.a === uid })
  }
  if (undrawn && out.length === 0) out.push({ label: '챔피언스리그 토너먼트 · 리그 페이즈 순위로 대진이 정해져요' })
  return out
}
const CL_SEQ = CL_SEQUENCE

export interface LineInfo {
  pos: Position
  label: string
  /** 주전 능력치 평균 */
  rating: number
  /** 리그 안에서의 순위 */
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
    const better = Object.values(s.clubs).filter((c) => c.league === userLeagueId(s) && c.id !== s.userClubId && lineRating(c.squad, pos) > rating).length
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
