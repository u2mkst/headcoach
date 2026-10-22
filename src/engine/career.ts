import type { Rng } from './rng'
import { CLUBS, KOREAN_LEAGUES, clubById, isEuropeLeague } from '../data/clubs'
import { setupCl, clUserResult } from './champions'
import { YOUTH_PROMISE_APPS } from './events'
import { addTrust, newId, pushFeed, pushTimeline, userClub } from './helpers'
import { budgetFor, calOf, economyScale, targetLabel, targetRankFor } from './leagues'
import {
  clamp,
  FORMATION_IDS,
  generateSquad,
  assignNumber,
  makePlayer,
  playerLabel,
  teamOverall,
} from './squad'
import { leagueClubIds, leagueTable, scheduleFor, userLeagueId } from './season'
import { finishWorldSeason } from './world'
import type {
  GameState,
  Offer,
  Outcome,
  Philosophy,
  Player,
  Position,
  SeasonSummary,
} from './types'

export { budgetFor, targetLabel, targetRankFor }

export const OUTCOME_LABEL: Record<Outcome, string> = {
  champion: '우승',
  exceeded: '기대 초과',
  achieved: '목표 달성',
  fell_short: '미흡',
  failed: '실패',
}

export const PHILOSOPHIES: Philosophy[] = ['attack', 'possession', 'defense', 'counter']

/** 같은 리그 안에서의 현재 선수단 능력치 순위 (앞이 강함) */
export function strengthRanking(s: GameState, leagueId?: string): string[] {
  const league = leagueId ?? userLeagueId(s)
  return Object.values(s.clubs)
    .filter((c) => c.league === league)
    .sort((a, b) => teamOverall(b.squad) - teamOverall(a.squad))
    .map((c) => c.id)
}

/** 구단의 소속 리그에서의 목표 순위 */
export function targetFor(s: GameState, clubId: string): number {
  const league = s.clubs[clubId].league
  const ranking = strengthRanking(s, league)
  return targetRankFor(ranking.indexOf(clubId) + 1, ranking.length)
}

const offerFor = (s: GameState, clubId: string): Offer => {
  const c = clubById(clubId)
  const rank = strengthRanking(s, s.clubs[clubId].league).indexOf(clubId) + 1
  return { clubId, targetRank: targetFor(s, clubId), patience: rank <= 3 ? 2 : rank <= 6 ? 3 : 4, budget: budgetFor(c.strength) }
}

/** 처음 시작할 때 고를 수 있는 구단: K리그1·K리그2 전부 */
export function startOffers(s: GameState): Offer[] {
  return CLUBS.filter((c) => KOREAN_LEAGUES.includes(c.league))
    .sort((a, b) => b.strength - a.strength)
    .map((c) => offerFor(s, c.id))
}

/** 감독 명성으로 맡을 수 있는 구단의 전력 상한. 유럽 구단은 명성 45부터. */
export const repCap = (rep: number) => 52 + rep * 0.36
export function canManage(rep: number, clubId: string): boolean {
  const c = clubById(clubId)
  if (c.strength >= 85 && rep < 93) return false
  return c.strength <= repCap(rep) && (!isEuropeLeague(c.league) || rep >= 45)
}

/**
 * 시즌이 끝난 뒤 받는 제안.
 * - 경질: 지금보다 같거나 낮은 구단 3곳
 * - 재계약: 성적이 좋으면 지금보다 높은 구단 최대 3곳 (명성이 되는 곳만)
 */
export function careerOffers(s: GameState, rng: Rng, mode: 'renew' | 'fired', good: boolean): Offer[] {
  const uid = s.userClubId as string
  const cur = clubById(uid).strength
  const rep = s.manager?.reputation ?? 30
  const pool = CLUBS.filter((c) => c.id !== uid && c.league !== 'euother')
  let cands: typeof pool
  if (mode === 'fired') {
    cands = pool.filter((c) => c.strength <= cur + 1 && c.strength >= cur - 14 && canManage(rep, c.id))
  } else if (good) {
    cands = pool.filter((c) => c.strength > cur + 0.5 && c.strength <= cur + 9 && canManage(rep, c.id))
  } else cands = []
  const picked = rng.shuffle(cands).slice(0, 3).sort((a, b) => b.strength - a.strength)
  return picked.map((c) => offerFor(s, c.id))
}

/** 시즌 마지막 달이 끝난 직후 호출: 세상을 정리하고 시즌 결산과 커리어 결정을 만든다 */
export function evaluateSeason(s: GameState, rng: Rng): void {
  const uid = s.userClubId as string
  const club = userClub(s)
  const league = userLeagueId(s)
  const cal = calOf(league)

  // 다른 리그·챔피언스리그·승강을 먼저 확정한다
  finishWorldSeason(s, rng)

  const table = leagueTable(s)
  const rank = table.findIndex((x) => x.clubId === uid) + 1
  const row = table[rank - 1]
  const size = table.length
  const delta = rank - s.targetRank
  const moved: SeasonSummary['moved'] = s.promo?.up.includes(uid) ? 'promoted' : s.promo?.down.includes(uid) ? 'relegated' : undefined

  let outcome: Outcome
  if (moved === 'relegated') outcome = 'failed'
  else if (moved === 'promoted') outcome = rank === 1 ? 'champion' : 'exceeded'
  else outcome = rank === 1 ? 'champion' : delta <= -2 ? 'exceeded' : delta <= 0 ? 'achieved' : delta <= 2 ? 'fell_short' : 'failed'

  // 장기 약속 점검
  const promiseNotes: string[] = []
  const achievements: string[] = []
  const youthApps = club.squad.filter((p) => p.age <= 21).reduce((a, p) => a + p.seasonApps, 0)
  let trustDelta = { champion: 16, exceeded: 10, achieved: 4, fell_short: -8, failed: -20 }[outcome]
  if (moved === 'relegated') trustDelta -= 8
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

  // 챔피언스리그 성적
  const cl = clUserResult(s)
  const CL_REP: Record<string, number> = { '우승': 14, '준우승': 9, '4강': 6, '8강': 4, '16강': 2, '플레이오프 탈락': 0, '리그 페이즈 탈락': -1 }
  if (cl === '우승') {
    s.clTitles += 1
    achievements.unshift('UEFA 챔피언스리그 우승')
    trustDelta += 14
  } else if (cl && CL_REP[cl] >= 3) achievements.push(`챔피언스리그 ${cl}`)

  // 성과 인정: 순위가 부족해도 다른 성과가 있으면 한 단계 올려준다 (강등은 제외)
  let upgraded = false
  if (moved !== 'relegated') {
    if (outcome === 'fell_short' && achievements.length) {
      outcome = 'achieved'
      upgraded = true
      trustDelta += 4
    } else if (outcome === 'failed' && achievements.length >= 2) {
      outcome = 'fell_short'
      upgraded = true
      trustDelta += 4
    }
  }

  const summary: SeasonSummary = {
    season: s.season,
    clubId: uid,
    league,
    moved,
    cl,
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
  // 하위 리그의 성적은 명성에 덜 반영되고, 유럽에서의 성적은 더 크게 반영된다
  const tier = league === 'k2' ? 0.6 : league === 'k1' ? 1 : 1.3
  const repDelta = Math.round(({ champion: 8, exceeded: 5, achieved: 2, fell_short: -2, failed: -6 }[outcome] * tier + (cl ? CL_REP[cl] : 0)) * 10) / 10
  if (s.manager) s.manager.reputation = clamp(s.manager.reputation + repDelta, 0, 100)

  // 커리어 결정
  const fired = s.ownerTrust <= 20 || (outcome === 'failed' && s.ownerTrust < 50) || (moved === 'relegated' && s.ownerTrust < 60)
  if (fired) {
    s.pendingCareer = { decision: { kind: 'fired' }, offers: careerOffers(s, rng, 'fired', false), trustDelta }
  } else {
    const good = outcome === 'champion' || outcome === 'exceeded' || (outcome === 'achieved' && rank <= Math.max(4, Math.round(size / 3))) || cl === '우승'
    s.pendingCareer = { decision: { kind: 'renew' }, offers: careerOffers(s, rng, 'renew', good), trustDelta }
  }

  s.phase = 'seasonEnd'
  const moveText = moved === 'promoted' ? ' · 승격' : moved === 'relegated' ? ' · 강등' : ''
  pushTimeline(
    s,
    'season',
    `${s.season}시즌 ${rank}위 (${row.w}승 ${row.d}무 ${row.l}패)${moveText} — ${OUTCOME_LABEL[outcome]}${cl ? ` · 챔피언스리그 ${cl}` : ''}`,
  )
  pushFeed(s, {
    kind: 'article',
    source: '스포츠 타임스',
    mood: outcome === 'failed' || outcome === 'fell_short' ? 'bad' : 'good',
    text: cl === '우승'
      ? `${clubById(uid).short}, 유럽 정상! 챔피언스리그 우승 — ${s.manager?.name} 감독 "꿈이 현실이 됐다"`
      : `${clubById(uid).short}, ${s.season}시즌 ${rank}위로 마감${moveText}… 평가는 "${OUTCOME_LABEL[outcome]}"`,
  })
  void cal
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

  // 승강 적용
  if (s.promo) {
    for (const id of s.promo.up) s.clubs[id].league = 'k1'
    for (const id of s.promo.down) s.clubs[id].league = 'k2'
    if (s.promo.up.includes(uid)) lines.push('K리그1으로 승격했어요!')
    if (s.promo.down.includes(uid)) lines.push('K리그2로 강등됐어요.')
    s.promo = null
  }

  // 순위에 따른 시즌 수입 (구단 규모에 맞춰 커진다)
  const last = s.seasons[s.seasons.length - 1]
  if (last) {
    const size = calOf(last.league).teams
    const scale = economyScale(clubById(uid).strength)
    const prize = Math.round(scale * (40 + (size + 1 - last.rank) * 3))
    userClub(s).budget += prize
    lines.push(`시즌 수입 +${prize}억 (순위 ${last.rank}위)`)
  }

  // 다음 시즌 준비
  s.season += 1
  s.round = 0
  s.month = 0
  s.split = null
  s.results = []
  s.monthReport = null
  s.monthPlan = null
  s.fitnessBoost = 0
  s.fan = { support: Math.round(50 + (s.fan.support - 50) * 0.6), results: 50, style: Math.round(50 + (s.fan.style - 50) * 0.6) }
  const myLeague = userLeagueId(s)
  s.fixtures = scheduleFor(rng, myLeague, leagueClubIds(s, myLeague))
  setupCl(s, rng)
  s.events = []
  s.wasInDanger = false
  s.promises = s.promises.filter((p) => p.season >= s.season)
  s.tacticMemory = { streak: 0, lastKey: null, familiarity: Math.round(s.tacticMemory.familiarity * 0.6), lastPhilosophy: s.tacticMemory.lastPhilosophy }
  s.seasonStartBudget = Math.round(userClub(s).budget)
  s.targetRank = targetFor(s, uid)
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
      league: c.league,
    }
  }
}
