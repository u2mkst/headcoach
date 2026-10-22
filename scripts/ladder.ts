/** 커리어 사다리 점검: 매달 보강하고, 이적 제안은 가장 높은 구단을 고르는 봇이 몇 시즌에 어디까지 가는가. npm run ladder [판수] [시즌수] */
import { startedGameFor } from './botGame'
import { chooseEvent, finishSeason, playMonth, setMonthPlan, setTactics } from '../src/engine/game'
import { describeEvent } from '../src/engine/events'
import { clubById } from '../src/data/clubs'
import { userClub } from '../src/engine/helpers'
import { lineInfos } from '../src/ui/derive'
import { PHILOSOPHY_BEATS } from '../src/engine/squad'
import { userLeagueId } from '../src/engine/season'
import type { GameState, Philosophy, SpendFocus } from '../src/engine/types'

const GAMES = Number(process.argv[2] ?? 20)
const SEASONS = Number(process.argv[3] ?? 14)
const START = process.argv[4] ?? 'club_005'

const weakest = (s: GameState): SpendFocus => {
  const l = lineInfos(s).filter((x) => x.pos !== 'GK').sort((a, b) => b.rank - a.rank || a.rating - b.rating)[0]
  return l.pos === 'FW' ? 'attack' : l.pos === 'MF' ? 'midfield' : 'defense'
}

function season(s0: GameState): GameState {
  let s = s0
  while (s.phase === 'play') {
    if (userClub(s).budget >= 20) [s] = setMonthPlan(s, { focus: weakest(s), level: 'medium' })
    const f = s.fixtures[Math.min(s.round, s.fixtures.length - 1)].find((x) => x.home === s.userClubId || x.away === s.userClubId)
    if (f) {
      const opp = f.home === s.userClubId ? f.away : f.home
      const counter = (Object.keys(PHILOSOPHY_BEATS) as Philosophy[]).find((p) => PHILOSOPHY_BEATS[p] === s.clubs[opp].philosophy)!
      s = setTactics(s, { philosophy: counter })
    }
    ;[s] = playMonth(s)
    for (const ev of [...s.events]) [s] = chooseEvent(s, ev.uid, describeEvent(ev).choices[0].id)
  }
  return s
}

const firstEuro: number[] = []
const firstWin: number[] = []
const maxRep: number[] = []
let example: string[] = []
for (let g = 0; g < GAMES; g++) {
  let s = startedGameFor(7000 + g, START)
  let euro = 0
  let win = 0
  const log: string[] = []
  for (let k = 1; k <= SEASONS; k++) {
    s = season(s)
    const sum = s.seasons[s.seasons.length - 1]
    const lg = sum.league
    if (!euro && !['k1', 'k2'].includes(lg)) euro = k
    if (!win && sum.cl === '우승') win = k
    log.push(`${k}:${clubById(sum.clubId).short}(${lg}) ${sum.rank}위${sum.cl ? ` CL ${sum.cl}` : ''}${sum.moved ? ` ${sum.moved === 'promoted' ? '승격' : '강등'}` : ''}`)
    const pc = s.pendingCareer!
    // 가장 높은 전력의 제안을 고른다 (없으면 재계약, 경질이면 첫 제안)
    const best = [...pc.offers].sort((a, b) => clubById(b.clubId).strength - clubById(a.clubId).strength)[0]
    const pick = pc.decision.kind === 'fired' ? pc.offers[0].clubId : best && clubById(best.clubId).strength > clubById(s.userClubId!).strength ? best.clubId : null
    s = finishSeason(s, pick)
  }
  firstEuro.push(euro)
  firstWin.push(win)
  maxRep.push(Math.round(s.manager!.reputation))
  if (g === 0) example = log
  void userLeagueId
}
const reached = (a: number[]) => a.filter((x) => x > 0)
const avg = (a: number[]) => (a.length ? (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : '-')
console.log(`시작 ${clubById(START).name} · ${GAMES}판 × ${SEASONS}시즌`)
console.log(`유럽 진출: ${reached(firstEuro).length}/${GAMES}판 (평균 ${avg(reached(firstEuro))}시즌째)`)
console.log(`챔피언스리그 우승: ${reached(firstWin).length}/${GAMES}판 (평균 ${avg(reached(firstWin))}시즌째)`)
console.log(`최종 명성 평균 ${avg(maxRep)}`)
console.log('\n예시 커리어:\n' + example.join('\n'))
