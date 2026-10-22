import type { FormationId, Level, Philosophy, Player, Position } from './types'
import type { Rng } from './rng'

export const FORMATIONS: Record<
  FormationId,
  { DF: number; MF: number; FW: number; att: number; mid: number; def: number }
> = {
  '4-4-2': { DF: 4, MF: 4, FW: 2, att: 1, mid: 1, def: 1 },
  '4-3-3': { DF: 4, MF: 3, FW: 3, att: 1.03, mid: 0.99, def: 0.98 },
  '3-5-2': { DF: 3, MF: 5, FW: 2, att: 1, mid: 1.04, def: 0.98 },
  '4-2-3-1': { DF: 4, MF: 5, FW: 1, att: 0.99, mid: 1.02, def: 1 },
  '5-3-2': { DF: 5, MF: 3, FW: 2, att: 0.97, mid: 0.98, def: 1.04 },
}
export const FORMATION_IDS = Object.keys(FORMATIONS) as FormationId[]

export const PHILOSOPHY_LABEL: Record<Philosophy, string> = {
  attack: '공격',
  possession: '점유',
  defense: '수비',
  counter: '역습',
}
export const PHILOSOPHY_DESC: Record<Philosophy, string> = {
  attack: '라인을 올려 먼저 몰아붙인다',
  possession: '공을 오래 쥐고 경기를 지배한다',
  defense: '단단히 내려서서 실점을 줄인다',
  counter: '빠른 전환으로 한 번에 찌른다',
}
/** 상성: 공격→수비→점유→역습→공격 순으로 앞이 뒤에 강하다 */
export const PHILOSOPHY_BEATS: Record<Philosophy, Philosophy> = {
  attack: 'defense',
  defense: 'possession',
  possession: 'counter',
  counter: 'attack',
}
export const LEVEL_LABEL: Record<Level, string> = { low: '낮음', mid: '보통', high: '높음' }
export const POS_LABEL: Record<Position, string> = { GK: '골키퍼', DF: '수비수', MF: '미드필더', FW: '공격수' }

const SURNAMES = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오', '서', '신', '권', '황', '안', '송', '류', '홍', '문', '양', '손', '배', '백', '허', '유', '남', '심', '노']
const GIVEN = ['민준', '서준', '도윤', '시우', '지호', '준우', '현우', '건우', '우진', '선우', '주원', '재민', '태양', '승현', '지훈', '유찬', '동현', '하준', '정우', '은찬', '시현', '민재', '성민', '진우', '예준', '지성', '규현', '도현', '상혁', '재윤', '태민', '영우', '찬영', '승우', '호진', '기현', '다온', '이안', '강민', '세훈']

export function randomName(rng: Rng): string {
  return rng.pick(SURNAMES) + rng.pick(GIVEN)
}

/** 포지션별 구성: 골키퍼3 수비7 미드7 공격6 */
const SQUAD_PLAN: Position[] = [
  ...Array<Position>(3).fill('GK'),
  ...Array<Position>(7).fill('DF'),
  ...Array<Position>(7).fill('MF'),
  ...Array<Position>(6).fill('FW'),
]
export const SQUAD_TARGET = SQUAD_PLAN.length
export const SQUAD_MAX = 30

export function makePlayer(
  rng: Rng,
  idNum: number,
  pos: Position,
  strength: number,
  opts: { youth?: boolean; age?: number } = {},
): Player {
  const youth = !!opts.youth
  const age = opts.age ?? (youth ? rng.int(17, 19) : Math.round(Math.min(37, Math.max(19, rng.normal(26, 4.2)))))
  const base = youth ? strength - 14 : strength
  const ovr = clamp(Math.round(rng.normal(base, 4.5)), 40, 92)
  const growthRoom = age <= 21 ? rng.int(5, 16) : age <= 25 ? rng.int(2, 7) : rng.int(0, 3)
  return {
    id: `p${idNum}`,
    name: randomName(rng),
    pos,
    age,
    ovr,
    pot: clamp(ovr + growthRoom, ovr, 95),
    condition: 90 + rng.int(0, 10),
    morale: 60 + rng.int(0, 20),
    injuredRounds: 0,
    pushedReturn: false,
    contractYears: rng.int(1, 4),
    academy: youth || rng.chance(0.18),
    seasonApps: 0,
    seasonGoals: 0,
    careerApps: 0,
    careerGoals: 0,
    benchStreak: 0,
  }
}

export function generateSquad(rng: Rng, nextId: () => number, strength: number): Player[] {
  return SQUAD_PLAN.map((pos) => makePlayer(rng, nextId(), pos, strength + (pos === 'GK' ? -1 : 0)))
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 컨디션·사기를 반영한 실전 능력치 */
export function effectiveOvr(p: Player): number {
  return p.ovr * (0.8 + 0.2 * (p.condition / 100)) * (0.94 + 0.06 * (p.morale / 100))
}

export function isAvailable(p: Player): boolean {
  return p.injuredRounds <= 0
}

/** 포메이션에 맞춰 최적 선발 11명을 고른다 (컨디션 반영) */
export function pickLineup(squad: Player[], formation: FormationId): Player[] {
  const f = FORMATIONS[formation]
  const need: Record<Position, number> = { GK: 1, DF: f.DF, MF: f.MF, FW: f.FW }
  const out: Player[] = []
  const used = new Set<string>()
  for (const pos of ['GK', 'DF', 'MF', 'FW'] as Position[]) {
    const pool = squad
      .filter((p) => p.pos === pos && isAvailable(p))
      .sort((a, b) => effectiveOvr(b) - effectiveOvr(a))
    for (const p of pool.slice(0, need[pos])) {
      out.push(p)
      used.add(p.id)
    }
    // 해당 포지션이 모자라면 다른 포지션 선수로 채운다 (능력치 감점)
    let missing = need[pos] - Math.min(need[pos], pool.length)
    if (missing > 0) {
      const rest = squad
        .filter((p) => !used.has(p.id) && isAvailable(p) && p.pos !== 'GK')
        .sort((a, b) => effectiveOvr(b) - effectiveOvr(a))
      for (const p of rest) {
        if (missing <= 0) break
        out.push({ ...p, pos })
        used.add(p.id)
        missing--
      }
    }
  }
  return out
}

/** 수동 선발을 검증해 쓸 수 있는 11명으로 돌려준다. 문제가 있으면 자동 선발. */
export function resolveLineup(squad: Player[], formation: FormationId, manual: string[] | null): Player[] {
  if (manual) {
    const f = FORMATIONS[formation]
    const chosen = manual
      .map((id) => squad.find((p) => p.id === id))
      .filter((p): p is Player => !!p && isAvailable(p))
    const count = (pos: Position) => chosen.filter((p) => p.pos === pos).length
    if (chosen.length === 11 && count('GK') === 1 && count('DF') === f.DF && count('MF') === f.MF && count('FW') === f.FW) {
      return chosen
    }
  }
  return pickLineup(squad, formation)
}

export interface LineRatings {
  att: number
  mid: number
  def: number
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 40)

export function lineRatings(lineup: Player[], formation: FormationId): LineRatings {
  const f = FORMATIONS[formation]
  const by = (pos: Position) => lineup.filter((p) => p.pos === pos).map(effectiveOvr)
  const gk = avg(by('GK'))
  const df = avg(by('DF'))
  const mf = avg(by('MF'))
  const fw = avg(by('FW'))
  return {
    att: (fw * 0.62 + mf * 0.38) * f.att,
    mid: mf * f.mid,
    def: (df * 0.68 + gk * 0.32) * f.def,
  }
}

/** 팀 종합 능력치 — 전력 순위 비교용 */
export function teamOverall(squad: Player[]): number {
  const top = [...squad].sort((a, b) => b.ovr - a.ovr).slice(0, 14)
  return avg(top.map((p) => p.ovr))
}

/** 라운드당 선수단 인건비 (억 원). 선수가 많고 능력치가 높을수록 커진다 */
export function wageBill(squad: Player[]): number {
  return squad.length * 0.034 + squad.reduce((a, p) => a + Math.max(0, p.ovr - 60), 0) * 0.007
}

/** 이적 시장 가치 (억 원) */
export function playerValue(p: Player): number {
  const raw = Math.pow(Math.max(0, p.ovr - 48), 2) / 16
  const ageF = p.age <= 22 ? 1.35 : p.age <= 28 ? 1 : p.age <= 31 ? 0.7 : 0.4
  const potBonus = p.age <= 23 ? (p.pot - p.ovr) * 0.25 : 0
  return Math.max(0.5, Math.round((raw * ageF + potBonus) * 10) / 10)
}
