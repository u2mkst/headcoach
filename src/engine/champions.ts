import { clubById, EUROPE_LEAGUES, OTHER_EU } from '../data/clubs'
import { quickResult, type TeamSide } from './match'
import type { Rng } from './rng'
import { circleRounds, computeStandings, simulateFixtures } from './season'
import { pickLineup, teamOverall } from './squad'
import type { ClState, ClTie, Fixture, GameState, MatchResult, MiniResult } from './types'

/** 36팀: 5대 리그 상위 팀 + 그 밖의 유럽 구단 */
const LEAGUE_SLOTS: Record<string, number> = { epl: 4, laliga: 4, bundesliga: 4, seriea: 4, ligue1: 3 }
const OTHER_SLOTS = 17
export const CL_TEAMS = 36

/** 한 시즌의 챔피언스리그 진행 순서 (달 일정이 이 순서대로 하나씩 꺼내 쓴다) */
export const CL_SEQUENCE = [
  ...Array<string>(8).fill('md'),
  'po1', 'po2', 'r16_1', 'r16_2', 'qf1', 'qf2', 'sf1', 'sf2', 'final',
]

export const CL_PHASE_LABEL: Record<string, string> = {
  league: '리그 페이즈',
  po: '플레이오프',
  r16: '16강',
  qf: '8강',
  sf: '4강',
  final: '결승',
  done: '종료',
}

const clubsIn = (s: GameState, league: string) => Object.values(s.clubs).filter((c) => c.league === league)

/** 지난 시즌 최종 순위(없으면 전력 순위)로 출전 36팀을 정한다 */
export function clEntrants(s: GameState): string[] {
  const ids: string[] = []
  for (const league of EUROPE_LEAGUES) {
    const order =
      s.lastFinal[league] ??
      clubsIn(s, league)
        .sort((a, b) => teamOverall(b.squad) - teamOverall(a.squad))
        .map((c) => c.id)
    ids.push(...order.slice(0, LEAGUE_SLOTS[league]))
  }
  const others = Object.values(s.clubs)
    .filter((c) => c.league === OTHER_EU)
    .sort((a, b) => teamOverall(b.squad) - teamOverall(a.squad))
    .slice(0, OTHER_SLOTS)
    .map((c) => c.id)
  return [...ids, ...others]
}

/** 36팀이 서로 다른 8팀과 한 번씩(홈 4, 원정 4) 만나는 리그 페이즈 일정 */
export function drawLeaguePhase(rng: Rng, ids: string[]): Fixture[][] {
  const rounds = circleRounds(rng.shuffle(ids))
  const pick = rng.shuffle(rounds.map((_, i) => i)).slice(0, 8)
  const edges: { a: string; b: string; md: number }[] = []
  pick.forEach((ri, md) => rounds[ri].forEach(([a, b]) => edges.push({ a, b, md })))

  // 모든 팀의 경기 수가 짝수(8)이므로 오일러 경로 방식으로 방향을 정하면 홈·원정이 정확히 4:4가 된다
  const adj = new Map<string, number[]>()
  edges.forEach((e, i) => {
    ;(adj.get(e.a) ?? adj.set(e.a, []).get(e.a)!).push(i)
    ;(adj.get(e.b) ?? adj.set(e.b, []).get(e.b)!).push(i)
  })
  const used = new Array<boolean>(edges.length).fill(false)
  const home = new Array<string>(edges.length)
  for (const start of adj.keys()) {
    for (;;) {
      let cur = start
      let moved = false
      for (;;) {
        const idx = (adj.get(cur) ?? []).find((i) => !used[i])
        if (idx === undefined) break
        used[idx] = true
        home[idx] = cur
        cur = edges[idx].a === cur ? edges[idx].b : edges[idx].a
        moved = true
      }
      if (!moved) break
    }
  }
  const out: Fixture[][] = Array.from({ length: 8 }, () => [])
  edges.forEach((e, i) => out[e.md].push({ home: home[i], away: home[i] === e.a ? e.b : e.a }))
  return out
}

export function setupCl(s: GameState, rng: Rng): void {
  const entrants = clEntrants(s)
  s.cl = {
    season: s.season,
    entrants,
    phase: 'league',
    fixtures: drawLeaguePhase(rng, entrants),
    matchday: 0,
    step: 0,
    matches: [],
    order: [],
    po: [],
    r16: [],
    qf: [],
    sf: [],
    final: [],
  }
}

export const clTable = (cl: ClState) => computeStandings(cl.matches, cl.entrants)

export function userInCl(s: GameState): boolean {
  return !!s.cl && !!s.userClubId && s.cl.entrants.includes(s.userClubId)
}

const teamSide = (s: GameState, id: string): TeamSide => {
  const c = s.clubs[id]
  return {
    clubId: id,
    lineup: pickLineup(c.squad, c.formation),
    tactics: { philosophy: c.philosophy, formation: c.formation, pressing: 'mid', line: 'mid' },
    mult: 1,
  }
}

function playQuick(s: GameState, rng: Rng, fixtures: Fixture[]): MiniResult[] {
  const cache = new Map<string, TeamSide>()
  const side = (id: string) => cache.get(id) ?? cache.set(id, teamSide(s, id)).get(id)!
  return fixtures.map((f) => ({ home: f.home, away: f.away, ...quickResult(rng, side(f.home), side(f.away)) }))
}

/** 승부차기 승자: 전력이 높은 쪽이 조금 유리하다 */
function penaltyWinner(s: GameState, rng: Rng, a: string, b: string): string {
  const diff = teamOverall(s.clubs[a].squad) - teamOverall(s.clubs[b].squad)
  return rng.chance(0.5 + Math.max(-0.12, Math.min(0.12, diff * 0.006))) ? a : b
}

function decideTie(s: GameState, rng: Rng, t: ClTie): void {
  const goals = (id: string) => t.legs.reduce((sum, l) => sum + (l.home === id ? l.hg : l.ag), 0)
  const ga = goals(t.a)
  const gb = goals(t.b)
  if (ga !== gb) t.winner = ga > gb ? t.a : t.b
  else {
    t.winner = penaltyWinner(s, rng, t.a, t.b)
    t.pens = true
  }
}

const newTie = (a: string, b: string): ClTie => ({ a, b, legs: [] })

function playLegs(
  s: GameState,
  rng: Rng,
  ties: ClTie[],
  leg: 1 | 2 | 0,
  stage: string,
): MatchResult[] {
  // leg 1: 하위 시드 홈, leg 2: 상위 시드 홈, 단판(결승): 상위 시드를 홈으로 표기
  const fixtures: Fixture[] = ties.map((t) => (leg === 1 ? { home: t.b, away: t.a } : { home: t.a, away: t.b }))
  const involvesUser = fixtures.some((f) => f.home === s.userClubId || f.away === s.userClubId)
  const full = involvesUser ? simulateFixtures(s, rng, fixtures, { comp: 'ucl', round: s.cl!.step + 1, stage }) : []
  const minis: MiniResult[] = involvesUser
    ? full.map((r) => ({ home: r.home, away: r.away, hg: r.hg, ag: r.ag }))
    : playQuick(s, rng, fixtures)
  ties.forEach((t, i) => t.legs.push(minis[i]))
  return full
}

/** 두 경기 합산(또는 결승 단판)이 끝난 타이에 승자를 정하고, 사용자 경기에는 승부차기 표시를 남긴다 */
function finishTies(s: GameState, rng: Rng, ties: ClTie[], mine: MatchResult[]): void {
  for (const t of ties) {
    decideTie(s, rng, t)
    if (t.pens) {
      const last = mine.find((r) => r.home === t.legs[t.legs.length - 1].home && r.away === t.legs[t.legs.length - 1].away)
      if (last) last.pens = t.winner === last.home ? 'h' : 'a'
    }
  }
}

/** 챔피언스리그 다음 경기 단계를 진행한다. 내가 뛴 경기만 돌려준다. */
export function clRunNext(s: GameState, rng: Rng): MatchResult[] {
  const cl = s.cl
  if (!cl || cl.step >= CL_SEQUENCE.length) return []
  const token = CL_SEQUENCE[cl.step]
  const uid = s.userClubId
  let mine: MatchResult[] = []

  if (token === 'md') {
    const md = cl.matchday
    const fixtures = cl.fixtures[md]
    const involvesUser = fixtures.some((f) => f.home === s.userClubId || f.away === s.userClubId)
    if (involvesUser) {
      mine = simulateFixtures(s, rng, fixtures, { comp: 'ucl', round: cl.step + 1, stage: `리그 페이즈 ${md + 1}차전` })
      cl.matches.push(...mine.map((r) => ({ home: r.home, away: r.away, hg: r.hg, ag: r.ag })))
    } else {
      cl.matches.push(...playQuick(s, rng, fixtures))
    }
    cl.matchday++
    if (cl.matchday === 8) {
      cl.order = clTable(cl).map((t) => t.clubId)
      cl.po = Array.from({ length: 8 }, (_, i) => newTie(cl.order[8 + i], cl.order[23 - i]))
      cl.phase = 'po'
    }
  } else if (token === 'po1' || token === 'po2') {
    mine = playLegs(s, rng, cl.po, token === 'po1' ? 1 : 2, `플레이오프 ${token === 'po1' ? 1 : 2}차전`)
    if (token === 'po2') {
      finishTies(s, rng, cl.po, mine)
      // 상위 8팀(시드 1~8)이 플레이오프 승자 중 가장 약한 시드와 만난다
      cl.r16 = cl.order.slice(0, 8).map((top, k) => newTie(top, cl.po[7 - k].winner as string))
      cl.phase = 'r16'
    }
  } else if (token === 'r16_1' || token === 'r16_2') {
    mine = playLegs(s, rng, cl.r16, token === 'r16_1' ? 1 : 2, `16강 ${token === 'r16_1' ? 1 : 2}차전`)
    if (token === 'r16_2') {
      finishTies(s, rng, cl.r16, mine)
      const w = cl.r16.map((t) => t.winner as string)
      cl.qf = [newTie(w[0], w[7]), newTie(w[3], w[4]), newTie(w[1], w[6]), newTie(w[2], w[5])]
      cl.phase = 'qf'
    }
  } else if (token === 'qf1' || token === 'qf2') {
    mine = playLegs(s, rng, cl.qf, token === 'qf1' ? 1 : 2, `8강 ${token === 'qf1' ? 1 : 2}차전`)
    if (token === 'qf2') {
      finishTies(s, rng, cl.qf, mine)
      const w = cl.qf.map((t) => t.winner as string)
      cl.sf = [newTie(w[0], w[1]), newTie(w[2], w[3])]
      cl.phase = 'sf'
    }
  } else if (token === 'sf1' || token === 'sf2') {
    mine = playLegs(s, rng, cl.sf, token === 'sf1' ? 1 : 2, `4강 ${token === 'sf1' ? 1 : 2}차전`)
    if (token === 'sf2') {
      finishTies(s, rng, cl.sf, mine)
      cl.final = [newTie(cl.sf[0].winner as string, cl.sf[1].winner as string)]
      cl.phase = 'final'
    }
  } else {
    mine = playLegs(s, rng, cl.final, 0, '결승')
    finishTies(s, rng, cl.final, mine)
    const f = cl.final[0]
    cl.winner = f.winner
    cl.phase = 'done'
    s.clHistory.push({ season: cl.season, winner: f.winner as string, runnerUp: (f.winner === f.a ? f.b : f.a) })
  }
  cl.step++
  // 호출한 쪽에는 내 구단이 뛴 경기만 돌려준다 (같은 날 열린 다른 경기는 제외)
  return mine.filter((r) => r.home === uid || r.away === uid)
}

/** 사용자가 뛰지 않는(또는 이미 탈락한) 남은 일정을 한꺼번에 돌린다 */
export function clFinishAll(s: GameState, rng: Rng): void {
  while (s.cl && s.cl.step < CL_SEQUENCE.length) clRunNext(s, rng)
}

/** 내 구단의 챔피언스리그 최종 성적 (출전하지 않았으면 undefined) */
export function clUserResult(s: GameState): string | undefined {
  const cl = s.cl
  const uid = s.userClubId
  if (!cl || !uid || !cl.entrants.includes(uid)) return undefined
  if (cl.winner === uid) return '우승'
  const inTies = (ties: ClTie[]) => ties.some((t) => t.a === uid || t.b === uid)
  if (inTies(cl.final)) return '준우승'
  if (inTies(cl.sf)) return '4강'
  if (inTies(cl.qf)) return '8강'
  if (inTies(cl.r16)) return '16강'
  if (inTies(cl.po)) return '플레이오프 탈락'
  return '리그 페이즈 탈락'
}

export const clName = (id: string) => clubById(id).short
