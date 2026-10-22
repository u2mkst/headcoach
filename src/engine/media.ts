import type { Rng } from './rng'
import { clubById } from '../data/clubs'
import { pushFeed } from './helpers'
import { josa } from './josa'
import type { GameState, MatchResult, Standing } from './types'

const OUTLETS = ['스포츠 타임스', '풋볼 데일리', '킥오프 뉴스', '그라운드 리포트']
const FANS = ['서포터즈 게시판', '팬 커뮤니티', '경기장 앞 팬', '원정 응원단']

const pick = <T,>(rng: Rng, arr: T[]) => arr[Math.floor(rng.next() * arr.length)]

/** 가상 기사·팬 반응을 만든다. 모든 문구는 가상의 매체·팬 반응이다. */
export function generateRoundMedia(
  s: GameState,
  rng: Rng,
  userResult: MatchResult,
  standings: Standing[],
  allResults: MatchResult[],
) {
  const uid = s.userClubId as string
  const me = clubById(uid).short
  const home = userResult.home === uid
  const oppId = home ? userResult.away : userResult.home
  const opp = clubById(oppId).short
  const gf = home ? userResult.hg : userResult.ag
  const ga = home ? userResult.ag : userResult.hg
  const margin = gf - ga
  const rank = standings.findIndex((x) => x.clubId === uid) + 1
  const mgr = s.manager?.name ?? '감독'
  const score = `${userResult.hg}-${userResult.ag}`
  const outlet = pick(rng, OUTLETS)

  let headline: string
  let mood: 'good' | 'bad' | 'neutral'
  if (margin >= 3) {
    headline = pick(rng, [
      `${me}, ${opp} 상대로 ${score} 대승… ${mgr} 감독 "준비한 대로 풀렸다"`,
      `폭발한 ${me}, ${josa(opp, '을/를')} ${score}로 완파`,
    ])
    mood = 'good'
  } else if (margin > 0) {
    headline = pick(rng, [
      `${me}, ${opp}에 ${score} 승리… 순위 ${rank}위로`,
      `${mgr} 감독의 ${me}, 접전 끝에 ${opp} 제압`,
    ])
    mood = 'good'
  } else if (margin === 0) {
    headline = pick(rng, [
      `${me}-${opp} ${score} 무승부, 승점 1점씩 나눠 가져`,
      `${me}, ${josa(opp, '과/와')} 팽팽한 승부 끝에 비겨`,
    ])
    mood = 'neutral'
  } else if (margin > -3) {
    headline = pick(rng, [
      `${me}, ${opp}에 ${score} 패배… ${mgr} 감독 고민 깊어져`,
      `아쉬운 ${me}, ${opp}에 무릎`,
    ])
    mood = 'bad'
  } else {
    headline = pick(rng, [
      `${me}, ${opp}에 ${score} 대패… 수비 조직력에 물음표`,
      `충격의 ${score} ${me}, ${opp} 상대로 무너졌다`,
    ])
    mood = 'bad'
  }
  pushFeed(s, { kind: 'article', source: outlet, text: headline, mood })

  // 리그 소식 한 줄
  const leader = standings[0]
  const league = pick(rng, [
    `${clubById(leader.clubId).short}, ${s.round}라운드 현재 선두… 승점 ${leader.pts}점`,
    standings.length > 1
      ? `${josa(clubById(standings[0].clubId).short, '과/와')} ${clubById(standings[1].clubId).short}의 선두 경쟁 이어져`
      : `리그 선두 경쟁 치열`,
  ])
  pushFeed(s, { kind: 'article', source: pick(rng, OUTLETS), text: league, mood: 'neutral' })

  const biggest = [...allResults].sort((a, b) => Math.abs(b.hg - b.ag) - Math.abs(a.hg - a.ag))[0]
  if (biggest && Math.abs(biggest.hg - biggest.ag) >= 3 && biggest !== userResult) {
    const w = biggest.hg > biggest.ag ? biggest.home : biggest.away
    const l = w === biggest.home ? biggest.away : biggest.home
    pushFeed(s, {
      kind: 'article',
      source: pick(rng, OUTLETS),
      text: `${clubById(w).short}, ${clubById(l).short}에 ${biggest.hg}-${biggest.ag} 승리… 이번 라운드 최다 득점 차`,
      mood: 'neutral',
    })
  }

  // 팬 반응
  const fanGood = [
    `오늘 경기 진짜 좋았다. ${mgr} 감독님 믿습니다`,
    `${me} 이대로만 가자!`,
    `이래서 축구장 못 끊는다. 다음 경기도 간다`,
  ]
  const fanBad = [
    `전술이 너무 뻔하다. 상대가 다 읽는 것 같은데…`,
    `${mgr} 감독, 이제 변화가 필요하지 않나요`,
    `오늘은 선수들도 지쳐 보였다. 로테이션 좀 합시다`,
  ]
  const fanMeh = [`무난한 경기였다. 다음 경기를 보자`, `승점 1점이라도 챙긴 걸로 만족`]
  const pool = mood === 'good' ? fanGood : mood === 'bad' ? fanBad : fanMeh
  pushFeed(s, { kind: 'fan', source: pick(rng, FANS), text: pick(rng, pool), mood })
  if ([4, 8, 12, 16].includes(s.tacticMemory.streak)) {
    pushFeed(s, {
      kind: 'fan',
      source: pick(rng, FANS),
      text: `같은 전술을 ${s.tacticMemory.streak}경기째 쓰고 있다. 상대가 대비하기 시작한 것 같다`,
      mood: 'bad',
    })
  }
}
