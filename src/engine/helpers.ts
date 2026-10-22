import type { Rng } from './rng'
import { clamp } from './squad'
import type { AbilityKey, ClubSim, FeedItem, GameState, Player, TimelineItem } from './types'

export const userClub = (s: GameState): ClubSim => s.clubs[s.userClubId as string]

export function newId(s: GameState, prefix = 'x'): string {
  s.nextId += 1
  return `${prefix}${s.nextId}`
}

export function pushTimeline(s: GameState, kind: TimelineItem['kind'], text: string) {
  s.timeline.push({
    id: newId(s, 't'),
    season: s.season,
    round: s.round,
    clubId: s.userClubId as string,
    kind,
    text,
  })
}

export function pushFeed(s: GameState, item: Omit<FeedItem, 'id' | 'season' | 'round'>) {
  s.feed.push({ id: newId(s, 'f'), season: s.season, round: s.round, ...item })
  if (s.feed.length > 80) s.feed.splice(0, s.feed.length - 80)
}

export const addTrust = (s: GameState, n: number) => {
  s.ownerTrust = clamp(s.ownerTrust + n, 0, 100)
}

export function addMoraleAll(s: GameState, n: number) {
  for (const p of userClub(s).squad) p.morale = clamp(p.morale + n, 10, 100)
}

export const findPlayer = (s: GameState, id: string | number): Player | undefined =>
  userClub(s).squad.find((p) => p.id === String(id))

export function removePlayer(s: GameState, id: string | number): Player | undefined {
  const squad = userClub(s).squad
  const i = squad.findIndex((p) => p.id === String(id))
  if (i < 0) return undefined
  const [p] = squad.splice(i, 1)
  if (s.manualLineup) s.manualLineup = s.manualLineup.filter((x) => x !== p.id)
  return p
}

export type CheckTier = 'great' | 'ok' | 'bad'

/** 감독 능력치 판정: 능력치가 높을수록 좋은 결과가 나올 확률이 높다 */
export function abilityCheck(s: GameState, rng: Rng, key: AbilityKey, bias = 0): CheckTier {
  const ability = s.manager?.abilities[key] ?? 5
  const score = ability * 0.07 + (rng.next() - 0.5) * 0.6 + bias
  return score > 0.62 ? 'great' : score > 0.3 ? 'ok' : 'bad'
}

export const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`)
export const fmtMoney = (n: number) => `${Math.round(n * 10) / 10}억`
