import type { Rng } from './rng'
import { CLUBS, clubById } from '../data/clubs'
import { YOUTH_PROMISE_APPS } from './events'
import { addTrust, newId, pushFeed, pushTimeline, userClub } from './helpers'
import {
  clamp,
  FORMATION_IDS,
  generateSquad,
  assignNumber,
  makePlayer,
  playerLabel,
  teamOverall,
} from './squad'
import { computeStandings, generateSchedule, ROUNDS } from './season'
import type {
  GameState,
  Offer,
  Outcome,
  Philosophy,
  Player,
  Position,
  SeasonSummary,
} from './types'

export const OUTCOME_LABEL: Record<Outcome, string> = {
  champion: '우승',
  exceeded: '기대 초과',
  achieved: '목표 달성',
  fell_short: '미흡',
  failed: '실패',
}

export const PHILOSOPHIES: Philosophy[] = ['attack', 'possession', 'defense', 'counter']

/** 현재 선수단 능력치 기준 전력 순위 (1 = 가장 강함) */
export function strengthRanking(s: GameState): string[] {
  return Object.values(s.clubs)
    .sort((a, b) => teamOverall(b.squad) - teamOverall(a.squad))
    .map((c) => c.id)
}

/** 구단 전력 순위에서 구단주 목표 순위를 정한다 */
export function targetRankFor(rank: number): number {
  return clamp(rank - 1, 1, 8)
}

export function targetLabel(target: number): string {
  if (target === 1) return '우승 도전'
  if (target <= 3) return '상위권 (3위 이내)'
  if (target <= 6) return '중상위권'
  return '중위권 이상'
}

export function budgetFor(strength: number): number {
  return Math.round(40 + (strength - 60) * 8)
}

/** 감독 명성으로 갈 수 있는 구단을 3곳(또는 count곳) 제안한다 */
export function makeOffers(s: GameState, rng: Rng, count: number, excludeClubId?: string): Offer[] {
  const rep = s.manager?.reputation ?? 20
  const ranking = strengthRanking(s)
  const minRank = clamp(Math.round(8 - rep / 16), 2, 8)
  let pool = ranking
    .map((id, i) => ({ id, rank: i + 1 }))
    .filter((x) => x.rank >= minRank && x.id !== excludeClubId)
  if (pool.length < count) pool = ranking.map((id, i) => ({ id, rank: i + 1 })).filter((x) => x.id !== excludeClubId)
  const picked = rng.shuffle(pool).slice(0, count).sort((a, b) => a.rank - b.rank)
  return picked.map(({ id, rank }) => ({
    clubId: id,
    targetRank: targetRankFor(rank),
    patience: rank <= 3 ? 2 : rank <= 6 ? 3 : 4,
    budget: budgetFor(clubById(id).strength),
  }))
}

export function rankOf(s: GameState, clubId: string): number {
  const table = computeStandings(s.results, Object.keys(s.clubs))
  return table.findIndex((x) => x.clubId === clubId) + 1
}

/** 라운드 18 종료 직후 호출: 시즌 결산과 커리어 결정을 만든다 */
export function evaluateSeason(s: GameState, rng: Rng): void {
  const uid = s.userClubId as string
  const club = userClub(s)
  const table = computeStandings(s.results, Object.keys(s.clubs))
  const rank = table.findIndex((x) => x.clubId === uid) + 1
  const row = table[rank - 1]
  const delta = rank - s.targetRank

  let outcome: Outcome =
    rank === 1 ? 'champion' : delta <= -2 ? 'exceeded' : delta <= 0 ? 'achieved' : delta <= 2 ? 'fell_short' : 'failed'

  // 장기 약속 점검
  const promiseNotes: string[] = []
  const achievements: string[] = []
  const youthApps = club.squad.filter((p) => p.age <= 21).reduce((a, p) => a + p.seasonApps, 0)
  let trustDelta = { champion: 16, exceeded: 10, achieved: 4, fell_short: -8, failed: -20 }[outcome]
  for (const pr of s.promises.filter((x) => x.season === s.season)) {
    if (pr.type === 'youth') {
      if (youthApps >= pr.threshold) {
        promiseNotes.push(`유소년 기용 약속 지킴 — 21세 이하 ${youthApps}회 출전 (기준 ${pr.threshold}회)`)
        achievements.push('유소년 육성')
        trustDelta += 6
      } else {
        promiseNotes.push(`유소년 기용 약속 못 지킴 — 21세 이하 ${youthApps}회 출전 (기준 ${pr.threshold}회)`)
        trustDelta -= 6
      }
    } else {
      if (club.budget >= pr.threshold) {
        promiseNotes.push(`재정 안정 약속 지킴 — 예산 ${Math.round(club.budget)}억 (기준 ${pr.threshold}억)`)
        trustDelta += 6
      } else {
        promiseNotes.push(`재정 안정 약속 못 지킴 — 예산 ${Math.round(club.budget)}억 (기준 ${pr.threshold}억)`)
        trustDelta -= 6
      }
    }
  }
  if (!achievements.includes('유소년 육성') && youthApps >= YOUTH_PROMISE_APPS + 10) achievements.push('유소년 육성')
  if (s.wasInDanger && rank <= s.targetRank) achievements.push('위기 극복')
  if (club.budget >= s.seasonStartBudget * 1.3 && club.budget > 0) achievements.push('재정 안정')

  // 성과 인정: 순위가 부족해도 다른 성과가 있으면 한 단계 올려준다
  let upgraded = false
  if (outcome === 'fell_short' && achievements.length) {
    outcome = 'achieved'
    upgraded = true
    trustDelta += 4
  } else if (outcome === 'failed' && achievements.length >= 2) {
    outcome = 'fell_short'
    upgraded = true
    trustDelta += 4
  }

  const summary: SeasonSummary = {
    season: s.season,
    clubId: uid,
    rank,
    targetRank: s.targetRank,
    points: row.pts,
    w: row.w,
    d: row.d,
    l: row.l,
    gf: row.gf,
    ga: row.ga,
    outcome,
    achievements,
    upgraded,
    promiseNotes,
    budgetStart: s.seasonStartBudget,
    budgetEnd: Math.round(club.budget),
  }
  s.seasons.push(summary)

  addTrust(s, trustDelta)
  const repDelta = { champion: 12, exceeded: 8, achieved: 4, fell_short: -2, failed: -8 }[outcome]
  if (s.manager) s.manager.reputation = clamp(s.manager.reputation + repDelta, 0, 100)

  // 커리어 결정
  const fired = s.ownerTrust <= 20 || (outcome === 'failed' && s.ownerTrust < 50)
  if (fired) {
    s.pendingCareer = { decision: { kind: 'fired' }, offers: makeOffers(s, rng, 3, uid), trustDelta }
  } else {
    let offers: Offer[] = []
    if (outcome === 'champion' || outcome === 'exceeded' || (outcome === 'achieved' && rank <= 4)) {
      const ranking = strengthRanking(s)
      const myRank = ranking.indexOf(uid) + 1
      offers = ranking
        .map((id, i) => ({ id, rank: i + 1 }))
        .filter((x) => x.id !== uid && x.rank < myRank)
        .slice(0, 2)
        .map(({ id, rank: r }) => ({
          clubId: id,
          targetRank: targetRankFor(r),
          patience: r <= 3 ? 2 : 3,
          budget: budgetFor(clubById(id).strength),
        }))
    }
    s.pendingCareer = { decision: { kind: 'renew' }, offers, trustDelta }
  }

  s.phase = 'seasonEnd'
  pushTimeline(
    s,
    'season',
    `${s.season}시즌 ${rank}위 (${row.w}승 ${row.d}무 ${row.l}패) — ${OUTCOME_LABEL[outcome]}`,
  )
  pushFeed(s, {
    kind: 'article',
    source: '스포츠 타임스',
    mood: outcome === 'failed' || outcome === 'fell_short' ? 'bad' : 'good',
    text: `${clubById(uid).short}, ${s.season}시즌 ${rank}위로 마감… 평가는 "${OUTCOME_LABEL[outcome]}"`,
  })
}

/* ───────── 오프시즌 ───────── */

function growth(rng: Rng, p: Player, bonus: number, protect: number): number {
  let d: number
  if (p.age <= 21) d = rng.range(1, 4.2)
  else if (p.age <= 25) d = rng.range(-0.2, 2.6)
  else if (p.age <= 29) d = rng.range(-1.2, 1.2)
  else if (p.age <= 33) d = rng.range(-2.6, 0.4)
  else d = rng.range(-4, -1)
  if (p.age <= 23) d += bonus
  else if (d < 0) d += protect
  return d
}

export interface OffseasonReport {
  lines: string[]
}

export function runOffseason(s: GameState, rng: Rng): string[] {
  const lines: string[] = []
  const uid = s.userClubId as string
  const mgr = s.manager
  const coach = s.coach

  const youthBonus = (mgr ? mgr.abilities.youth * 0.07 : 0) + (coach?.specialty === 'youth' ? coach.rating * 0.025 : 0) + s.youthInvest * 0.15
  const protect = coach?.specialty === 'fitness' ? coach.rating * 0.04 : 0

  for (const club of Object.values(s.clubs)) {
    const mine = club.id === uid
    const keep: Player[] = []
    for (const p of club.squad) {
      p.age += 1
      const before = p.ovr
      let d = growth(rng, p, mine ? youthBonus : 0.3, mine ? protect : 0)
      if (mine && p.age <= 22 && p.seasonApps >= 15) d += 0.8
      if (p.pushedReturn) {
        d -= rng.int(1, 3)
        if (mine) lines.push(`${playerLabel(p)} — 무리한 복귀의 여파로 기량이 떨어졌어요.`)
        p.pushedReturn = false
      }
      p.ovr = clamp(Math.round(p.ovr + d), 38, Math.max(p.pot, p.ovr))
      if (p.ovr > before + 2 && mine) lines.push(`${playerLabel(p)} 성장 (${before} → ${p.ovr})`)
      else if (p.ovr < before - 1 && mine && !lines.some((l) => l.startsWith(playerLabel(p)))) lines.push(`${playerLabel(p)} 하락 (${before} → ${p.ovr})`)

      const retire = p.age >= 38 || (p.age >= 34 && rng.chance(0.25 + (p.age - 34) * 0.2))
      if (retire) {
        if (mine) lines.push(`${playerLabel(p)}(${p.age}세) 은퇴`)
        continue
      }
      p.contractYears -= 1
      if (p.contractYears <= 0) {
        const worth = p.ovr >= 60 || p.age <= 24
        if (mine) {
          if (worth && rng.chance(0.85)) {
            p.contractYears = rng.int(1, 3)
            lines.push(`${playerLabel(p)} 재계약`)
          } else {
            lines.push(`${playerLabel(p)} 계약 만료로 팀을 떠남`)
            continue
          }
        } else if (rng.chance(0.85)) p.contractYears = rng.int(1, 3)
        else continue
      }
      p.seasonApps = 0
      p.seasonGoals = 0
      p.injuredRounds = 0
      p.condition = 95
      p.morale = clamp(Math.round(p.morale * 0.5 + 35), 40, 90)
      p.benchStreak = 0
      keep.push(p)
    }
    club.squad = keep

    // 모자란 포지션은 유소년·신인으로 채운다
    const plan: [Position, number][] = [['GK', 3], ['DF', 7], ['MF', 7], ['FW', 6]]
    for (const [pos, n] of plan) {
      while (club.squad.filter((p) => p.pos === pos).length < n) {
        const kid = makePlayer(rng, 0, pos, clubById(club.id).strength, { youth: true })
        kid.id = newId(s, 'p')
        kid.contractYears = 3
        assignNumber(club.squad, kid)
        club.squad.push(kid)
        if (mine) lines.push(`${playerLabel(kid)}(${kid.age}세 신인) 영입`)
      }
    }

    if (!mine) {
      if (rng.chance(0.3)) club.philosophy = rng.pick(PHILOSOPHIES)
      club.formation = rng.pick(FORMATION_IDS)
    }
  }

  s.youthInvest = 0

  // 순위에 따른 시즌 수입
  const last = s.seasons[s.seasons.length - 1]
  if (last) {
    const prize = 40 + (11 - last.rank) * 3
    userClub(s).budget += prize
    lines.push(`시즌 수입 +${prize}억 (순위 ${last.rank}위)`)
  }

  // 다음 시즌 준비
  s.season += 1
  s.round = 0
  s.results = []
  s.monthReport = null
  s.monthPlan = null
  s.fitnessBoost = 0
  s.fan = { support: Math.round(50 + (s.fan.support - 50) * 0.6), results: 50, style: Math.round(50 + (s.fan.style - 50) * 0.6) }
  s.fixtures = generateSchedule(rng, Object.keys(s.clubs))
  s.events = []
  s.wasInDanger = false
  s.promises = s.promises.filter((p) => p.season >= s.season)
  s.tacticMemory = { streak: 0, lastKey: null, familiarity: Math.round(s.tacticMemory.familiarity * 0.6), lastPhilosophy: s.tacticMemory.lastPhilosophy }
  s.seasonStartBudget = Math.round(userClub(s).budget)
  const ranking = strengthRanking(s)
  s.targetRank = targetRankFor(ranking.indexOf(uid) + 1)
  s.phase = 'play'
  return lines.slice(0, 24)
}

export function newClubSims(s: GameState, rng: Rng): void {
  s.clubs = {}
  for (const c of CLUBS) {
    const squad = generateSquad(rng, () => {
      s.nextId += 1
      return s.nextId
    }, c.strength)
    s.clubs[c.id] = {
      id: c.id,
      squad,
      philosophy: rng.pick(PHILOSOPHIES),
      formation: rng.pick(FORMATION_IDS),
      budget: budgetFor(c.strength),
    }
  }
}

export const SEASON_ROUNDS = ROUNDS
