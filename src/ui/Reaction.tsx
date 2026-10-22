import { useState } from 'react'
import type { FeedItem, GameState } from '../engine/types'

type Filter = 'all' | FeedItem['kind']
const KIND_LABEL: Record<FeedItem['kind'], string> = { press: '기자회견', article: '기사', fan: '팬 반응' }

export function ReactionTab({ state }: { state: GameState }) {
  const [filter, setFilter] = useState<Filter>('all')
  const items = [...state.feed].reverse().filter((f) => filter === 'all' || f.kind === filter)
  return (
    <div className="screen">
      <h1 className="screen-title">반응</h1>
      <p className="screen-sub">경기와 선택에 대한 언론·팬의 목소리예요.</p>
      <div className="chips">
        {(['all', 'press', 'article', 'fan'] as Filter[]).map((f) => (
          <button key={f} className="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {f === 'all' ? '전체' : KIND_LABEL[f]}
          </button>
        ))}
      </div>
      <section className="card flush">
        {items.length === 0 && <p className="empty">아직 반응이 없어요. 첫 경기를 치러 보세요.</p>}
        {items.slice(0, 40).map((f) => (
          <article key={f.id} className="feed-item">
            <div className="feed-source">
              <span>{f.source}</span>
              <span>·</span>
              <span>
                {f.season}시즌 {f.round}R
              </span>
              <span className={`tag ${f.kind === 'press' ? 'accent' : ''}`} style={{ height: 20, marginLeft: 'auto' }}>
                {KIND_LABEL[f.kind]}
              </span>
            </div>
            <p className="feed-text">{f.text}</p>
          </article>
        ))}
      </section>
      <p className="notice">가상 반응 · 이 화면의 매체, 기사, 팬 반응은 모두 가상으로 만들어진 내용이에요.</p>
    </div>
  )
}
