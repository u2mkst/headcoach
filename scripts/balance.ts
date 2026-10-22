/** 자동 플레이로 난이도 곡선을 확인한다: npm run balance [판수] [시즌수] */
import { startedGameFor } from './botGame'
import { chooseEvent, finishSeason, playMonth, setMonthPlan, setTactics } from '../src/engine/game'
import { describeEvent } from '../src/engine/events'
import type { GameState, Philosophy, SpendFocus } from '../src/engine/types'
import { OUTCOME_LABEL } from '../src/engine/career'
import { PHILOSOPHY_BEATS } from '../src/engine/squad'
import { userClub } from '../src/engine/helpers'
import { lineInfos } from '../src/ui/derive'

const GAMES = Number(process.argv[2] ?? 100)
const SEASONS = Number(process.argv[3] ?? 4)

type Bot = 'passive' | 'invest' | 'smart' | 'active'
const BOTS: Bot[] = ['passive', 'invest', 'smart', 'active']
const NAMES: Record<Bot, string> = {
  passive: '전술 고정 · 보강 없음',
  invest: '전술 고정 · 매달 가장 약한 라인에 보강(보통)',
  smart: '철학 유지 + 포메이션 번갈아 + 보강',
  active: '상대에 맞춰 철학 변경 · 보강 없음',
}
const results: Record<Bot, Record<number, Record<string, number>>> = { passive: {}, invest: {}, smart: {}, active: {} }
const ranks: Record<Bot, Record<number, number[]>> = { passive: {}, invest: {}, smart: {}, active: {} }
const fired: Record<Bot, number> = { passive: 0, invest: 0, smart: 0, active: 0 }
const upgrades: Record<Bot, number> = { passive: 0, invest: 0, smart: 0, active: 0 }
const support: Record<Bot, number[]> = { passive: [], invest: [], smart: [], active: [] }
const achTally: Record<string, number> = {}
let goals = 0
let matches = 0
let homeWins = 0
let draws = 0

function weakestFocus(s: GameState): SpendFocus {
  const l = lineInfos(s)
    .filter((x) => x.pos !== 'GK')
    .sort((a, b) => b.rank - a.rank || a.rating - b.rating)[0]
  return l.pos === 'FW' ? 'attack' : l.pos === 'MF' ? 'midfield' : 'defense'
}

function playSeason(s0: GameState, bot: Bot): GameState {
  let s = s0
  while (s.phase === 'play') {
    const month = s.month
    if (bot === 'smart' || bot === 'invest') {
      if (userClub(s).budget >= 25) [s] = setMonthPlan(s, { focus: weakestFocus(s), level: 'medium' })
    }
    if (bot === 'smart' && month % 2 === 1) {
      const forms = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '5-3-2'] as const
      s = setTactics(s, { formation: forms[(month - 1) % forms.length] })
    }
    if (bot === 'active') {
      const next = s.fixtures[Math.min(s.round, s.fixtures.length - 1)].find((f) => f.home === s.userClubId || f.away === s.userClubId)!
      const oppId = next.home === s.userClubId ? next.away : next.home
      const counter = (Object.keys(PHILOSOPHY_BEATS) as Philosophy[]).find((p) => PHILOSOPHY_BEATS[p] === s.clubs[oppId].philosophy)!
      s = setTactics(s, { philosophy: counter })
    }
    const before = s.results.length
    ;[s] = playMonth(s)
    for (const r of s.results.slice(before)) {
      goals += r.hg + r.ag
      matches++
      if (r.hg > r.ag) homeWins++
      if (r.hg === r.ag) draws++
    }
    support[bot].push(s.fan.support)
    for (const ev of [...s.events]) [s] = chooseEvent(s, ev.uid, describeEvent(ev).choices[0].id)
  }
  return s
}

for (const bot of BOTS) {
  for (let g = 0; g < GAMES; g++) {
    let s: GameState = startedGameFor(1000 + g)
    for (let k = 1; k <= SEASONS; k++) {
      s = playSeason(s, bot)
      const sum = s.seasons[s.seasons.length - 1]
      results[bot][k] ??= {}
      results[bot][k][sum.outcome] = (results[bot][k][sum.outcome] ?? 0) + 1
      ;(ranks[bot][k] ??= []).push(sum.rank)
      if (sum.upgraded) upgrades[bot]++
      for (const a of sum.achievements) achTally[a] = (achTally[a] ?? 0) + 1
      const pc = s.pendingCareer!
      if (pc.decision.kind === 'fired') fired[bot]++
      s = finishSeason(s, pc.decision.kind === 'fired' ? pc.offers[0].clubId : null)
    }
  }
}

const pct = (n: number, d: number) => `${Math.round((n / d) * 100)}%`
for (const bot of BOTS) {
  console.log(`\n=== ${NAMES[bot]} · ${GAMES}판 ===`)
  for (let k = 1; k <= SEASONS; k++) {
    const row = results[bot][k]
    const line = (Object.keys(OUTCOME_LABEL) as (keyof typeof OUTCOME_LABEL)[])
      .map((o) => `${OUTCOME_LABEL[o]} ${pct(row[o] ?? 0, GAMES)}`)
      .join(' · ')
    const avgRank = ranks[bot][k].reduce((a, b) => a + b, 0) / GAMES
    console.log(`${k}시즌  평균 ${avgRank.toFixed(1)}위 | ${line}`)
  }
  const sp = support[bot]
  console.log(`경질 ${fired[bot]}회 · 성과 인정 ${upgrades[bot]}회 / ${GAMES * SEASONS}시즌 · 지지도 평균 ${(sp.reduce((a, b) => a + b, 0) / sp.length).toFixed(0)}% (최저 ${Math.min(...sp).toFixed(0)} · 최고 ${Math.max(...sp).toFixed(0)})`)
}
console.log('성과 집계:', JSON.stringify(achTally))
console.log(`경기당 평균 득점 ${(goals / matches).toFixed(2)} | 홈 승 ${pct(homeWins, matches)} | 무승부 ${pct(draws, matches)}`)
