import { chooseCoach, chooseOffer, createManager, newGame, startSeason } from '../src/engine/game'
import type { GameState } from '../src/engine/types'

/** 균형 잡힌 능력치의 감독으로 중위권 구단에서 시작하는 게임 */
export function startedGameFor(seed: number, clubId = 'club_005'): GameState {
  let s = newGame(seed)
  s = createManager(s, {
    name: '봇',
    nationality: '대한민국',
    style: 'tactician',
  })
  s = chooseOffer(s, clubId)
  s = chooseCoach(s, s.coachCandidates[0].id)
  return startSeason(s)
}
