import { addTrust } from './helpers'
import { planMult } from './reinforce'
import { clamp } from './squad'
import type { FanState, GameState, MonthPlan } from './types'

export const INITIAL_FAN: FanState = { support: 55, results: 55, style: 50 }

export interface MonthStats {
  w: number
  d: number
  l: number
  gf: number
  ga: number
  rank: number
}

const round1 = (n: number) => Math.round(n * 10) / 10

/**
 * 한 달 결과·전술 스타일·보강 선택으로 팬 지지도를 갱신한다.
 * - 성적 만족: 승패, 득실, 목표 순위 대비
 * - 스타일 만족: 득점력, 전술 철학, 같은 전술 반복
 * - 감독 지지도: 위 둘에 보강 선택(투자 vs 저축)이 더해짐
 */
export function updateFan(s: GameState, m: MonthStats, plan: MonthPlan | null): void {
  const f = s.fan
  const games = Math.max(1, m.w + m.d + m.l)
  const gpm = m.gf / games

  const dResults = (m.w - m.l) * 3 + (m.gf - m.ga) * 0.5 + (m.rank <= s.targetRank ? 1.5 : -1.5)

  let dStyle = gpm >= 2 ? 2 : gpm <= 0.7 ? -2.5 : 0
  const phil = s.tactics.philosophy
  if (phil === 'attack') dStyle += 1.5
  else if (phil === 'possession') dStyle += m.w >= 2 ? 1 : 0
  else if (phil === 'counter') dStyle += m.w >= 2 ? 1 : -0.5
  else dStyle += m.w >= 2 ? 1 : -1.5
  if (s.tacticMemory.streak >= 5) dStyle -= 2
  if (s.tactics.pressing === 'high') dStyle += 0.5

  let dPlan = 0
  if (plan) {
    const k = planMult(plan.level)
    if (plan.focus === 'save') dPlan = -0.9 * k
    else if (plan.focus === 'youth') dPlan = 0.4 * k
    else if (plan.focus === 'fitness') dPlan = 0.2 * k
    else dPlan = 0.8 * k
  }

  f.results = clamp(round1(f.results + dResults * 0.8 + (50 - f.results) * 0.1), 0, 100)
  f.style = clamp(round1(f.style + dStyle * 0.8 + (50 - f.style) * 0.1), 0, 100)
  f.support = clamp(round1(f.support + dResults * 0.45 + dStyle * 0.3 + dPlan + (50 - f.support) * 0.05), 0, 100)

  // 지지도는 구단 재정과 구단주 신뢰에도 영향을 준다
  addTrust(s, (f.support - 50) * 0.03)
  const club = s.clubs[s.userClubId as string]
  club.budget = round1(club.budget + (f.support - 50) * 0.06)
}
