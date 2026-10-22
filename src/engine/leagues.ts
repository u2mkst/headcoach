import { clubById, EUROPE_LEAGUES } from '../data/clubs'

/**
 * 리그별 달력.
 * - K리그: 2월~11월, 12팀. K1은 33라운드 뒤 상·하위 6팀으로 갈라 5라운드를 더 치른다(총 38경기).
 *   K2는 3바퀴(33경기).
 * - 유럽: 8월~5월. 20팀 리그는 38경기, 18팀 리그는 34경기.
 */
export interface LeagueCal {
  teams: number
  rounds: number
  /** 스플릿 전까지의 라운드 수 (스플릿이 없으면 rounds와 같다) */
  baseRounds: number
  split: boolean
  months: string[]
  /** 달마다 치르는 리그 라운드 수 */
  monthRounds: number[]
}

const KOREA_MONTHS = ['2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월']
const EUROPE_MONTHS = ['8월', '9월', '10월', '11월', '12월', '1월', '2월', '3월', '4월', '5월']

export const CAL: Record<string, LeagueCal> = {
  k1: { teams: 12, rounds: 38, baseRounds: 33, split: true, months: KOREA_MONTHS, monthRounds: [3, 4, 4, 4, 4, 4, 4, 4, 4, 3] },
  k2: { teams: 12, rounds: 33, baseRounds: 33, split: false, months: KOREA_MONTHS, monthRounds: [3, 3, 3, 4, 4, 4, 3, 3, 3, 3] },
  epl: { teams: 20, rounds: 38, baseRounds: 38, split: false, months: EUROPE_MONTHS, monthRounds: [4, 4, 4, 4, 4, 4, 4, 4, 3, 3] },
  laliga: { teams: 20, rounds: 38, baseRounds: 38, split: false, months: EUROPE_MONTHS, monthRounds: [4, 4, 4, 4, 4, 4, 4, 4, 3, 3] },
  seriea: { teams: 20, rounds: 38, baseRounds: 38, split: false, months: EUROPE_MONTHS, monthRounds: [4, 4, 4, 4, 4, 4, 4, 4, 3, 3] },
  bundesliga: { teams: 18, rounds: 34, baseRounds: 34, split: false, months: EUROPE_MONTHS, monthRounds: [3, 4, 4, 4, 3, 4, 3, 3, 3, 3] },
  ligue1: { teams: 18, rounds: 34, baseRounds: 34, split: false, months: EUROPE_MONTHS, monthRounds: [3, 4, 4, 4, 3, 4, 3, 3, 3, 3] },
}

export const calOf = (leagueId: string): LeagueCal => CAL[leagueId] ?? CAL.k1

/** 챔피언스리그 단계별 토큰: 유럽 리그의 달 순번 → 그 달에 치르는 경기 순서 */
export const CL_MONTH_TOKENS: Record<number, string[]> = {
  1: ['md'],
  2: ['md', 'md'],
  3: ['md', 'md'],
  4: ['md', 'md'],
  5: ['md'],
  6: ['po1', 'po2'],
  7: ['r16_1', 'r16_2'],
  8: ['qf1', 'qf2'],
  9: ['sf1', 'sf2', 'final'],
}

export const isEuropeLeagueId = (id: string) => EUROPE_LEAGUES.includes(id)

/** 구단주 신뢰와 예산의 규모: 전력이 높을수록 돈 단위가 커진다 */
export function budgetFor(strength: number): number {
  return Math.round(30 * Math.pow(1.11, strength - 55))
}
const REF_BUDGET = 86
export const economyScale = (strength: number) => Math.max(0.3, budgetFor(strength) / REF_BUDGET)
export const clubScale = (clubId: string) => economyScale(clubById(clubId).strength)

/** 리그 규모에 맞춘 구단주 목표 순위 (전력 순위보다 한 단계 높게, 하위권은 잔류 선) */
export function targetRankFor(rank: number, size: number): number {
  return Math.min(Math.max(rank - 1, 1), size - 3)
}

export function targetLabel(target: number, league: string): string {
  if (league === 'k2') {
    if (target === 1) return '승격 도전'
    if (target <= 3) return '승격 경쟁'
    return '중위권 이상'
  }
  if (target === 1) return '우승 도전'
  if (target <= 3) return '상위권 (3위 이내)'
  if (target <= 6) return '중상위권'
  return '중위권 이상'
}
