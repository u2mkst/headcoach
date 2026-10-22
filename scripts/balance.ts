/** 자동 플레이로 난이도 곡선을 확인한다: npm run balance [판수] [시즌수] */
import { startedGameFor } from './botGame'
import { playRound, finishSeason, chooseEvent, setTactics } from '../src/engine/game'
import { describeEvent } from '../src/engine/events'
import type { GameState, Philosophy } from '../src/engine/types'
import { OUTCOME_LABEL } from '../src/engine/career'
import { PHILOSOPHY_BEATS } from '../src/engine/squad'
import { userClub } from '../src/engine/helpers'

const GAMES = Number(process.argv[2] ?? 120)
const SEASONS = Number(process.argv[3] ?? 4)

type Bot = 'passive' | 'smart' | 'active'
const BOTS: Bot[] = ['passive', 'smart', 'active']
const NAMES: Record<Bot, string> = {
  passive: '전술 고정',
  smart: '철학 유지 + 세부 전술 4경기마다 변경',
  active: '상대에 맞춰 철학 변경',
}
const results: Record<Bot, Record<number, Record<string, number>>> = { passive: {}, smart: {}, active: {} }
const ranks: Record<Bot, Record<number, number[]>> = { passive: {}, smart: {}, active: {} }
const upgrades: Record<Bot, number> = { passive: 0, smart: 0, active: 0 }
const fired: Record<Bot, number> = { passive: 0, smart: 0, active: 0 }
const achTally: Record<string, number> = {}
let youthAppsSum = 0
let youthAppsN = 0
let goals = 0
let matches = 0
let homeWins = 0
let draws = 0

function playSeason(s0: GameState, bot: Bot): GameState {
  let s = s0
  while (s.phase === 'play') {
    if (bot === 'smart' && s.round % 4 === 0) {
      const forms = ['4-4-2', '4-3-3', '3-5-2', '4-2-3-1', '5-3-2'] as const
      s = setTactics(s, { formation: forms[(s.round / 4) % forms.length] })
    }
    if (bot === 'active') {
      // 3경기마다 철학을 바꾸고, 상대 철학에 강한 철학을 고른다
      if (s.round % 3 === 0) {
        const next = s.fixtures[s.round].find((f) => f.home === s.userClubId || f.away === s.userClubId)!
        const oppId = next.home === s.userClubId ? next.away : next.home
        const oppPhil = s.clubs[oppId].philosophy as Philosophy
        const counter = (Object.keys(PHILOSOPHY_BEATS) as Philosophy[]).find((p) => PHILOSOPHY_BEATS[p] === oppPhil)!
        s = setTactics(s, { philosophy: counter })
      }
    }
    const [n, rep] = playRound(s)
    s = n
    for (const r of s.results.slice(-5)) {
      goals += r.hg + r.ag
      matches++
      if (r.hg > r.ag) homeWins++
      if (r.hg === r.ag) draws++
    }
    void rep
    // 이벤트는 첫 번째 선택지로 처리
    for (const ev of [...s.events]) {
      ;[s] = chooseEvent(s, ev.uid, describeEvent(ev).choices[0].id)
    }
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
      youthAppsSum += userClub(s).squad.filter((p) => p.age <= 21).reduce((a, p) => a + p.seasonApps, 0)
      youthAppsN++
      const pc = s.pendingCareer!
      if (pc.decision.kind === 'fired') fired[bot]++
      s = finishSeason(s, pc.decision.kind === 'fired' ? pc.offers[0].clubId : null)
      void userClub
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
  console.log(`경질 ${fired[bot]}회 · 성과 인정 ${upgrades[bot]}회 / ${GAMES * SEASONS}시즌`)
}
console.log('성과 집계:', JSON.stringify(achTally), `| 21세 이하 평균 출전 ${(youthAppsSum / youthAppsN).toFixed(1)}회`)
console.log(`\n경기당 평균 득점 ${(goals / matches).toFixed(2)} | 홈 승 ${pct(homeWins, matches)} | 무승부 ${pct(draws, matches)}`)
