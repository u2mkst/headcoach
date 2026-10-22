import { useEffect, useState } from 'react'
import { clubById } from '../data/clubs'
import { OUTCOME_LABEL } from '../engine/career'
import { retireManager } from '../engine/game'
import type { Difficulty, GameState } from '../engine/types'
import { Bar, Crest, Icon, Segmented, Sheet } from './components'
import { ABILITY_INFO } from './Onboarding'
import { careerTotals, renderShareCard } from './shareCard'

type Sub = 'honors' | 'clubs' | 'timeline' | 'settings'

export function RecordsTab({
  state,
  onChange,
  onReset,
  saveFailed,
}: {
  state: GameState
  onChange: (s: GameState) => void
  onReset: () => void
  saveFailed: boolean
}) {
  const [sub, setSub] = useState<Sub>('honors')
  const [confirm, setConfirm] = useState<'retire' | 'reset' | null>(null)
  const totals = careerTotals(state)
  const mgr = state.manager

  return (
    <div className="screen">
      <h1 className="screen-title">기록</h1>
      <Segmented
        value={sub}
        onChange={setSub}
        options={[
          { id: 'honors', label: '성과' },
          { id: 'clubs', label: '구단별' },
          { id: 'timeline', label: '타임라인' },
          { id: 'settings', label: '설정' },
        ]}
      />

      {sub === 'honors' && (
        <>
          {mgr && (
            <section className="card stack">
              <div className="row between">
                <div>
                  <div className="card-title">{mgr.name} 감독</div>
                  <div className="label">
                    {mgr.background} · {mgr.nationality}
                  </div>
                </div>
                <span className="tag">명성 {Math.round(mgr.reputation)}</span>
              </div>
              {ABILITY_INFO.map((a) => (
                <div key={a.key} className="row">
                  <span className="label" style={{ width: 48 }}>
                    {a.label}
                  </span>
                  <div className="grow">
                    <Bar value={mgr.abilities[a.key] * 10} thin />
                  </div>
                  <b className="tnum" style={{ width: 20, textAlign: 'right' }}>
                    {mgr.abilities[a.key]}
                  </b>
                </div>
              ))}
            </section>
          )}
          <section className="card row" style={{ justifyContent: 'space-around', textAlign: 'center' }}>
            <div className="col">
              <span className="label">시즌</span>
              <span className="big">{totals.seasons}</span>
            </div>
            <div className="col">
              <span className="label">우승</span>
              <span className="big trophy">{totals.titles}</span>
            </div>
            <div className="col">
              <span className="label">통산</span>
              <b className="tnum">
                {totals.w}승 {totals.d}무 {totals.l}패
              </b>
            </div>
          </section>
          {state.seasons.length === 0 && <p className="empty card">첫 시즌을 마치면 성과가 이곳에 쌓여요</p>}
          {[...state.seasons].reverse().map((s) => (
            <section key={s.season} className="card stack">
              <div className="row">
                {s.outcome === 'champion' ? <Icon name="trophy" className="trophy" /> : <Crest clubId={s.clubId} size={32} />}
                <div className="grow">
                  <div className="card-title">
                    {s.season}시즌 · {clubById(s.clubId).short}
                  </div>
                  <div className="label">
                    {s.rank}위 · {s.w}승 {s.d}무 {s.l}패 · 승점 {s.points}
                  </div>
                </div>
                <span className={`tag ${s.outcome === 'champion' ? 'gold' : s.outcome === 'failed' || s.outcome === 'fell_short' ? '' : 'accent'}`}>
                  {OUTCOME_LABEL[s.outcome]}
                </span>
              </div>
              {s.achievements.length > 0 && (
                <div className="chips">
                  {s.achievements.map((a) => (
                    <span key={a} className="tag gold">
                      {a}
                    </span>
                  ))}
                </div>
              )}
            </section>
          ))}
        </>
      )}

      {sub === 'clubs' && (
        <section className="card flush">
          {totals.clubs.length === 0 && <p className="empty">아직 기록된 구단이 없어요</p>}
          {totals.clubs.map((c) => {
            const rows = state.seasons.filter((s) => s.clubId === c.clubId)
            const w = rows.reduce((a, s) => a + s.w, 0)
            const d = rows.reduce((a, s) => a + s.d, 0)
            const l = rows.reduce((a, s) => a + s.l, 0)
            const gf = rows.reduce((a, s) => a + s.gf, 0)
            return (
              <details key={c.clubId} className="accordion">
                <summary className="item">
                  <Crest clubId={c.clubId} size={36} />
                  <div className="grow">
                    <div style={{ fontWeight: 700 }}>{clubById(c.clubId).name}</div>
                    <div className="label">
                      {c.seasons}시즌 · 최고 {c.best}위
                    </div>
                  </div>
                  <Icon name="chevron" className="chev" />
                </summary>
                <div className="stack" style={{ padding: '0 20px 16px' }}>
                  <div className="row between">
                    <span className="label">전적</span>
                    <b>
                      {w}승 {d}무 {l}패
                    </b>
                  </div>
                  <div className="row between">
                    <span className="label">득점</span>
                    <b>{gf}골</b>
                  </div>
                  {rows.map((s) => (
                    <div key={s.season} className="row between">
                      <span className="label">{s.season}시즌</span>
                      <b>
                        {s.rank}위 · {OUTCOME_LABEL[s.outcome]}
                      </b>
                    </div>
                  ))}
                </div>
              </details>
            )
          })}
        </section>
      )}

      {sub === 'timeline' && (
        <section className="card flush">
          {state.timeline.length === 0 && <p className="empty">아직 기록이 없어요</p>}
          {[...state.timeline]
            .reverse()
            .slice(0, 80)
            .map((t) => (
              <div key={t.id} className="item" style={{ alignItems: 'flex-start' }}>
                <span className="label tnum" style={{ width: 54, flex: 'none' }}>
                  {t.season}시즌{t.round > 0 && <br />}
                  {t.round > 0 ? `${t.round}R` : ''}
                </span>
                <span className={t.kind === 'season' || t.kind === 'career' ? 'grow' : 'grow'} style={{ fontWeight: t.kind === 'season' || t.kind === 'career' ? 700 : 500 }}>
                  {t.text}
                </span>
              </div>
            ))}
        </section>
      )}

      {sub === 'settings' && (
        <>
          <section className="card stack">
            <h2 className="card-title">난이도</h2>
            <div className="chips">
              {(
                [
                  ['easy', '쉬움'],
                  ['normal', '보통'],
                  ['hard', '어려움'],
                ] as [Difficulty, string][]
              ).map(([id, label]) => (
                <button key={id} className="chip" aria-pressed={state.difficulty === id} onClick={() => onChange({ ...state, difficulty: id })}>
                  {label}
                </button>
              ))}
            </div>
            <span className="label">바꾸면 다음 경기부터 적용돼요. 쉬움은 내 팀 전력이 조금 오르고, 어려움은 상대 전력이 조금 올라요.</span>
          </section>
          <section className="card stack">
            <h2 className="card-title">저장</h2>
            <p className="label">진행 상황은 이 기기에 자동으로 저장돼요.</p>
            {saveFailed && <span className="tag alert">저장에 실패했어요. 브라우저 저장 공간을 확인해 주세요.</span>}
          </section>
          <section className="card stack">
            <h2 className="card-title">커리어 마무리</h2>
            <p className="label">은퇴하면 지금까지의 기록을 공유용 카드로 만들어 드려요.</p>
            <button className="btn secondary block" disabled={state.seasons.length === 0} onClick={() => setConfirm('retire')}>
              감독직에서 은퇴하기
            </button>
            <button className="btn ghost block" onClick={() => setConfirm('reset')}>
              새 게임 시작
            </button>
          </section>
        </>
      )}

      {confirm && (
        <Sheet onClose={() => setConfirm(null)}>
          <h2 className="card-title">{confirm === 'retire' ? '정말 은퇴할까요?' : '새로 시작할까요?'}</h2>
          <p className="label">
            {confirm === 'retire'
              ? '은퇴하면 더 이상 경기를 진행할 수 없고, 커리어 카드가 만들어져요.'
              : '지금까지의 저장 데이터가 모두 지워져요. 되돌릴 수 없어요.'}
          </p>
          <div className="row">
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setConfirm(null)}>
              취소
            </button>
            <button
              className="btn primary"
              style={{ flex: 1 }}
              onClick={() => {
                if (confirm === 'retire') onChange(retireManager(state))
                else onReset()
                setConfirm(null)
              }}
            >
              {confirm === 'retire' ? '은퇴하기' : '지우고 시작'}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  )
}

export function RetiredScreen({ state, onReset }: { state: GameState; onReset: () => void }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    renderShareCard(state).then((u) => alive && setUrl(u))
    return () => {
      alive = false
    }
  }, [state])
  const save = () => {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.download = `벤치에서-명장까지-${state.manager?.name ?? '감독'}.png`
    a.click()
  }
  return (
    <div className="onboard">
      <h1 className="question">{'멋진 커리어였어요'}</h1>
      <p className="hint">공유용 카드를 저장해 보세요.</p>
      {url ? (
        <img src={url} alt="커리어 공유 카드" style={{ width: '100%', height: 'auto', borderRadius: 24, background: '#fff' }} width={1080} height={1350} />
      ) : (
        <p className="empty">카드를 그리고 있어요…</p>
      )}
      <div className="bottom-bar">
        <button className="btn ghost" onClick={onReset}>
          새 게임
        </button>
        <button className="btn primary" disabled={!url} onClick={save}>
          이미지 저장
        </button>
      </div>
    </div>
  )
}
