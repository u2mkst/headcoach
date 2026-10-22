import type { Rng } from './rng'
import { clubById } from '../data/clubs'
import { pushFeed } from './helpers'
import { FOCUS_LABEL } from './reinforce'
import { MONTH_LABEL } from './season'
import type { FanTopic, GameState, MonthPlan, MonthReport, Standing } from './types'

const OUTLETS = ['스포츠 타임스', '풋볼 데일리', '킥오프 뉴스', '그라운드 리포트']
const NICKS = [
  '열혈서포터', '골대불운', '말없이응원', '전술분석가', '새벽직관러', '원정버스', '시즌권홀더',
  '치킨내기', '라인업장인', '응원단장', '동네축구팬', '북측응원석', '해트트릭소망', '무관중시절부터',
]

type Mood = 'good' | 'bad' | 'neutral'
interface Cand {
  topic: FanTopic
  mood: Mood
  text: string
  weight: number
}

const pick = <T,>(rng: Rng, arr: T[]) => arr[Math.floor(rng.next() * arr.length)]

/**
 * 한 달치 가상 기사와 팬 커뮤니티 글을 만든다. 모든 매체와 글은 가상이다.
 * 커뮤니티 글은 이번 달 결과·전술·보강 선택·현재 지지도에 맞는 주제로 뽑힌다.
 * 반환값은 보고 화면에 보여줄 베스트 글이다.
 */
export function generateMonthMedia(
  s: GameState,
  rng: Rng,
  rep: MonthReport,
  standings: Standing[],
  plan: MonthPlan | null,
  planApplied: boolean,
): MonthReport['highlights'] {
  const uid = s.userClubId as string
  const me = clubById(uid).short
  const mgr = s.manager?.name ?? '감독'
  const m = MONTH_LABEL[rep.month - 1]
  const rank = rep.rankAfter
  const phil = s.tactics.philosophy
  const streak = s.tacticMemory.streak
  const support = s.fan.support

  /* ── 기사 ── */
  const net = rep.w - rep.l
  let headline: string
  let mood: Mood
  if (rep.w === 3) {
    headline = `${me}, ${m} 전승… 순위 ${rank}위로 도약`
    mood = 'good'
  } else if (rep.l === 3) {
    headline = `${me}, ${m} 3연패 늪… ${mgr} 감독 경질론 고개`
    mood = 'bad'
  } else if (net > 0) {
    headline = `${me}, ${m} ${rep.w}승 ${rep.d}무 ${rep.l}패로 분위기 반등… ${rank}위`
    mood = 'good'
  } else if (net < 0) {
    headline = `${me}, ${m} ${rep.w}승 ${rep.d}무 ${rep.l}패 부진… ${mgr} 감독 "변화 필요"`
    mood = 'bad'
  } else {
    headline = `${me}, ${m} ${rep.w}승 ${rep.d}무 ${rep.l}패로 제자리걸음… ${rank}위`
    mood = 'neutral'
  }
  pushFeed(s, { kind: 'article', source: pick(rng, OUTLETS), text: headline, mood })

  const leader = standings[0]
  pushFeed(s, {
    kind: 'article',
    source: pick(rng, OUTLETS),
    text: `${clubById(leader.clubId).short}, ${s.round}라운드 현재 선두… 승점 ${leader.pts}점`,
    mood: 'neutral',
  })
  if (plan && planApplied && rep.planLine) {
    pushFeed(s, {
      kind: 'article',
      source: pick(rng, OUTLETS),
      text: `${me} ${m} 행보: ${FOCUS_LABEL[plan.focus]} — ${rep.planLine}`,
      mood: plan.focus === 'save' ? 'bad' : 'good',
    })
  }

  /* ── 커뮤니티 글 후보 ── */
  const c: Cand[] = []
  const add = (topic: FanTopic, mood: Mood, text: string, weight = 1) => c.push({ topic, mood, text, weight })

  if (rep.w >= 2) {
    add('성적', 'good', `${m}에만 ${rep.w}승! ${me} 이대로 쭉 가자`, 3)
    add('감독', 'good', `${mgr} 감독 이번 달은 점수 줄 만하다`, 2)
  }
  if (rep.l >= 2) {
    add('성적', 'bad', `${m}에만 ${rep.l}패… 이게 맞나`, 3)
    add('감독', 'bad', `${mgr} 감독, 이제 변화가 필요하지 않나요`, 2)
  }
  if (rep.w < 2 && rep.l < 2) add('성적', 'neutral', '들쭉날쭉하다. 한 달 더 지켜보자', 2)
  if (rank <= 3) add('성적', 'good', '이 페이스면 우승 경쟁도 가능하겠다', 2)
  if (rank >= 9) add('성적', 'bad', '순위표 아래쪽이 익숙해지는 게 제일 무섭다', 3)

  if (rep.gf >= 6) add('전술', 'good', '골이 터지니 보는 맛이 있다', 3)
  if (rep.ga >= 6) add('전술', 'bad', '수비가 너무 불안하다. 라인 좀 정리해라', 3)
  if (rep.gf <= 1) add('전술', 'bad', '한 달 내내 골이 없다. 공격 전술이 문제 같다', 3)
  if (phil === 'attack') add('전술', rep.w >= 2 ? 'good' : 'bad', rep.w >= 2 ? '공격 축구 믿고 간다' : '공격만 외치다 뒷문이 열린다', 2)
  if (phil === 'defense') add('전술', rep.w >= 2 ? 'good' : 'bad', rep.w >= 2 ? '지키는 축구도 이기면 예술이다' : '지키기만 하다 지는 건 최악', 2)
  if (phil === 'possession') add('전술', rep.gf >= 4 ? 'good' : 'bad', rep.gf >= 4 ? '점유하면서 골까지 넣으니 좋다' : '점유율만 높고 골이 없다', 2)
  if (phil === 'counter') add('전술', rep.w >= 2 ? 'good' : 'neutral', rep.w >= 2 ? '역습 한 방이 시원하다' : '역습이 번번이 막힌다', 2)
  if (streak >= 5) add('전술', 'bad', `같은 전술이 ${streak}경기째… 상대가 다 읽는다`, 4)
  if (s.tacticMemory.familiarity < 20 && s.round > 3) add('전술', 'neutral', '전술이 자주 바뀌어서 선수들이 적응하기 힘들어 보인다', 2)

  if (plan && planApplied) {
    if (plan.focus === 'save') add('보강', 'bad', '이번 달도 지갑을 닫았다. 투자 좀 하자', 3)
    else if (plan.focus === 'youth') add('보강', 'good', '유소년 투자는 응원! 장기적으로 이게 맞다', 2)
    else if (plan.focus === 'fitness') add('보강', 'neutral', '컨디션 관리에 신경 쓰는 모양이다', 1)
    else add('보강', 'good', `${FOCUS_LABEL[plan.focus]} 소식 반갑다. 이제 달라지겠지`, 3)
  } else {
    add('보강', 'neutral', `${m}은 보강 소식이 한 줄도 없네`, 1)
  }

  if (support >= 70) add('감독', 'good', `${mgr} 감독 재계약 청원합니다`, 2)
  if (support <= 30) add('감독', 'bad', '감독 교체 여론이 커지고 있다', 3)

  // 가중치로 6개를 뽑는다 (중복 없이)
  const chosen: Cand[] = []
  const pool = [...c]
  while (chosen.length < 6 && pool.length) {
    const x = rng.weighted(pool, (p) => p.weight)
    chosen.push(x)
    pool.splice(pool.indexOf(x), 1)
  }
  const nicks = rng.shuffle(NICKS)
  const posts = chosen.map((x, i) => ({
    ...x,
    nick: nicks[i % nicks.length],
    likes: rng.int(3, 40) + x.weight * rng.int(5, 30),
  }))
  for (const p of posts) {
    pushFeed(s, { kind: 'fan', source: p.nick, text: p.text, mood: p.mood, topic: p.topic, likes: p.likes })
  }

  return [...posts]
    .sort((a, b) => b.likes - a.likes)
    .slice(0, 3)
    .map((p) => ({ nick: p.nick, text: p.text, likes: p.likes, mood: p.mood }))
}
