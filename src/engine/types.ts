export type Position = 'GK' | 'DF' | 'MF' | 'FW'
export type Philosophy = 'attack' | 'possession' | 'defense' | 'counter'
export type Level = 'low' | 'mid' | 'high'
export type FormationId = '4-4-2' | '4-3-3' | '3-5-2' | '4-2-3-1' | '5-3-2'

export interface Tactics {
  philosophy: Philosophy
  formation: FormationId
  pressing: Level
  line: Level
}

export interface Player {
  id: string
  /** 등번호 (구단 안에서 유일, 시장 대기 중에는 0). 선수 이름은 두지 않는다 */
  no: number
  pos: Position
  age: number
  ovr: number
  pot: number
  /** 컨디션 0~100 */
  condition: number
  /** 사기 0~100 */
  morale: number
  injuredRounds: number
  /** 무리하게 복귀시킨 선수 — 다음 시즌 기량 하락 */
  pushedReturn: boolean
  contractYears: number
  /** 구단 유소년 출신 */
  academy: boolean
  seasonApps: number
  seasonGoals: number
  careerApps: number
  careerGoals: number
  /** 연속 결장 라운드 */
  benchStreak: number
}

export interface Abilities {
  tactics: number
  leadership: number
  communication: number
  youth: number
  negotiation: number
}
export type AbilityKey = keyof Abilities

export interface Manager {
  name: string
  nationality: string
  background: string
  abilities: Abilities
  reputation: number
}

export interface Coach {
  id: string
  name: string
  specialty: 'tactics' | 'fitness' | 'youth'
  rating: number
}

export interface ClubSim {
  id: string
  squad: Player[]
  philosophy: Philosophy
  formation: FormationId
  /** 구단 이름 기준 순위 계산용 (선수단 평균) */
  budget: number
}

export interface Fixture {
  home: string
  away: string
}

export interface Scorer {
  playerId: string
  clubId: string
  minute: number
}

export interface MatchResult {
  season: number
  round: number
  home: string
  away: string
  hg: number
  ag: number
  scorers: Scorer[]
  possession: number
  shotsHome: number
  shotsAway: number
}

export interface Offer {
  clubId: string
  targetRank: number
  patience: number
  budget: number
}

export interface PendingEvent {
  uid: string
  type: EventType
  createdRound: number
  season: number
  /** 이벤트별 매개변수 — 함수는 저장하지 않고 id만 둔다 */
  params: Record<string, string | number>
}

export type EventType =
  | 'press'
  | 'complaint'
  | 'injury'
  | 'offer'
  | 'owner'
  | 'prospect'
  | 'protest'
  | 'rival'
  | 'lockerroom'

export interface EventOutcome {
  uid: string
  type: EventType
  title: string
  choiceLabel: string
  text: string
  effects: string[]
  tone: 'good' | 'neutral' | 'bad'
}

export interface Promise_ {
  type: 'youth' | 'finance'
  season: number
  /** 약속 기준값: 유소년 = 21세 이하 출전 횟수 */
  threshold: number
}

export interface FeedItem {
  id: string
  kind: 'press' | 'article' | 'fan'
  season: number
  round: number
  source: string
  text: string
  mood?: 'good' | 'bad' | 'neutral'
}

export interface TimelineItem {
  id: string
  season: number
  round: number
  clubId: string
  kind: 'start' | 'result' | 'event' | 'season' | 'career'
  text: string
}

export type Outcome = 'champion' | 'exceeded' | 'achieved' | 'fell_short' | 'failed'

export interface SeasonSummary {
  season: number
  clubId: string
  rank: number
  targetRank: number
  points: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  outcome: Outcome
  achievements: string[]
  /** 성과 인정으로 평가가 한 단계 올랐는지 */
  upgraded: boolean
  promiseNotes: string[]
  budgetStart: number
  budgetEnd: number
}

export type CareerDecision =
  | { kind: 'renew' }
  | { kind: 'fired' }

export interface PendingCareer {
  decision: CareerDecision
  /** 경질이면 이 중에서 고르고, 재계약이면 선택적 이적 제안 */
  offers: Offer[]
  trustDelta: number
}

export type Phase =
  | 'create'
  | 'offers'
  | 'coach'
  | 'confirm'
  | 'play'
  | 'seasonEnd'

export interface Standing {
  clubId: string
  p: number
  w: number
  d: number
  l: number
  gf: number
  ga: number
  pts: number
}

export interface TacticMemory {
  /** 같은 설정을 연속으로 쓴 경기 수 */
  streak: number
  lastKey: string | null
  /** 철학 숙련도 0~100 */
  familiarity: number
  lastPhilosophy: Philosophy | null
}

export type Difficulty = 'easy' | 'normal' | 'hard'

export interface GameState {
  version: number
  rng: number
  difficulty: Difficulty
  phase: Phase
  manager: Manager | null
  userClubId: string | null
  coach: Coach | null
  offers: Offer[]
  coachCandidates: Coach[]
  season: number
  /** 끝난 라운드 수 (0~18) */
  round: number
  clubs: Record<string, ClubSim>
  fixtures: Fixture[][]
  results: MatchResult[]
  tactics: Tactics
  /** 선발 수동 지정 — null이면 자동 */
  manualLineup: string[] | null
  tacticMemory: TacticMemory
  ownerTrust: number
  targetRank: number
  seasonStartBudget: number
  events: PendingEvent[]
  eventLog: EventOutcome[]
  promises: Promise_[]
  /** 이번 시즌 하위권으로 내려갔던 적이 있는가 (위기 극복 판정) */
  wasInDanger: boolean
  feed: FeedItem[]
  timeline: TimelineItem[]
  seasons: SeasonSummary[]
  market: Player[]
  pendingCareer: PendingCareer | null
  /** 이번 라운드에서 방금 끝난 경기 결과 (결과 화면용) */
  lastRound: MatchResult[] | null
  retired: boolean
  /** 오프시즌 소식 (새 시즌 홈에서 한 번 보여주고 지운다) */
  offseasonReport: string[] | null
  nextId: number
}
