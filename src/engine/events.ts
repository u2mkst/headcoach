import type { Rng } from './rng'
import { clubById } from '../data/clubs'
import {
  abilityCheck,
  addMoraleAll,
  addTrust,
  findPlayer,
  fmtMoney,
  newId,
  pushFeed,
  pushTimeline,
  removePlayer,
  signed,
  userClub,
  type CheckTier,
} from './helpers'
import { josa } from './josa'
import { clamp, makePlayer, playerValue, SQUAD_MAX } from './squad'
import type { EventOutcome, EventType, GameState, PendingEvent, Position } from './types'

export interface EventChoice {
  id: string
  label: string
  hint: string
}
export interface EventView {
  title: string
  tag: string
  body: string
  choices: EventChoice[]
}

/** 유소년 기용 약속 기준: 21세 이하 선수 시즌 합산 출전 횟수 */
export const YOUTH_PROMISE_APPS = 40

export const EVENT_TAG: Record<EventType, string> = {
  press: '기자회견',
  complaint: '선수 불만',
  injury: '부상 처치',
  offer: '이적 제안',
  owner: '구단주 면담',
  prospect: '유망주',
  protest: '팬 항의',
  rival: '라이벌 도발',
  lockerroom: '라커룸 갈등',
}

/* ───────── 화면용 설명 (저장된 매개변수만으로 만든다) ───────── */

export function describeEvent(ev: PendingEvent): EventView {
  const p = ev.params
  const tag = EVENT_TAG[ev.type]
  switch (ev.type) {
    case 'press':
      return {
        tag,
        title: '경기 후 기자회견',
        body: String(p.summary),
        choices: [
          { id: 'confident', label: '자신감 있게 말한다', hint: '소통 능력이 높으면 분위기를 끌어올린다' },
          { id: 'humble', label: '겸손하게 말한다', hint: '무난하지만 큰 효과는 적다' },
          { id: 'blame', label: '심판과 일정 탓을 한다', hint: '선수단은 좋아하지만 구단주는 싫어한다' },
          { id: 'silent', label: '말을 아낀다', hint: '아무 일도 일어나지 않는다' },
        ],
      }
    case 'complaint':
      return {
        tag,
        title: `${p.name}의 면담 요청`,
        body: `${p.name}(${p.pos}, ${p.ovr}) 선수가 출전 기회가 적다며 찾아왔어요. 표정이 굳어 있습니다.`,
        choices: [
          { id: 'promise', label: '출전 기회를 약속한다', hint: '사기가 오르지만 지켜야 한다' },
          { id: 'prove', label: '훈련에서 증명하라고 한다', hint: '지도력에 따라 갈린다' },
          { id: 'ignore', label: '그냥 넘어간다', hint: '사기가 떨어진다' },
          { id: 'transfer', label: '이적을 허락한다', hint: '선수를 내보내고 이적료를 받는다' },
        ],
      }
    case 'injury':
      return {
        tag,
        title: `${p.name} 부상`,
        body: `${p.name}(${p.pos}, ${p.ovr}) 선수가 ${p.rounds}라운드 결장이 예상돼요. 의무팀이 복귀 방식을 물어봅니다.`,
        choices: [
          { id: 'rest', label: '충분히 쉬게 한다', hint: '정상 복귀. 안전하다' },
          { id: 'rehab', label: '집중 재활을 맡긴다 (-2억)', hint: '복귀가 한 라운드 빨라진다' },
          { id: 'rush', label: '무리해서 빨리 복귀시킨다', hint: '복귀는 빠르지만 다음 시즌 기량이 떨어진다' },
        ],
      }
    case 'offer':
      return {
        tag,
        title: `${p.club}의 이적 제안`,
        body: `${josa(p.club, '이/가')} ${p.name}(${p.pos}, ${p.ovr}) 선수에게 ${fmtMoney(Number(p.price))}을 제시했어요.`,
        choices: [
          { id: 'accept', label: `수락한다 (+${fmtMoney(Number(p.price))})`, hint: '선수를 보내고 이적료를 받는다' },
          { id: 'negotiate', label: '더 높은 금액을 요구한다', hint: '협상 능력에 따라 금액이 오르거나 제안이 철회된다' },
          { id: 'refuse', label: '거절한다', hint: '선수는 남지만 마음이 흔들릴 수 있다' },
        ],
      }
    case 'owner':
      return {
        tag,
        title: '구단주의 호출',
        body: `구단주가 이번 시즌 계획을 물어요. 현재 목표는 ${p.target}위 이내입니다. 믿음을 얻을 약속이 필요해 보입니다.`,
        choices: [
          { id: 'youth', label: '유소년 기용을 약속한다', hint: '시즌 끝에 21세 이하 출전 횟수를 점검한다' },
          { id: 'finance', label: '재정 안정을 약속한다', hint: '시즌 끝에 예산이 줄지 않았는지 점검한다' },
          { id: 'target', label: '목표를 한 단계 올린다', hint: '믿음이 크게 오르지만 기대도 커진다' },
          { id: 'asis', label: '지금 목표를 유지한다', hint: '협상 능력에 따라 지원금을 얻는다' },
        ],
      }
    case 'prospect':
      return {
        tag,
        title: `유소년 유망주 ${p.name}`,
        body: `${p.name}(${p.pos}, ${p.age}세) 유망주가 유소년팀에서 눈에 띄어요. 현재 ${p.ovr}, 잠재력은 ${p.pot}까지 보입니다.`,
        choices: [
          { id: 'promote', label: '1군에 등록한다', hint: '선수단에 합류시킨다' },
          { id: 'sell', label: '이적료를 받고 보낸다 (+3억)', hint: '재정에 보탬이 된다' },
          { id: 'hold', label: '더 지켜본다', hint: '지금은 아무 일도 일어나지 않는다' },
        ],
      }
    case 'protest':
      return {
        tag,
        title: '팬들이 항의하고 있어요',
        body: '승리가 없는 경기가 이어지자 경기장 앞에 팬들이 모였습니다. 현수막이 눈에 띕니다.',
        choices: [
          { id: 'apologize', label: '공개적으로 사과한다', hint: '소통 능력에 따라 여론이 바뀐다' },
          { id: 'defend', label: '선수단을 감싼다', hint: '선수 사기는 오르지만 구단주 눈치를 본다' },
          { id: 'rebuild', label: '전술을 다시 짜겠다고 말한다', hint: '구단주는 반기지만 약속이 된다' },
        ],
      }
    case 'rival':
      return {
        tag,
        title: `${p.rivalName} 감독의 도발`,
        body: `${p.rivalName} 감독이 인터뷰에서 우리 팀을 두고 "운이 좋았을 뿐"이라고 했어요.`,
        choices: [
          { id: 'ignore', label: '대꾸하지 않는다', hint: '아무 일도 일어나지 않는다' },
          { id: 'reply', label: '단호하게 응수한다', hint: '소통 능력에 따라 선수단이 뭉치거나 역풍이 분다' },
          { id: 'joke', label: '유머로 받아친다', hint: '잘 통하면 구단주와 팬이 좋아한다' },
        ],
      }
    case 'lockerroom':
      return {
        tag,
        title: '라커룸 갈등',
        body: `${josa(p.a, '과/와')} ${josa(p.b, '이/가')} 훈련 중 언성을 높였어요. 다른 선수들도 눈치를 보고 있습니다.`,
        choices: [
          { id: 'mediate', label: '둘을 불러 직접 중재한다', hint: '지도력이 높으면 오히려 더 단단해진다' },
          { id: 'discipline', label: '둘 다 엄하게 꾸짖는다', hint: '분위기는 가라앉지만 확실하다' },
          { id: 'sideline', label: '한 명을 한동안 제외한다', hint: '벤치로 밀린 선수의 사기가 크게 떨어진다' },
        ],
      }
  }
}

/* ───────── 생성 ───────── */

export function pendingEvent(s: GameState, type: EventType, params: PendingEvent['params']): PendingEvent {
  return { uid: newId(s, 'e'), type, createdRound: s.round, season: s.season, params }
}

const has = (s: GameState, type: EventType, key?: string, val?: string | number) =>
  s.events.some((e) => e.type === type && (key === undefined || e.params[key] === val))

export interface RollContext {
  /** 라운드 시작 전 부상 중이던 선수 id */
  injuredBefore: Set<string>
  summary: string
  userRank: number
  recentNoWin: boolean
}

/** 라운드가 끝난 뒤 새 이벤트를 굴린다. 한 번에 최대 2개, 대기 중 최대 4개. */
export function rollEvents(s: GameState, rng: Rng, ctx: RollContext): PendingEvent[] {
  const club = userClub(s)
  const created: PendingEvent[] = []
  const room = () => created.length < 2 && s.events.length + created.length < 4
  const add = (type: EventType, params: PendingEvent['params']) => {
    if (room()) created.push(pendingEvent(s, type, params))
  }

  // 1) 부상 처치 — 새로 다친 주요 선수
  for (const p of club.squad) {
    if (p.injuredRounds >= 3 && p.ovr >= 62 && !ctx.injuredBefore.has(p.id) && !has(s, 'injury', 'playerId', p.id)) {
      add('injury', { playerId: p.id, name: p.name, pos: p.pos, ovr: p.ovr, rounds: p.injuredRounds })
      break
    }
  }

  // 2) 구단주 면담 — 6라운드 고정, 12라운드는 믿음이 낮을 때
  if (!has(s, 'owner')) {
    if (s.round === 6 || (s.round === 12 && s.ownerTrust < 45)) add('owner', { target: s.targetRank })
  }

  // 3) 팬 항의
  if (ctx.recentNoWin && !has(s, 'protest') && rng.chance(0.7)) add('protest', {})

  // 4) 선수 불만
  const unhappy = club.squad
    .filter((p) => p.injuredRounds === 0 && ((p.benchStreak >= 3 && p.ovr >= 66 && p.morale < 60) || p.morale < 35))
    .sort((a, b) => a.morale - b.morale)[0]
  if (unhappy && !has(s, 'complaint', 'playerId', unhappy.id) && rng.chance(0.55)) {
    add('complaint', { playerId: unhappy.id, name: unhappy.name, pos: unhappy.pos, ovr: unhappy.ovr })
  }

  // 5) 이적 제안
  if (s.round >= 3 && s.round <= 15 && rng.chance(0.12) && !has(s, 'offer')) {
    const stars = [...club.squad].sort((a, b) => b.ovr - a.ovr).slice(0, 8).filter((p) => p.age <= 31)
    if (stars.length) {
      const p = rng.pick(stars)
      const others = Object.keys(s.clubs).filter((id) => id !== s.userClubId)
      const bidder = clubById(rng.pick(others))
      const price = Math.round(playerValue(p) * rng.range(0.95, 1.3) * 10) / 10
      add('offer', { playerId: p.id, name: p.name, pos: p.pos, ovr: p.ovr, club: bidder.name, price })
    }
  }

  // 6) 유망주
  if (s.round >= 3 && rng.chance(0.09) && !has(s, 'prospect') && club.squad.length < SQUAD_MAX - 1) {
    const pos = rng.pick(['DF', 'MF', 'FW'] as Position[])
    const kid = makePlayer(rng, 0, pos, 66, { youth: true })
    kid.pot = clamp(kid.pot + 4 + Math.round((s.manager?.abilities.youth ?? 5) / 2), 60, 92)
    add('prospect', { name: kid.name, pos, age: kid.age, ovr: kid.ovr, pot: kid.pot })
  }

  // 7) 라이벌 도발
  if (rng.chance(0.06) && !has(s, 'rival')) {
    const others = Object.keys(s.clubs).filter((id) => id !== s.userClubId)
    add('rival', { rivalName: clubById(rng.pick(others)).short })
  }

  // 8) 라커룸 갈등
  const avgMorale = club.squad.reduce((a, p) => a + p.morale, 0) / Math.max(1, club.squad.length)
  if (rng.chance(avgMorale < 55 ? 0.1 : 0.03) && !has(s, 'lockerroom') && club.squad.length >= 2) {
    const [a, b] = rng.shuffle(club.squad).slice(0, 2)
    add('lockerroom', { aId: a.id, bId: b.id, a: a.name, b: b.name })
  }

  // 9) 기자회견 — 가장 흔한 이벤트
  if (rng.chance(0.3) && !has(s, 'press')) add('press', { summary: ctx.summary })

  return created
}

/* ───────── 결과 처리 ───────── */

type Fx = string[]
interface Res {
  text: string
  tone: EventOutcome['tone']
  fx: Fx
}

const tierPick = <T,>(tier: CheckTier, great: T, ok: T, bad: T): T => (tier === 'great' ? great : tier === 'ok' ? ok : bad)

export function resolveEvent(s: GameState, rng: Rng, uid: string, choiceId: string): EventOutcome {
  const idx = s.events.findIndex((e) => e.uid === uid)
  if (idx < 0) throw new Error('이벤트를 찾을 수 없어요')
  const ev = s.events[idx]
  s.events.splice(idx, 1)
  const view = describeEvent(ev)
  const choice = view.choices.find((c) => c.id === choiceId)
  if (!choice) throw new Error('선택지를 찾을 수 없어요')
  const res = handlers[ev.type](s, rng, ev, choiceId)
  const outcome: EventOutcome = {
    uid: ev.uid,
    type: ev.type,
    title: view.title,
    choiceLabel: choice.label.replace(/\s*\(.*\)$/, ''),
    text: res.text,
    effects: res.fx,
    tone: res.tone,
  }
  s.eventLog.push(outcome)
  if (s.eventLog.length > 60) s.eventLog.shift()
  pushTimeline(s, 'event', `${view.tag} · ${view.title} — ${outcome.choiceLabel}`)
  return outcome
}

/** 선택하지 않고 기한이 지난 이벤트: 가장 소극적인 결과로 처리 */
export function expireEvents(s: GameState, rng: Rng, maxAge = 3): EventOutcome[] {
  const outs: EventOutcome[] = []
  for (const ev of [...s.events]) {
    if (s.season !== ev.season || s.round - ev.createdRound >= maxAge) {
      const passive: Record<EventType, string> = {
        press: 'silent',
        complaint: 'ignore',
        injury: 'rest',
        offer: 'refuse',
        owner: 'asis',
        prospect: 'hold',
        protest: 'defend',
        rival: 'ignore',
        lockerroom: 'discipline',
      }
      outs.push(resolveEvent(s, rng, ev.uid, passive[ev.type]))
    }
  }
  return outs
}

const handlers: Record<EventType, (s: GameState, rng: Rng, ev: PendingEvent, c: string) => Res> = {
  press(s, rng, ev, c) {
    const tier = abilityCheck(s, rng, 'communication')
    const fx: Fx = []
    let text = ''
    let tone: Res['tone'] = 'neutral'
    const trust = (n: number) => {
      addTrust(s, n)
      if (n) fx.push(`구단주 신뢰 ${signed(n)}`)
    }
    const morale = (n: number) => {
      addMoraleAll(s, n)
      if (n) fx.push(`선수단 사기 ${signed(n)}`)
    }
    if (c === 'confident') {
      const [t, m] = tierPick(tier, [3, 3], [1, 1], [-3, -2])
      trust(t)
      morale(m)
      text = tierPick(tier, '기자들이 고개를 끄덕였어요. 자신감 있는 한마디가 헤드라인이 됐습니다.', '무난한 인터뷰였어요. 큰 화제는 없었습니다.', '말이 앞서 보였다는 평가가 나와요. 부담만 커졌습니다.')
      tone = tierPick(tier, 'good', 'neutral', 'bad')
    } else if (c === 'humble') {
      const t = tierPick(tier, 3, 1, 0)
      trust(t)
      morale(1)
      text = tierPick(tier, '차분한 태도가 호평을 받았어요.', '겸손한 답변에 기자실이 조용히 끝났습니다.', '너무 몸을 낮춘다는 반응도 있었어요.')
      tone = tierPick(tier, 'good', 'neutral', 'neutral')
    } else if (c === 'blame') {
      morale(2)
      trust(tierPick(tier, -1, -3, -5))
      text = '선수들은 감독이 자기들 편이라며 속이 시원하다고 해요. 하지만 구단 안팎에선 말이 나옵니다.'
      tone = 'bad'
    } else {
      text = '짧게 답하고 자리를 떴어요. 아무 일도 일어나지 않았습니다.'
    }
    pushFeed(s, { kind: 'press', source: '기자회견', mood: tone === 'good' ? 'good' : tone === 'bad' ? 'bad' : 'neutral', text: `${String(ev.params.summary)} → ${text}` })
    return { text, tone, fx }
  },

  complaint(s, rng, ev, c) {
    const p = findPlayer(s, ev.params.playerId)
    if (!p) return { text: '그 사이 선수는 팀을 떠났어요.', tone: 'neutral', fx: [] }
    const fx: Fx = []
    const tier = abilityCheck(s, rng, 'leadership')
    if (c === 'promise') {
      const d = tierPick(tier, 16, 12, 8)
      p.morale = clamp(p.morale + d, 10, 100)
      p.benchStreak = 0
      fx.push(`${p.name} 사기 ${signed(d)}`)
      return { text: `${josa(p.name, '은/는')} 믿고 기다려 보겠다고 했어요. 약속은 지켜야 합니다.`, tone: 'good', fx }
    }
    if (c === 'prove') {
      if (tier === 'bad') {
        p.morale = clamp(p.morale - 8, 10, 100)
        fx.push(`${p.name} 사기 -8`)
        return { text: `${josa(p.name, '은/는')} 말없이 고개를 숙였지만 눈빛이 식었어요.`, tone: 'bad', fx }
      }
      const d = tier === 'great' ? 12 : 6
      p.morale = clamp(p.morale + d, 10, 100)
      fx.push(`${p.name} 사기 ${signed(d)}`)
      return { text: `${josa(p.name, '은/는')} 훈련에서 보여주겠다며 의욕을 불태워요.`, tone: tier === 'great' ? 'good' : 'neutral', fx }
    }
    if (c === 'ignore') {
      p.morale = clamp(p.morale - 8, 10, 100)
      addTrust(s, -1)
      fx.push(`${p.name} 사기 -8`, '구단주 신뢰 -1')
      return { text: '대화 없이 지나갔어요. 선수의 표정이 더 어두워졌습니다.', tone: 'bad', fx }
    }
    // transfer
    const price = Math.round(playerValue(p) * 0.8 * 10) / 10
    removePlayer(s, p.id)
    userClub(s).budget += price
    addMoraleAll(s, -1)
    fx.push(`이적료 +${fmtMoney(price)}`, '선수단 사기 -1')
    return { text: `${p.name}의 이적을 허락했어요. 이적료 ${fmtMoney(price)}이 들어옵니다.`, tone: 'neutral', fx }
  },

  injury(s, _rng, ev, c) {
    const p = findPlayer(s, ev.params.playerId)
    if (!p || p.injuredRounds <= 0) return { text: '선수는 이미 회복했어요.', tone: 'neutral', fx: [] }
    const fx: Fx = []
    if (c === 'rest') {
      return { text: `${josa(p.name, '은/는')} 충분히 치료받으며 정상 복귀를 준비해요.`, tone: 'neutral', fx }
    }
    if (c === 'rehab') {
      userClub(s).budget -= 2
      p.injuredRounds = Math.max(1, p.injuredRounds - 1)
      fx.push('예산 -2억', `복귀 ${p.injuredRounds}라운드 후`)
      return { text: `재활 전문가가 붙었어요. ${p.name}의 복귀가 앞당겨집니다.`, tone: 'good', fx }
    }
    p.injuredRounds = Math.max(1, Math.ceil(p.injuredRounds / 2))
    p.pushedReturn = true
    fx.push(`복귀 ${p.injuredRounds}라운드 후`, '다음 시즌 기량 하락 위험')
    return { text: `${josa(p.name, '이/가')} 서둘러 돌아옵니다. 의무팀은 표정이 좋지 않아요. 무리한 복귀의 대가는 다음 시즌에 나타날 수 있습니다.`, tone: 'bad', fx }
  },

  offer(s, rng, ev, c) {
    const p = findPlayer(s, ev.params.playerId)
    if (!p) return { text: '선수는 이미 팀을 떠났어요.', tone: 'neutral', fx: [] }
    const fx: Fx = []
    const price = Number(ev.params.price)
    const sell = (amount: number) => {
      removePlayer(s, p.id)
      userClub(s).budget += amount
      addMoraleAll(s, -1)
      fx.push(`이적료 +${fmtMoney(amount)}`, '선수단 사기 -1')
    }
    if (c === 'accept') {
      sell(price)
      return { text: `${josa(p.name, '을/를')} ${josa(ev.params.club, '으로/로')} 보냈어요.`, tone: 'neutral', fx }
    }
    if (c === 'negotiate') {
      const tier = abilityCheck(s, rng, 'negotiation')
      if (tier === 'bad') {
        p.morale = clamp(p.morale - 3, 10, 100)
        fx.push(`${p.name} 사기 -3`)
        return { text: `${josa(ev.params.club, '은/는')} 제안을 거둬들였어요. 선수는 기회를 놓쳤다고 느낍니다.`, tone: 'bad', fx }
      }
      const amount = Math.round(price * (tier === 'great' ? 1.4 : 1.15) * 10) / 10
      sell(amount)
      return { text: `협상 끝에 ${fmtMoney(amount)}에 합의했어요.`, tone: tier === 'great' ? 'good' : 'neutral', fx }
    }
    p.morale = clamp(p.morale - 3, 10, 100)
    fx.push(`${p.name} 사기 -3`)
    return { text: `${josa(p.name, '은/는')} 팀에 남습니다. 다만 마음은 조금 흔들렸어요.`, tone: 'neutral', fx }
  },

  owner(s, rng, _ev, c) {
    const fx: Fx = []
    if (c === 'youth') {
      const thr = YOUTH_PROMISE_APPS
      s.promises = s.promises.filter((p) => !(p.type === 'youth' && p.season === s.season))
      s.promises.push({ type: 'youth', season: s.season, threshold: thr })
      addTrust(s, 4)
      fx.push('구단주 신뢰 +4', `약속: 21세 이하 선수 ${thr}회 출전`)
      return { text: '구단주가 환하게 웃었어요. 시즌이 끝나면 약속을 확인하겠다고 합니다.', tone: 'good', fx }
    }
    if (c === 'finance') {
      s.promises = s.promises.filter((p) => !(p.type === 'finance' && p.season === s.season))
      s.promises.push({ type: 'finance', season: s.season, threshold: Math.round(s.seasonStartBudget) })
      addTrust(s, 4)
      fx.push('구단주 신뢰 +4', `약속: 시즌 끝 예산 ${fmtMoney(s.seasonStartBudget)} 이상`)
      return { text: '구단주가 고개를 끄덕여요. 지갑을 아껴 달라는 당부가 이어졌습니다.', tone: 'good', fx }
    }
    if (c === 'target') {
      const before = s.targetRank
      s.targetRank = Math.max(1, s.targetRank - 1)
      addTrust(s, 6)
      fx.push('구단주 신뢰 +6', `목표 ${before}위 → ${s.targetRank}위 이내`)
      return { text: '구단주의 눈이 반짝였어요. 기대가 한 단계 올라갔습니다.', tone: 'good', fx }
    }
    const tier = abilityCheck(s, rng, 'negotiation')
    if (tier === 'great') {
      userClub(s).budget += 5
      fx.push('지원금 +5억')
      return { text: '협상 끝에 추가 지원금을 얻어냈어요.', tone: 'good', fx }
    }
    return { text: '목표는 그대로예요. 별다른 변화 없이 면담이 끝났어요.', tone: 'neutral', fx }
  },

  prospect(s, rng, ev, c) {
    const fx: Fx = []
    if (c === 'promote') {
      const club = userClub(s)
      if (club.squad.length >= SQUAD_MAX) return { text: '선수단이 가득 차서 등록하지 못했어요.', tone: 'neutral', fx }
      const kid = makePlayer(rng, 0, ev.params.pos as Position, 66, { youth: true, age: Number(ev.params.age) })
      kid.id = newId(s, 'p')
      kid.name = String(ev.params.name)
      kid.ovr = Number(ev.params.ovr)
      kid.pot = Number(ev.params.pot)
      kid.academy = true
      kid.contractYears = 3
      club.squad.push(kid)
      fx.push(`${kid.name} 1군 등록`)
      return { text: `${josa(kid.name, '이/가')} 1군에 합류했어요. 첫 훈련부터 눈빛이 달라요.`, tone: 'good', fx }
    }
    if (c === 'sell') {
      userClub(s).budget += 3
      fx.push('이적료 +3억')
      return { text: '유망주를 내보내고 이적료를 받았어요.', tone: 'neutral', fx }
    }
    return { text: '조금 더 지켜보기로 했어요.', tone: 'neutral', fx }
  },

  protest(s, rng, _ev, c) {
    const fx: Fx = []
    if (c === 'apologize') {
      const tier = abilityCheck(s, rng, 'communication')
      if (tier === 'bad') {
        addTrust(s, -1)
        fx.push('구단주 신뢰 -1')
        return { text: '사과는 했지만 진심이 닿지 않았다는 반응이에요.', tone: 'bad', fx }
      }
      const d = tier === 'great' ? 3 : 1
      addTrust(s, d)
      fx.push(`구단주 신뢰 +${d}`)
      return { text: '팬들 앞에서 고개를 숙이자 분위기가 조금 누그러졌어요.', tone: tier === 'great' ? 'good' : 'neutral', fx }
    }
    if (c === 'defend') {
      addMoraleAll(s, 3)
      addTrust(s, -2)
      fx.push('선수단 사기 +3', '구단주 신뢰 -2')
      return { text: '선수들은 감독이 방패가 되어 줬다며 고마워해요.', tone: 'neutral', fx }
    }
    addTrust(s, 2)
    s.tacticMemory = { ...s.tacticMemory, streak: 0 }
    fx.push('구단주 신뢰 +2', '전술 노출 초기화')
    return { text: '전술을 다시 짜겠다고 약속했어요. 이제 결과로 보여줘야 합니다.', tone: 'good', fx }
  },

  rival(s, rng, ev, c) {
    const fx: Fx = []
    if (c === 'ignore') return { text: '대꾸하지 않았어요. 소란은 금세 가라앉았습니다.', tone: 'neutral', fx }
    const tier = abilityCheck(s, rng, 'communication', c === 'joke' ? -0.04 : 0)
    if (c === 'reply') {
      if (tier === 'bad') {
        addTrust(s, -3)
        fx.push('구단주 신뢰 -3')
        return { text: `응수가 과열됐어요. ${ev.params.rivalName}와의 신경전이 더 커졌습니다.`, tone: 'bad', fx }
      }
      const d = tier === 'great' ? 4 : 2
      addMoraleAll(s, d)
      fx.push(`선수단 사기 +${d}`)
      return { text: '단호한 한마디에 선수단이 불타올라요.', tone: tier === 'great' ? 'good' : 'neutral', fx }
    }
    if (tier === 'bad') {
      fx.push('분위기 어색함')
      return { text: '농담이 통하지 않았어요. 어색한 웃음만 남았습니다.', tone: 'neutral', fx }
    }
    const t = tier === 'great' ? 3 : 1
    addTrust(s, t)
    fx.push(`구단주 신뢰 +${t}`)
    return { text: '재치 있는 대답이 화제가 됐어요. 팬들이 좋아합니다.', tone: 'good', fx }
  },

  lockerroom(s, rng, ev, c) {
    const a = findPlayer(s, ev.params.aId)
    const b = findPlayer(s, ev.params.bId)
    const fx: Fx = []
    if (!a || !b) return { text: '갈등은 저절로 사라졌어요.', tone: 'neutral', fx }
    if (c === 'mediate') {
      const tier = abilityCheck(s, rng, 'leadership')
      if (tier === 'bad') {
        a.morale = clamp(a.morale - 4, 10, 100)
        b.morale = clamp(b.morale - 4, 10, 100)
        fx.push('두 선수 사기 -4')
        return { text: '중재는 어긋났어요. 둘 사이의 골이 더 깊어졌습니다.', tone: 'bad', fx }
      }
      const d = tier === 'great' ? 6 : 2
      a.morale = clamp(a.morale + d, 10, 100)
      b.morale = clamp(b.morale + d, 10, 100)
      if (tier === 'great') addMoraleAll(s, 2)
      fx.push(`두 선수 사기 +${d}`)
      return { text: tier === 'great' ? '서로 사과하고 어깨동무까지 했어요. 팀이 한층 단단해졌습니다.' : '일단 화해했어요. 불씨는 남아 있습니다.', tone: tier === 'great' ? 'good' : 'neutral', fx }
    }
    if (c === 'discipline') {
      a.morale = clamp(a.morale - 3, 10, 100)
      b.morale = clamp(b.morale - 3, 10, 100)
      fx.push('두 선수 사기 -3')
      return { text: '둘 다 군기가 바짝 들었어요. 분위기는 조용해졌습니다.', tone: 'neutral', fx }
    }
    const weaker = a.ovr <= b.ovr ? a : b
    weaker.morale = clamp(weaker.morale - 10, 10, 100)
    weaker.benchStreak += 2
    fx.push(`${weaker.name} 사기 -10`)
    return { text: `${josa(weaker.name, '은/는')} 한동안 훈련에서 제외돼요. 라커룸이 숨죽였습니다.`, tone: 'bad', fx }
  },
}
