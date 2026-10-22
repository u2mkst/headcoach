/**
 * 구단·대회 데이터 — 이름, 색, 엠블럼 경로는 이 파일에서만 관리한다.
 * 가상 이름으로 바꿀 때는 이 파일과 public/assets 폴더만 교체하면 된다.
 * 실제 이름·엠블럼을 공개 배포하거나 수익화할 때는 라이선스 확인이 필요하다.
 */

export interface Competition {
  id: string
  name: string
  short: string
  level: number
  logo: string
}

export interface ClubData {
  id: string
  name: string
  short: string
  country: string
  league: string
  /** 전력 (엔진이 선수단 생성에 사용) */
  strength: number
  /** 기본 방패 색 */
  color: string
  /** 엠블럼 이미지 경로 (파일이 없어도 됨) */
  crest: string
}

export const COMPETITIONS: Competition[] = [
  { id: 'league_k1', name: 'K리그1', short: 'K1', level: 1, logo: '/assets/competitions/league_k1.png' },
]

export const LEAGUE_ID = 'league_k1'

const club = (n: number, name: string, short: string, strength: number, color: string): ClubData => {
  const id = `club_${String(n).padStart(3, '0')}`
  return { id, name, short, country: 'KR', league: LEAGUE_ID, strength, color, crest: `/assets/crests/${id}.png` }
}

export const CLUBS: ClubData[] = [
  club(1, '전북 현대 모터스', '전북', 76, '#1F7A3E'),
  club(2, '울산 HD', '울산', 78, '#1F5FAD'),
  club(3, '포항 스틸러스', '포항', 72, '#C8102E'),
  club(4, 'FC 서울', '서울', 71, '#B3282D'),
  club(5, '수원 삼성 블루윙즈', '수원', 68, '#2A4FB0'),
  club(6, '대구 FC', '대구', 65, '#4A9BD9'),
  club(7, '인천 유나이티드', '인천', 63, '#1D3C78'),
  club(8, '제주 SK FC', '제주', 66, '#F26B1D'),
  club(9, '강원 FC', '강원', 64, '#D9531E'),
  club(10, '광주 FC', '광주', 62, '#C99A00'),
]

export const clubById = (id: string): ClubData => {
  const c = CLUBS.find((x) => x.id === id)
  if (!c) throw new Error(`unknown club ${id}`)
  return c
}

export const competitionById = (id: string): Competition =>
  COMPETITIONS.find((c) => c.id === id) ?? COMPETITIONS[0]
