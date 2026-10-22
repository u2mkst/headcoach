import { useEffect, useState, type ReactNode } from 'react'
import { clubById } from '../data/clubs'

/* ───────── 아이콘 (24px, 선 아이콘) ───────── */
const PATHS: Record<string, ReactNode> = {
  home: <path d="M4 11.2 12 4l8 7.2V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" />,
  news: (
    <>
      <path d="M5 4h11a2 2 0 0 1 2 2v13a1 1 0 0 0 1 1H7a2 2 0 0 1-2-2z" />
      <path d="M9 8h6M9 12h6M9 16h3" />
    </>
  ),
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M8 3v4M16 3v4M4 10h16" />
    </>
  ),
  squad: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M16 14.6c2.8-.3 4.8 1.5 4.8 4.4" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0z" />
      <path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" />
    </>
  ),
  chevron: <path d="m9 6 6 6-6 6" />,
  back: <path d="m15 6-6 6 6 6" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  ball: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m12 8 3.4 2.5-1.3 4h-4.2l-1.3-4z" />
    </>
  ),
}

export function Icon({ name, className }: { name: keyof typeof PATHS | string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

/* ───────── 엠블럼: 이미지가 없으면 구단 색 방패에 첫 글자 ───────── */
export function Crest({ clubId, size = 40 }: { clubId: string; size?: number }) {
  const club = clubById(clubId)
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [club.crest])
  if (!failed) {
    return (
      <img
        className="crest"
        src={club.crest}
        alt={club.name}
        width={size}
        height={size}
        onError={() => setFailed(true)}
        style={{ objectFit: 'contain' }}
      />
    )
  }
  return (
    <svg className="crest" width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={club.name}>
      <path d="M20 2 36 7v12c0 9-6.5 15.5-16 19C10.5 34.5 4 28 4 19V7z" fill={club.color} />
      <path d="M20 2 36 7v12c0 9-6.5 15.5-16 19C10.5 34.5 4 28 4 19V7z" fill="none" stroke="rgba(255,255,255,.35)" strokeWidth="1.5" />
      <text x="20" y="25.5" textAnchor="middle" fontSize="16" fontWeight="800" fill="#fff" fontFamily="inherit">
        {club.short.charAt(0)}
      </text>
    </svg>
  )
}

/* ───────── 작은 UI 조각 ───────── */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { id: T; label: string; dot?: boolean }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((o) => (
        <button key={o.id} role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
          {o.dot && <span className="dot" style={{ display: 'inline-block', marginLeft: 4, verticalAlign: 'middle' }} />}
        </button>
      ))}
    </div>
  )
}

export function Bar({ value, thin }: { value: number; thin?: boolean }) {
  return (
    <div className={`bar${thin ? ' thin' : ''}`} role="progressbar" aria-valuenow={Math.round(value)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

export function BottomBar({ children }: { children: ReactNode }) {
  return <div className="bottom-bar">{children}</div>
}

export function Sheet({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="sheet" onClick={onClose}>
      <div className="panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2200)
    return () => clearTimeout(t)
  }, [message, onDone])
  return (
    <div className="toast" role="status">
      {message}
    </div>
  )
}

export function FormDots({ results, clubId }: { results: { home: string; away: string; hg: number; ag: number }[]; clubId: string }) {
  const last = results.slice(-5)
  if (!last.length) return <span className="label">아직 경기가 없어요</span>
  return (
    <div className="form-dots" aria-label="최근 경기 결과">
      {last.map((r, i) => {
        const gf = r.home === clubId ? r.hg : r.ag
        const ga = r.home === clubId ? r.ag : r.hg
        const k = gf > ga ? 'w' : gf < ga ? 'l' : 'd'
        return (
          <span key={i} className={k}>
            {k === 'w' ? '승' : k === 'd' ? '무' : '패'}
          </span>
        )
      })}
    </div>
  )
}

/** 대회 로고: 파일이 없으면 아무것도 그리지 않는다 */
export function CompetitionLogo({ src, size = 16 }: { src: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return <img src={src} alt="" width={size} height={size} onError={() => setFailed(true)} style={{ objectFit: 'contain' }} />
}

export const Chevron = () => <Icon name="chevron" className="chev" />

export const pct = (n: number) => `${Math.round(n)}%`
