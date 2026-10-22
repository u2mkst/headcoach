import type { Rng } from './rng'
import { lineRatings, type LineRatings } from './squad'
import { PHILOSOPHY_BEATS } from './squad'
import type { MatchResult, Philosophy, Player, Scorer, Tactics } from './types'

export interface TeamSide {
  clubId: string
  lineup: Player[]
  tactics: Tactics
  /** 숙련도 보너스·전술 노출 감점을 합친 배율 (1.0 = 영향 없음) */
  mult: number
}

const PHIL_MOD: Record<Philosophy, LineRatings> = {
  attack: { att: 1.05, mid: 1, def: 0.96 },
  possession: { att: 1, mid: 1.06, def: 0.99 },
  defense: { att: 0.95, mid: 1, def: 1.06 },
  counter: { att: 1.03, mid: 0.98, def: 1.01 },
}

/** 전술 효과를 반영한 라인별 최종 전력 */
export function effectiveRatings(me: TeamSide, opp: TeamSide): LineRatings {
  const base = lineRatings(me.lineup, me.tactics.formation)
  const pm = PHIL_MOD[me.tactics.philosophy]
  let att = base.att * pm.att
  let mid = base.mid * pm.mid
  let def = base.def * pm.def

  if (me.tactics.pressing === 'high') {
    mid *= 1.03
    def *= 0.99
  } else if (me.tactics.pressing === 'low') {
    mid *= 0.98
    def *= 1.02
  }
  if (me.tactics.line === 'high') {
    att *= 1.01
    def *= 0.98
    if (opp.tactics.philosophy === 'counter') def *= 0.96
  } else if (me.tactics.line === 'low') {
    att *= 0.99
    def *= 1.02
  }

  // 철학 상성: 앞이 뒤에 강하다
  let m = me.mult
  if (PHILOSOPHY_BEATS[me.tactics.philosophy] === opp.tactics.philosophy) m *= 1.04
  else if (PHILOSOPHY_BEATS[opp.tactics.philosophy] === me.tactics.philosophy) m *= 0.96

  return { att: att * m, mid: mid * m, def: def * m }
}

const BASE_GOALS = 1.2
const HOME_BOOST = 1.1
const AWAY_PENALTY = 0.92
const EXPONENT = 3.2

export function expectedGoals(att: LineRatings, def: LineRatings, home: boolean): number {
  const attPow = att.att * 0.65 + att.mid * 0.35
  const defPow = def.def * 0.65 + def.mid * 0.35
  const ratio = attPow / Math.max(1, defPow)
  return BASE_GOALS * Math.pow(ratio, EXPONENT) * (home ? HOME_BOOST : AWAY_PENALTY)
}

function pickScorer(rng: Rng, lineup: Player[]): Player {
  const posW = { FW: 6, MF: 3, DF: 1, GK: 0.02 }
  return rng.weighted(lineup, (p) => posW[p.pos] * Math.max(1, p.ovr - 35))
}

export interface MatchSim {
  result: Omit<MatchResult, 'season' | 'round'>
  xgHome: number
  xgAway: number
}

export function simulateMatch(rng: Rng, home: TeamSide, away: TeamSide): MatchSim {
  const rh = effectiveRatings(home, away)
  const ra = effectiveRatings(away, home)
  const xgHome = expectedGoals(rh, ra, true)
  const xgAway = expectedGoals(ra, rh, false)
  const hg = rng.poisson(xgHome)
  const ag = rng.poisson(xgAway)

  const scorers: Scorer[] = []
  const addGoals = (side: TeamSide, n: number) => {
    for (let i = 0; i < n; i++) {
      const p = pickScorer(rng, side.lineup)
      scorers.push({ playerId: p.id, name: p.name, clubId: side.clubId, minute: rng.int(1, 90) })
    }
  }
  addGoals(home, hg)
  addGoals(away, ag)
  scorers.sort((a, b) => a.minute - b.minute)

  let poss = 50 + ((rh.mid - ra.mid) / (rh.mid + ra.mid)) * 150
  if (home.tactics.philosophy === 'possession') poss += 3
  if (away.tactics.philosophy === 'possession') poss -= 3
  poss = Math.round(Math.min(68, Math.max(32, poss)))

  const shotsHome = Math.max(hg, Math.round(xgHome * 6 + rng.int(2, 6)))
  const shotsAway = Math.max(ag, Math.round(xgAway * 6 + rng.int(2, 6)))

  // 경기 최우수 선수: 승리 팀 득점왕, 없으면 득점자, 없으면 승리 팀 최고 능력치
  let motm: MatchSim['result']['motm']
  const winnerSide = hg > ag ? home : ag > hg ? away : null
  const tally = new Map<string, { name: string; clubId: string; goals: number }>()
  for (const s of scorers) {
    const t = tally.get(s.playerId) ?? { name: s.name, clubId: s.clubId, goals: 0 }
    t.goals++
    tally.set(s.playerId, t)
  }
  const candidates = [...tally.values()].filter((t) => !winnerSide || t.clubId === winnerSide.clubId)
  if (candidates.length) {
    const best = candidates.sort((a, b) => b.goals - a.goals)[0]
    motm = { name: best.name, clubId: best.clubId }
  } else if (winnerSide) {
    const best = [...winnerSide.lineup].sort((a, b) => b.ovr - a.ovr)[0]
    motm = { name: best.name, clubId: winnerSide.clubId }
  }

  return {
    result: { home: home.clubId, away: away.clubId, hg, ag, scorers, possession: poss, shotsHome, shotsAway, motm },
    xgHome,
    xgAway,
  }
}
