import { useCallback, useMemo, useRef, useState } from 'react'
import { chooseEvent, dismissReport, playRound, type RoundReport } from '../engine/game'
import type { EventOutcome, GameState } from '../engine/types'
import { Home } from './Home'
import { Icon, Toast } from './components'
import { Onboarding } from './Onboarding'
import { EventResultScreen, EventScreen, Progress, ResultScreen } from './Overlays'
import { ReactionTab } from './Reaction'
import { RecordsTab, RetiredScreen } from './Records'
import { SeasonEnd } from './SeasonEnd'
import { SeasonTab } from './SeasonTab'
import { SquadTab } from './SquadTab'
import { loadSave, useGame } from './store'

export type TabId = 'home' | 'reaction' | 'season' | 'squad' | 'records'

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'home', label: '홈', icon: 'home' },
  { id: 'reaction', label: '반응', icon: 'news' },
  { id: 'season', label: '시즌', icon: 'calendar' },
  { id: 'squad', label: '선수단', icon: 'squad' },
  { id: 'records', label: '기록', icon: 'trophy' },
]

type Overlay =
  | { kind: 'progress'; next: GameState; report: RoundReport }
  | { kind: 'result' }
  | { kind: 'event'; uid: string }
  | { kind: 'eventResult'; outcome: EventOutcome }
  | null

export function App() {
  const saved = useMemo(() => loadSave(), [])
  const { state, replace, reset, saveFailed } = useGame()
  const [splash, setSplash] = useState(!!saved)
  const [tab, setTab] = useState<TabId>('home')
  const [overlay, setOverlay] = useState<Overlay>(null)
  const [toast, setToast] = useState<string | null>(null)
  /** 이미 보여줬거나 "나중에"로 미뤄 둔 이벤트는 자동으로 다시 열지 않는다 */
  const seen = useRef(new Set<string>())
  const clearToast = useCallback(() => setToast(null), [])

  const changeTab = (t: TabId) => {
    setTab(t)
    window.scrollTo({ top: 0 })
  }

  if (splash && saved) {
    return (
      <div className="app">
        <div className="splash">
          <h1 className="question">{'벤치에서\n명장까지'}</h1>
          <p className="hint">
            {saved.manager?.name} 감독 · {saved.season}시즌 {saved.round}라운드 저장 데이터가 있어요.
          </p>
          <div className="stack">
            <button
              className="btn primary block"
              onClick={() => {
                replace(saved)
                setSplash(false)
              }}
            >
              이어하기
            </button>
            <button
              className="btn ghost block"
              onClick={() => {
                reset()
                setSplash(false)
              }}
            >
              새로 시작
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (state.retired) {
    return (
      <div className="app">
        <RetiredScreen state={state} onReset={reset} />
      </div>
    )
  }

  if (state.phase !== 'play' && state.phase !== 'seasonEnd') {
    return (
      <div className="app">
        <Onboarding state={state} onChange={replace} />
      </div>
    )
  }

  const nextNewEvent = (s: GameState) => s.events.find((e) => e.createdRound === s.round && !seen.current.has(e.uid))

  const afterEvents = (s: GameState) => {
    const ev = nextNewEvent(s)
    if (ev) {
      seen.current.add(ev.uid)
      setOverlay({ kind: 'event', uid: ev.uid })
    } else setOverlay(null)
  }

  const play = () => {
    try {
      const [next, report] = playRound(state)
      setOverlay({ kind: 'progress', next, report })
    } catch (e) {
      setToast(e instanceof Error ? e.message : '경기를 진행하지 못했어요')
    }
  }

  const openEventOverlay = overlay?.kind === 'event' ? state.events.find((e) => e.uid === overlay.uid) : undefined

  return (
    <div className="app">
      {state.phase === 'seasonEnd' && !overlay ? (
        <SeasonEnd state={state} onChange={replace} />
      ) : (
        <>
          {tab === 'home' && (
            <Home
              state={state}
              onPlay={play}
              onGo={changeTab}
              onOpenEvent={(uid) => setOverlay({ kind: 'event', uid })}
              onDismissReport={() => replace(dismissReport(state))}
            />
          )}
          {tab === 'reaction' && <ReactionTab state={state} />}
          {tab === 'season' && <SeasonTab state={state} />}
          {tab === 'squad' && <SquadTab state={state} onChange={replace} toast={setToast} />}
          {tab === 'records' && <RecordsTab state={state} onChange={replace} onReset={reset} saveFailed={saveFailed} />}

          <nav className="tabbar" role="tablist" aria-label="메인 메뉴">
            {TABS.map((t) => (
              <button key={t.id} className="tab" role="tab" aria-selected={tab === t.id} onClick={() => changeTab(t.id)}>
                <Icon name={t.icon} />
                {t.label}
                {t.id === 'home' && state.events.length > 0 && <span className="dot" aria-label="확인할 일 있음" />}
              </button>
            ))}
          </nav>
        </>
      )}

      {overlay?.kind === 'progress' && (
        <Progress
          onDone={() => {
            replace(overlay.next)
            setOverlay({ kind: 'result' })
          }}
        />
      )}
      {overlay?.kind === 'result' && (
        <ResultScreen
          state={state}
          onContinue={() => {
            if (state.phase === 'seasonEnd') setOverlay(null)
            else afterEvents(state)
          }}
        />
      )}
      {overlay?.kind === 'event' && openEventOverlay && (
        <EventScreen
          event={openEventOverlay}
          onLater={() => {
            seen.current.add(openEventOverlay.uid)
            afterEvents(state)
          }}
          onChoose={(choiceId) => {
            const [next, outcome] = chooseEvent(state, openEventOverlay.uid, choiceId)
            replace(next)
            setOverlay({ kind: 'eventResult', outcome })
          }}
        />
      )}
      {overlay?.kind === 'event' && !openEventOverlay && <EventGone onClose={() => afterEvents(state)} />}
      {overlay?.kind === 'eventResult' && <EventResultScreen outcome={overlay.outcome} onContinue={() => afterEvents(state)} />}

      {toast && <Toast message={toast} onDone={clearToast} />}
    </div>
  )
}

/** 이미 처리됐거나 기한이 지난 이벤트를 열었을 때 */
function EventGone({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay center">
      <div className="inner" style={{ justifyContent: 'center', gap: 16 }}>
        <p className="status-line">이미 정리된 일이에요</p>
        <button className="btn primary" onClick={onClose}>
          돌아가기
        </button>
      </div>
    </div>
  )
}
