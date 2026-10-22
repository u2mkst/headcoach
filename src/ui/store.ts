import { useCallback, useEffect, useRef, useState } from 'react'
import { newGame, SAVE_VERSION } from '../engine/game'
import type { GameState } from '../engine/types'

const KEY = 'headcoach.save.v1'

export function loadSave(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as GameState
    if (s.version !== SAVE_VERSION || !s.clubs || !s.fixtures) return null
    return s
  } catch {
    return null
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* 저장소를 쓸 수 없으면 조용히 넘어간다 */
  }
}

function writeSave(s: GameState): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
    return true
  } catch {
    return false
  }
}

/** 게임 상태 + 자동 저장. 생성 단계(감독 만들기 전)는 저장하지 않는다. */
export function useGame() {
  const [state, setState] = useState<GameState>(() => newGame())
  const [saveFailed, setSaveFailed] = useState(false)
  const timer = useRef<number | undefined>(undefined)

  useEffect(() => {
    if (state.phase === 'create' || !state.manager) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setSaveFailed(!writeSave(state)), 150)
    return () => window.clearTimeout(timer.current)
  }, [state])

  const replace = useCallback((s: GameState) => setState(s), [])
  const reset = useCallback(() => {
    clearSave()
    setState(newGame())
  }, [])
  return { state, replace, reset, saveFailed }
}
