import { describe, expect, it } from 'vitest'
import { CLUBS } from '../data/clubs'
import { createRng } from './rng'
import { effectiveRatings, expectedGoals, simulateMatch, type TeamSide } from './match'
import { computeStandings, exposurePenalty, generateSchedule, nextTacticMemory, afterMatchMemory } from './season'
import { generateSquad, pickLineup, PHILOSOPHY_BEATS } from './squad'
import { describeEvent, resolveEvent } from './events'
import {
  backToOffers,
  chooseCoach,
  chooseEvent,
  chooseOffer,
  createManager,
  finishSeason,
  newGame,
  playMonth,
  startSeason,
  setMonthPlan,
} from './game'
import { userClub, pushTimeline } from './helpers'
import { josa } from './josa'
import { MANAGER_STYLES } from './game'
import { updateFan } from './fans'
import { computeStandings as standingsFor } from './season'
import type { GameState, Tactics } from './types'

export function startedGame(seed = 7): GameState {
  let s = newGame(seed)
  s = createManager(s, {
    name: '테스트',
    nationality: '대한민국',
    style: 'tactician',
    difficulty: 'normal',
  })
  s = chooseOffer(s, s.offers[1].clubId)
  s = chooseCoach(s, s.coachCandidates[0].id)
  return startSeason(s)
}

function side(clubId: string, t: Partial<Tactics> = {}, seed = 1): TeamSide {
  const rng = createRng(seed)
  let n = 0
  const strength = CLUBS.find((c) => c.id === clubId)!.strength
  const squad = generateSquad(rng, () => ++n, strength)
  const tactics: Tactics = { philosophy: 'possession', formation: '4-4-2', pressing: 'mid', line: 'mid', ...t }
  return { clubId, lineup: pickLineup(squad, tactics.formation), tactics, mult: 1 }
}

describe('일정', () => {
  const rng = createRng(3)
  const ids = CLUBS.map((c) => c.id)
  const fixtures = generateSchedule(rng, ids)
  it('10개 구단은 18라운드, 라운드마다 5경기', () => {
    expect(fixtures).toHaveLength(18)
    for (const r of fixtures) expect(r).toHaveLength(5)
  })
  it('모든 팀이 라운드마다 정확히 한 번 뛴다', () => {
    for (const r of fixtures) {
      const seen = r.flatMap((f) => [f.home, f.away])
      expect(new Set(seen).size).toBe(10)
    }
  })
  it('같은 상대와 홈·원정으로 한 번씩 만난다', () => {
    const count = new Map<string, number>()
    for (const r of fixtures) for (const f of r) count.set(`${f.home}>${f.away}`, (count.get(`${f.home}>${f.away}`) ?? 0) + 1)
    for (const a of ids) for (const b of ids) if (a !== b) expect(count.get(`${a}>${b}`)).toBe(1)
  })
})

describe('경기 규칙', () => {
  it('같은 시드면 같은 결과', () => {
    const a = simulateMatch(createRng(5), side('club_001'), side('club_002', {}, 2))
    const b = simulateMatch(createRng(5), side('club_001'), side('club_002', {}, 2))
    expect(a).toEqual(b)
  })
  it('홈 이점이 기대 득점에 반영된다', () => {
    const r = effectiveRatings(side('club_001'), side('club_002'))
    expect(expectedGoals(r, r, true)).toBeGreaterThan(expectedGoals(r, r, false))
  })
  it('철학 상성: 공격→수비→점유→역습→공격', () => {
    expect(PHILOSOPHY_BEATS).toEqual({ attack: 'defense', defense: 'possession', possession: 'counter', counter: 'attack' })
    const atk = side('club_003', { philosophy: 'attack' })
    const def = side('club_003', { philosophy: 'defense' })
    const ra = effectiveRatings(atk, def)
    const rd = effectiveRatings(def, atk)
    // 같은 선수단이면 상성 우위인 쪽 공격 전력이 상대 수비 전력보다 더 높게 나온다
    expect(ra.att / rd.def).toBeGreaterThan(rd.att / ra.def)
  })
  it('강팀이 약팀을 장기적으로 더 자주 이긴다', () => {
    const rng = createRng(11)
    let strong = 0
    let weak = 0
    for (let i = 0; i < 600; i++) {
      const r = simulateMatch(rng, side('club_002', {}, i + 1), side('club_010', {}, i + 1000)).result
      if (r.hg > r.ag) strong++
      else if (r.hg < r.ag) weak++
    }
    expect(strong).toBeGreaterThan(weak * 1.5)
  })
  it('순위표는 승 3점 무 1점', () => {
    const t = computeStandings(
      [
        { season: 1, round: 1, home: 'a', away: 'b', hg: 2, ag: 0, scorers: [], possession: 50, shotsHome: 1, shotsAway: 1 },
        { season: 1, round: 2, home: 'b', away: 'a', hg: 1, ag: 1, scorers: [], possession: 50, shotsHome: 1, shotsAway: 1 },
      ],
      ['a', 'b'],
    )
    expect(t[0]).toMatchObject({ clubId: 'a', pts: 4, w: 1, d: 1 })
    expect(t[1]).toMatchObject({ clubId: 'b', pts: 1, l: 1, d: 1 })
  })
})

describe('전술 노출·숙련도', () => {
  const t: Tactics = { philosophy: 'attack', formation: '4-3-3', pressing: 'high', line: 'high' }
  it('같은 설정 5경기 연속부터 감점', () => {
    let mem = { streak: 0, lastKey: null as string | null, familiarity: 0, lastPhilosophy: null as Tactics['philosophy'] | null }
    const pen: number[] = []
    for (let i = 0; i < 7; i++) {
      mem = nextTacticMemory(mem, t)
      pen.push(exposurePenalty(mem.streak))
      mem = afterMatchMemory(mem)
    }
    expect(pen.slice(0, 4)).toEqual([0, 0, 0, 0])
    expect(pen[4]).toBeGreaterThan(0)
    expect(pen[6]).toBeGreaterThan(pen[4])
    expect(pen[6]).toBeLessThanOrEqual(0.03)
  })
  it('철학을 유지하면 숙련도가 오르고 바꾸면 떨어진다', () => {
    let mem = { streak: 0, lastKey: null as string | null, familiarity: 0, lastPhilosophy: null as Tactics['philosophy'] | null }
    for (let i = 0; i < 4; i++) {
      mem = afterMatchMemory(nextTacticMemory(mem, t))
    }
    const high = mem.familiarity
    expect(high).toBeGreaterThan(40)
    const changed = nextTacticMemory(mem, { ...t, philosophy: 'defense' })
    expect(changed.familiarity).toBeLessThan(high)
    expect(changed.streak).toBe(1)
  })
  it('포메이션만 바꾸면 노출은 초기화되지만 숙련도는 유지', () => {
    let mem = { streak: 0, lastKey: null as string | null, familiarity: 0, lastPhilosophy: null as Tactics['philosophy'] | null }
    for (let i = 0; i < 5; i++) mem = afterMatchMemory(nextTacticMemory(mem, t))
    const fam = mem.familiarity
    const next = nextTacticMemory(mem, { ...t, formation: '4-4-2' })
    expect(next.streak).toBe(1)
    expect(next.familiarity).toBe(fam)
  })
})

describe('게임 흐름', () => {
  it('시작 흐름: 감독 → 제안 → 수석코치 → 확인 → 홈', () => {
    const s = startedGame()
    expect(s.phase).toBe('play')
    expect(s.manager?.name).toBe('테스트')
    expect(s.coach).not.toBeNull()
    expect(s.userClubId).not.toBeNull()
    expect(userClub(s).squad).toHaveLength(23)
  })
  it('확인 시트에서 "다시 보기"로 되돌아갈 수 있다', () => {
    let s = newGame(2)
    s = createManager(s, { name: 'a', nationality: '대한민국', style: 'defensive', difficulty: 'normal' })
    s = chooseCoach(chooseOffer(s, s.offers[0].clubId), (chooseOffer(s, s.offers[0].clubId)).coachCandidates[0].id)
    expect(s.phase).toBe('confirm')
    expect(backToOffers(s).phase).toBe('offers')
  })
  it('상태는 JSON으로 저장·복원해도 같은 경기가 이어진다', () => {
    let a = startedGame(21)
    const b: GameState = JSON.parse(JSON.stringify(a))
    ;[a] = playMonth(a)
    const [b2] = playMonth(b)
    expect(a.results).toEqual(b2.results)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b2))
  })
  it('한 시즌을 끝까지 돌리면 결산이 나오고 다음 시즌으로 넘어간다', () => {
    let s = startedGame(33)
    for (let i = 0; i < 6; i++) [s] = playMonth(s)
    expect(s.phase).toBe('seasonEnd')
    expect(s.seasons).toHaveLength(1)
    expect(s.results).toHaveLength(90)
    expect(s.pendingCareer).not.toBeNull()
    const pc = s.pendingCareer!
    const next = finishSeason(s, pc.decision.kind === 'fired' ? pc.offers[0].clubId : null)
    expect(next.season).toBe(2)
    expect(next.round).toBe(0)
    expect(next.phase).toBe('play')
    expect(next.results).toHaveLength(0)
    expect(userClub(next).squad.length).toBeGreaterThanOrEqual(23)
  })
  it('모든 이벤트의 모든 선택지가 오류 없이 처리된다', () => {
    const types = ['press', 'complaint', 'injury', 'offer', 'owner', 'prospect', 'protest', 'rival', 'lockerroom'] as const
    for (const type of types) {
      const base = startedGame(5)
      const p = userClub(base).squad[3]
      p.injuredRounds = 4
      const q = userClub(base).squad[5]
      const params = {
        summary: '테스트', playerId: p.id, no: p.no, pos: p.pos, ovr: p.ovr, rounds: 4,
        club: '울산', price: 12, target: 4, age: 18, pot: 80, rivalName: '울산',
        aId: p.id, bId: q.id, a: '9번 공격수', b: '5번 수비수',
      }
      const ev = { uid: 'ev1', type, createdRound: 0, season: 1, params }
      const view = describeEvent(ev)
      expect(view.choices.length).toBeGreaterThanOrEqual(3)
      for (const c of view.choices) {
        const s: GameState = structuredClone(base)
        s.events.push(ev)
        const out = resolveEvent(s, createRng(1), 'ev1', c.id)
        expect(out.text.length).toBeGreaterThan(0)
        expect(s.events).toHaveLength(0)
      }
    }
  })
  it('무리한 복귀는 다음 시즌 기량 하락으로 이어진다', () => {
    let s = startedGame(9)
    const star = [...userClub(s).squad].sort((a, b) => b.ovr - a.ovr)[0]
    const before = star.ovr
    s = structuredClone(s)
    const sp = userClub(s).squad.find((p) => p.id === star.id)!
    sp.age = 27
    sp.injuredRounds = 5
    s.events.push({ uid: 'inj', type: 'injury', createdRound: 0, season: 1, params: { playerId: sp.id, no: sp.no, pos: sp.pos, ovr: sp.ovr, rounds: 5 } })
    ;[s] = chooseEvent(s, 'inj', 'rush')
    expect(userClub(s).squad.find((p) => p.id === star.id)!.pushedReturn).toBe(true)
    for (let i = 0; i < 6; i++) [s] = playMonth(s)
    const pc = s.pendingCareer!
    const next = finishSeason(s, pc.decision.kind === 'fired' ? pc.offers[0].clubId : null)
    const after = next.clubs[s.userClubId!].squad.find((p) => p.id === star.id)
    // 이적했거나 은퇴하지 않았다면 기량이 떨어져 있어야 한다 (성장 최대치보다 더 큰 감점)
    if (after && next.userClubId === s.userClubId) expect(after.ovr).toBeLessThanOrEqual(before)
  })
  it('저장 상태에는 함수가 없다', () => {
    const s = startedGame(1)
    const hasFn = (o: unknown): boolean => typeof o === 'function' || (!!o && typeof o === 'object' && Object.values(o).some(hasFn))
    expect(hasFn(s)).toBe(false)
    pushTimeline(s, 'event', 'x')
  })
})

describe('조사', () => {
  it('받침에 따라 알맞은 조사를 붙인다', () => {
    expect(josa('강원', '과/와')).toBe('강원과')
    expect(josa('대구', '과/와')).toBe('대구와')
    expect(josa('울산 HD', '이/가')).toBe('울산 HD가')
    expect(josa('서울', '으로/로')).toBe('서울로')
    expect(josa('제주 SK FC', '은/는')).toBe('제주 SK FC는')
    expect(josa('김민준', '을/를')).toBe('김민준을')
    expect(josa('이서', '은/는')).toBe('이서는')
  })
})

describe('시즌 결산', () => {
  it('평가는 순위와 목표의 차이를 따르고, 성과 인정은 한 단계만 올린다', () => {
    for (const seed of [11, 12, 13, 14]) {
      let s = startedGame(seed)
      for (let i = 0; i < 6; i++) [s] = playMonth(s)
      const sum = s.seasons[0]
      const table = standingsFor(s.results, Object.keys(s.clubs))
      expect(sum.rank).toBe(table.findIndex((t) => t.clubId === s.userClubId) + 1)
      const delta = sum.rank - sum.targetRank
      const base = sum.rank === 1 ? 'champion' : delta <= -2 ? 'exceeded' : delta <= 0 ? 'achieved' : delta <= 2 ? 'fell_short' : 'failed'
      if (!sum.upgraded) expect(sum.outcome).toBe(base)
      else expect(['achieved', 'fell_short']).toContain(sum.outcome)
      expect(sum.w + sum.d + sum.l).toBe(18)
      expect(sum.points).toBe(sum.w * 3 + sum.d)
    }
  })
  it('유소년 기용 약속은 시즌 끝에 점검된다', () => {
    let s = startedGame(15)
    s = structuredClone(s)
    s.events.push({ uid: 'o', type: 'owner', createdRound: 0, season: 1, params: { target: 5 } })
    ;[s] = chooseEvent(s, 'o', 'youth')
    expect(s.promises[0]).toMatchObject({ type: 'youth', season: 1 })
    for (let i = 0; i < 6; i++) [s] = playMonth(s)
    expect(s.seasons[0].promiseNotes.some((n) => n.includes('유소년 기용 약속'))).toBe(true)
  })
})

describe('선수 이름 없음', () => {
  it('선수는 이름 대신 구단 안에서 유일한 등번호를 가진다', () => {
    let s = startedGame(41)
    for (let i = 0; i < 6; i++) [s] = playMonth(s)
    const next = finishSeason(s, s.pendingCareer!.decision.kind === 'fired' ? s.pendingCareer!.offers[0].clubId : null)
    for (const state of [s, next]) {
      for (const club of Object.values(state.clubs)) {
        const nos = club.squad.map((p) => p.no)
        expect(nos.every((n) => n > 0)).toBe(true)
        expect(new Set(nos).size).toBe(nos.length)
        for (const p of club.squad) expect('name' in p).toBe(false)
      }
    }
  })
  it('이벤트·득점 기록에도 선수 이름이 들어가지 않는다', () => {
    let s = startedGame(42)
    for (let i = 0; i < 6; i++) [s] = playMonth(s)
    for (const r of s.results) for (const g of r.scorers) expect('name' in g).toBe(false)
    expect(s.seasons[0] && 'topScorer' in s.seasons[0]).toBeFalsy()
  })
})

describe('한 달 진행', () => {
  it('한 달은 3라운드, 한 시즌은 6개월이다', () => {
    let s = startedGame(51)
    let r: ReturnType<typeof playMonth>[1]
    ;[s, r] = playMonth(s)
    expect(s.round).toBe(3)
    expect(r.report.month).toBe(1)
    expect(r.report.results).toHaveLength(3)
    expect(r.report.w + r.report.d + r.report.l).toBe(3)
    for (let m = 2; m <= 6; m++) [s, r] = playMonth(s)
    expect(r.report.month).toBe(6)
    expect(r.seasonOver).toBe(true)
    expect(s.phase).toBe('seasonEnd')
  })
  it('달마다 보고서·가상 기사·커뮤니티 글이 쌓인다', () => {
    let s = startedGame(52)
    ;[s] = playMonth(s)
    const rep = s.monthReport!
    expect(rep.highlights.length).toBeGreaterThan(0)
    expect(s.feed.filter((f) => f.kind === 'fan').length).toBeGreaterThanOrEqual(4)
    expect(s.feed.filter((f) => f.kind === 'article').length).toBeGreaterThanOrEqual(2)
    for (const f of s.feed.filter((x) => x.kind === 'fan')) {
      expect(f.likes).toBeGreaterThan(0)
      expect(f.topic).toBeDefined()
    }
    expect(s.timeline.some((t) => t.kind === 'result' && t.text.includes('월'))).toBe(true)
  })
})

describe('전력 보강 예산', () => {
  it('공격 보강은 예산을 쓰고 공격수를 한 명 늘린다', () => {
    let s = startedGame(53)
    const budget = userClub(s).budget
    const fw = userClub(s).squad.filter((p) => p.pos === 'FW').length
    let err: string | null
    ;[s, err] = setMonthPlan(s, { focus: 'attack', level: 'medium' })
    expect(err).toBeNull()
    ;[s] = playMonth(s)
    expect(s.monthPlan).toBeNull()
    expect(s.monthReport!.planLine).toContain('영입')
    expect(userClub(s).squad.filter((p) => p.pos === 'FW').length).toBe(fw + 1)
    // 15억을 썼고, 한 달 수입·인건비가 더해진다
    expect(userClub(s).budget).toBeLessThan(budget - 10)
  })
  it('예산이 모자라면 정할 수 없다', () => {
    let s = startedGame(54)
    s = structuredClone(s)
    userClub(s).budget = 3
    let err: string | null
    ;[s, err] = setMonthPlan(s, { focus: 'attack', level: 'large' })
    expect(err).toMatch(/예산/)
    expect(s.monthPlan).toBeNull()
  })
  it('예산 아끼기는 예산을 늘린다', () => {
    const base = startedGame(55)
    const [a] = playMonth(base)
    const [saved0] = setMonthPlan(base, { focus: 'save', level: 'large' })
    const [b] = playMonth(saved0)
    expect(userClub(b).budget).toBeGreaterThan(userClub(a).budget + 5)
    expect(b.monthReport!.planLine).toContain('아꼈어요')
  })
  it('같은 한 달 성적이라도 투자는 지지도를 올리고 저축은 깎는다', () => {
    const stats = { w: 1, d: 1, l: 1, gf: 3, ga: 3, rank: 5 }
    const run = (plan: Parameters<typeof updateFan>[2]) => {
      const s = structuredClone(startedGame(56))
      s.targetRank = 5
      updateFan(s, stats, plan)
      return s
    }
    const none = run(null)
    const invest = run({ focus: 'midfield', level: 'large' })
    const save = run({ focus: 'save', level: 'large' })
    expect(invest.fan.support).toBeGreaterThan(none.fan.support)
    expect(save.fan.support).toBeLessThan(none.fan.support)
  })
  it('유소년 투자는 오프시즌 성장에 쓰이고 시즌이 바뀌면 초기화된다', () => {
    let s = startedGame(57)
    s = setMonthPlan(s, { focus: 'youth', level: 'large' })[0]
    ;[s] = playMonth(s)
    expect(s.youthInvest).toBeGreaterThan(0)
    for (let i = 0; i < 5; i++) [s] = playMonth(s)
    const pc = s.pendingCareer!
    const next = finishSeason(s, pc.decision.kind === 'fired' ? pc.offers[0].clubId : null)
    expect(next.youthInvest).toBe(0)
  })
})

describe('팬 지지도', () => {
  it('지지도는 0~100 안에서 움직이고 승리·패배에 반응한다', () => {
    let s = startedGame(58)
    const seen: number[] = [s.fan.support]
    for (let i = 0; i < 6; i++) {
      ;[s] = playMonth(s)
      seen.push(s.fan.support)
      expect(s.fan.support).toBeGreaterThanOrEqual(0)
      expect(s.fan.support).toBeLessThanOrEqual(100)
      const rep = s.monthReport!
      const net = rep.w - rep.l
      const d = rep.fanAfter.results - rep.fanBefore.results
      if (net >= 2) expect(d).toBeGreaterThan(0)
      if (net <= -2) expect(d).toBeLessThan(0)
    }
    expect(new Set(seen).size).toBeGreaterThan(2)
  })
})

describe('감독 성향', () => {
  it('성향 4가지는 능력치 합이 같고 모두 같은 명성으로 시작한다', () => {
    expect(MANAGER_STYLES).toHaveLength(4)
    for (const m of MANAGER_STYLES) {
      expect(Object.values(m.abilities).reduce((a, b) => a + b, 0)).toBe(27)
      expect(Math.max(...Object.values(m.abilities))).toBeLessThanOrEqual(10)
    }
    const reps = MANAGER_STYLES.map((m) => {
      const s = createManager(newGame(1), { name: 'a', nationality: '대한민국', style: m.id, difficulty: 'normal' })
      return s.manager!.reputation
    })
    expect(new Set(reps).size).toBe(1)
  })
  it('고른 성향이 능력치와 시작 전술을 정한다', () => {
    for (const m of MANAGER_STYLES) {
      let s = createManager(newGame(2), { name: 'a', nationality: '대한민국', style: m.id, difficulty: 'normal' })
      expect(s.manager!.abilities).toEqual(m.abilities)
      expect(s.manager!.background).toBe(m.label)
      s = chooseOffer(s, s.offers[0].clubId)
      expect(s.tactics).toEqual(m.tactics)
    }
  })
})
