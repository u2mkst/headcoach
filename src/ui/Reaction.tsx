import { useState } from 'react'
import { MONTH_LABEL, MONTH_ROUNDS } from '../engine/season'
import type { FeedItem, GameState } from '../engine/types'
import { Bar } from './components'
import { Delta } from './Home'

type Filter = 'all' | FeedItem['kind']
const FILTER_LABEL: Record<Filter, string> = { all: '전체', fan: '커뮤니티', article: '기사', press: '기자회견' }
const MOOD_DOT = { good: 'var(--accent)', bad: 'var(--muted)', neutral: 'var(--line)' } as const

export function ReactionTab({ state }: { state: GameState }) {
  const [filter, setFilter] = useState<Filter>('all')
  const items = [...state.feed].reverse().filter((f) => filter === 'all' || f.kind === filter)
  const fan = state.fan
  const rep = state.monthReport && state.monthReport.season === state.season ? state.monthReport : null
  return (
    <div className="screen">
      <h1 className="screen-title">반응</h1>
      <p className="screen-sub">결과와 선택에 대한 팬·언론의 목소리예요.</p>

      <section className="card stack" aria-label="팬 지지도">
        <div className="row between" style={{ alignItems: 'flex-end' }}>
          <div className="col">
            <span className="label">감독 지지도</span>
            <span className="big tnum">{Math.round(fan.support)}%</span>
          </div>
          {rep && (
            <b className="tnum">
              지난달 <Delta v={fan.support - rep.fanBefore.support} />
            </b>
          )}
        </div>
        <Bar value={fan.support} />
        <div className="row between">
          <span className="label">성적 만족 {Math.round(fan.results)}%</span>
          <span className="label">스타일 만족 {Math.round(fan.style)}%</span>
        </div>
      </section>

      <div className="chips">
        {(Object.keys(FILTER_LABEL) as Filter[]).map((f) => (
          <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {FILTER_LABEL[f]}
          </button>
        ))}
      </div>

      <section className="card flush">
        {items.length === 0 && <p className="empty">아직 반응이 없어요. 첫 달을 진행해 보세요.</p>}
        {items.slice(0, 50).map((f) => (
          <article key={f.id} className="feed-item">
            <div className="feed-source">
              {f.kind === 'fan' && f.mood && <span style={{ width: 8, height: 8, borderRadius: '50%', background: MOOD_DOT[f.mood] }} aria-hidden="true" />}
              <span>{f.source}</span>
              <span>·</span>
              <span>
                {f.season}시즌 {MONTH_LABEL[Math.max(0, Math.ceil(f.round / MONTH_ROUNDS) - 1)]}
              </span>
              <span className={`tag ${f.kind === 'press' ? 'accent' : ''}`} style={{ height: 20, marginLeft: 'auto' }}>
                {f.kind === 'fan' ? f.topic : FILTER_LABEL[f.kind]}
              </span>
            </div>
            <p className="feed-text">{f.text}</p>
            {f.kind === 'fan' && f.likes !== undefined && <span className="label">♥ {f.likes}</span>}
          </article>
        ))}
      </section>
      <p className="notice">가상 반응 · 이 화면의 매체, 기사, 팬 커뮤니티 글은 모두 가상으로 만들어진 내용이에요.</p>
    </div>
  )
}
