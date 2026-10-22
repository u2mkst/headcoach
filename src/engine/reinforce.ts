import type { Rng } from './rng'
import { clubById } from '../data/clubs'
import { addTrust, newId, userClub } from './helpers'
import { economyScale } from './leagues'
import { assignNumber, clamp, makePlayer, playerLabel } from './squad'
import type { GameState, MonthPlan, Position, SpendFocus, SpendLevel } from './types'

export const FOCUS_ORDER: SpendFocus[] = ['attack', 'midfield', 'defense', 'keeper', 'youth', 'fitness', 'save']

export const FOCUS_LABEL: Record<SpendFocus, string> = {
  attack: '공격 보강',
  midfield: '중원 보강',
  defense: '수비 보강',
  keeper: '골키퍼 보강',
  youth: '유소년 투자',
  fitness: '컨디션 관리',
  save: '예산 아끼기',
}

export const FOCUS_DESC: Record<SpendFocus, string> = {
  attack: '해당 라인의 약한 자리를 더 나은 선수로 바꿔요',
  midfield: '해당 라인의 약한 자리를 더 나은 선수로 바꿔요',
  defense: '해당 라인의 약한 자리를 더 나은 선수로 바꿔요',
  keeper: '주전 골키퍼 경쟁에 새 선수를 들여요',
  youth: '당장은 티가 안 나지만 시즌 끝 성장이 커져요',
  fitness: '이번 달 컨디션 회복이 빠르고 부상이 줄어요',
  save: '돈을 쓰지 않고 모아요. 구단주는 좋아하지만 팬은 아쉬워해요',
}

export const LEVEL_ORDER: SpendLevel[] = ['small', 'medium', 'large']
export const LEVEL_LABEL: Record<SpendLevel, string> = { small: '조금', medium: '보통', large: '많이' }

const SPEND: Record<SpendLevel, number> = { small: 6, medium: 15, large: 30 }
const SAVED: Record<SpendLevel, number> = { small: 2, medium: 4, large: 8 }
const MULT: Record<SpendLevel, number> = { small: 1, medium: 2, large: 3 }
const LINE_BONUS: Record<SpendLevel, number> = { small: 0, medium: 2, large: 4 }

export const LINE_POS: Partial<Record<SpendFocus, Position>> = {
  attack: 'FW',
  midfield: 'MF',
  defense: 'DF',
  keeper: 'GK',
}
/** 라인 능력치를 잴 때 보는 주전 수 (기본 포메이션 기준) */
export const LINE_SLOTS: Record<Position, number> = { GK: 1, DF: 4, MF: 4, FW: 2 }

/** 내 구단 규모에 맞는 금액 배율 */
export const planScale = (s: GameState): number => economyScale(clubById(s.userClubId as string).strength)

/** 예산 변화량: 쓰면 음수, 아끼면 양수 (구단 규모 배율 적용) */
export const planDelta = (p: MonthPlan, scale = 1): number =>
  Math.round((p.focus === 'save' ? SAVED[p.level] : -SPEND[p.level]) * scale)
export const planCost = (p: MonthPlan, scale = 1): number => Math.max(0, -planDelta(p, scale))
export const planMult = (level: SpendLevel): number => MULT[level]

export const SQUAD_CAP = 26

/** 달이 시작될 때 보강 계획을 실행하고 결과 한 줄을 돌려준다 */
export function applyPlan(s: GameState, rng: Rng, plan: MonthPlan): { line: string; applied: boolean } {
  const club = userClub(s)
  const scale = planScale(s)
  const cost = planCost(plan, scale)
  if (cost > club.budget) return { line: '예산이 부족해 이번 달 보강은 건너뛰었어요', applied: false }
  const round1 = (n: number) => Math.round(n * 10) / 10

  if (plan.focus === 'save') {
    const saved = planDelta(plan, scale)
    club.budget = round1(club.budget + saved)
    addTrust(s, 0.5 * MULT[plan.level])
    return { line: `${saved}억을 아꼈어요`, applied: true }
  }

  club.budget = round1(club.budget - cost)

  if (plan.focus === 'youth') {
    s.youthInvest += MULT[plan.level] === 3 ? 4 : MULT[plan.level]
    return { line: `유소년 아카데미에 ${cost}억을 투자했어요`, applied: true }
  }
  if (plan.focus === 'fitness') {
    s.fitnessBoost = MULT[plan.level]
    return { line: `의무·체력 파트에 ${cost}억을 썼어요`, applied: true }
  }

  const pos = LINE_POS[plan.focus] as Position
  const starters = club.squad
    .filter((p) => p.pos === pos)
    .sort((a, b) => b.ovr - a.ovr)
    .slice(0, LINE_SLOTS[pos])
  const avg = starters.reduce((a, p) => a + p.ovr, 0) / Math.max(1, starters.length)
  // 구단의 격(전력)을 넘어서는 선수는 영입하기 어렵다
  const ceiling = clubById(club.id).strength + 1
  const ovr = clamp(Math.round(Math.min(avg + LINE_BONUS[plan.level], ceiling) + rng.normal(0, 1.5)), 40, 92)
  const p = makePlayer(rng, 0, pos, ovr, { age: rng.int(21, 28) })
  p.id = newId(s, 'p')
  p.ovr = ovr
  p.pot = clamp(ovr + rng.int(0, 4), ovr, 95)
  p.contractYears = 3
  p.morale = 75
  p.academy = false
  assignNumber(club.squad, p)
  club.squad.push(p)

  // 선수단이 커지면 같은 포지션에서 가장 약한 선수를 내보낸다
  while (club.squad.length > SQUAD_CAP) {
    const sameLine = club.squad.filter((x) => x.pos === pos && x.id !== p.id)
    const worst = sameLine.sort((a, b) => a.ovr - b.ovr)[0]
    if (!worst) break
    club.squad = club.squad.filter((x) => x.id !== worst.id)
  }
  return { line: `${playerLabel(p)} 영입 (능력치 ${p.ovr}) — ${cost}억`, applied: true }
}
