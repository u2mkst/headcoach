import { clubById } from '../data/clubs'
import { OUTCOME_LABEL } from '../engine/career'
import type { GameState } from '../engine/types'

export const CARD_W = 1080
export const CARD_H = 1350

export interface CareerTotals {
  seasons: number
  titles: number
  w: number
  d: number
  l: number
  bestRank: number
  clubs: { clubId: string; seasons: number; best: number }[]
}

export function careerTotals(state: GameState): CareerTotals {
  const by = new Map<string, { clubId: string; seasons: number; best: number }>()
  let w = 0
  let d = 0
  let l = 0
  let titles = 0
  let best = 99
  for (const s of state.seasons) {
    w += s.w
    d += s.d
    l += s.l
    if (s.outcome === 'champion') titles++
    best = Math.min(best, s.rank)
    const c = by.get(s.clubId) ?? { clubId: s.clubId, seasons: 0, best: 99 }
    c.seasons++
    c.best = Math.min(c.best, s.rank)
    by.set(s.clubId, c)
  }
  return { seasons: state.seasons.length, titles, w, d, l, bestRank: best === 99 ? 0 : best, clubs: [...by.values()] }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(img.naturalWidth > 0 ? img : null)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

async function drawCrest(ctx: CanvasRenderingContext2D, clubId: string, x: number, y: number, size: number) {
  const club = clubById(clubId)
  const img = await loadImage(club.crest)
  if (img) {
    ctx.drawImage(img, x, y, size, size)
    return
  }
  const s = size / 40
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(s, s)
  ctx.beginPath()
  ctx.moveTo(20, 2)
  ctx.lineTo(36, 7)
  ctx.lineTo(36, 19)
  ctx.bezierCurveTo(36, 28, 29.5, 34.5, 20, 38)
  ctx.bezierCurveTo(10.5, 34.5, 4, 28, 4, 19)
  ctx.lineTo(4, 7)
  ctx.closePath()
  ctx.fillStyle = club.color
  ctx.fill()
  ctx.fillStyle = '#fff'
  ctx.font = '800 16px Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(club.short.charAt(0), 20, 25.5)
  ctx.restore()
}

/** 은퇴 기념 공유 카드(1080×1350)를 그려 PNG 데이터 URL로 돌려준다 */
export async function renderShareCard(state: GameState): Promise<string> {
  const canvas = document.createElement('canvas')
  canvas.width = CARD_W
  canvas.height = CARD_H
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D
  const font = (w: number, px: number) => `${w} ${px}px Pretendard, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif`
  try {
    await document.fonts?.ready
  } catch {
    /* 폰트 준비를 기다리지 못해도 대체 글꼴로 그린다 */
  }

  const t = careerTotals(state)
  ctx.fillStyle = '#F2F4F6'
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // 메인 카드
  ctx.fillStyle = '#FFFFFF'
  roundRect(ctx, 60, 60, CARD_W - 120, CARD_H - 120, 48)
  ctx.fill()

  ctx.textAlign = 'left'
  ctx.fillStyle = '#6B7684'
  ctx.font = font(600, 30)
  ctx.fillText('벤치에서 명장까지', 120, 150)

  ctx.fillStyle = '#191F28'
  ctx.font = font(800, 84)
  ctx.fillText(`${state.manager?.name ?? ''} 감독`, 120, 260)
  ctx.fillStyle = '#6B7684'
  ctx.font = font(500, 32)
  ctx.fillText(`${state.manager?.background ?? ''} · ${state.manager?.nationality ?? ''}`, 120, 316)

  // 큰 숫자 3개
  const stats: [string, string, string][] = [
    ['시즌', String(t.seasons), '#191F28'],
    ['우승', String(t.titles), '#D9A441'],
    ['최고 순위', t.bestRank ? `${t.bestRank}위` : '-', '#3B82F6'],
  ]
  stats.forEach(([label, value, color], i) => {
    const x = 120 + i * 300
    ctx.fillStyle = '#6B7684'
    ctx.font = font(500, 28)
    ctx.fillText(label, x, 430)
    ctx.fillStyle = color
    ctx.font = font(800, 96)
    ctx.fillText(value, x, 530)
  })

  ctx.fillStyle = '#E5E8EB'
  ctx.fillRect(120, 580, CARD_W - 240, 2)

  ctx.fillStyle = '#6B7684'
  ctx.font = font(500, 28)
  ctx.fillText('통산 전적', 120, 650)
  ctx.fillStyle = '#191F28'
  ctx.font = font(800, 56)
  ctx.fillText(`${t.w}승 ${t.d}무 ${t.l}패`, 120, 718)

  // 구단 경력
  ctx.fillStyle = '#6B7684'
  ctx.font = font(500, 28)
  ctx.fillText('거쳐 간 구단', 120, 800)
  let y = 830
  for (const c of t.clubs.slice(0, 4)) {
    await drawCrest(ctx, c.clubId, 120, y, 64)
    ctx.fillStyle = '#191F28'
    ctx.font = font(700, 38)
    ctx.textAlign = 'left'
    ctx.fillText(clubById(c.clubId).name, 204, y + 42)
    ctx.fillStyle = '#6B7684'
    ctx.font = font(500, 28)
    ctx.textAlign = 'right'
    ctx.fillText(`${c.seasons}시즌 · 최고 ${c.best}위`, CARD_W - 120, y + 42)
    ctx.textAlign = 'left'
    y += 84
  }

  // 대표 성과
  const bestSeason = [...state.seasons].sort((a, b) => a.rank - b.rank)[0]
  if (bestSeason) {
    ctx.fillStyle = '#FBF3E1'
    roundRect(ctx, 120, CARD_H - 290, CARD_W - 240, 120, 28)
    ctx.fill()
    ctx.fillStyle = '#A9791F'
    ctx.font = font(700, 34)
    ctx.textAlign = 'left'
    ctx.fillText(
      `${bestSeason.season}시즌 ${clubById(bestSeason.clubId).short} ${bestSeason.rank}위 · ${OUTCOME_LABEL[bestSeason.outcome]}`,
      152,
      CARD_H - 218,
    )
  }
  ctx.fillStyle = '#6B7684'
  ctx.font = font(500, 24)
  ctx.textAlign = 'center'
  ctx.fillText('가상의 선수·기사·팬 반응이 포함된 시뮬레이션이에요', CARD_W / 2, CARD_H - 100)

  return canvas.toDataURL('image/png')
}
