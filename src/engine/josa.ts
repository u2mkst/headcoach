/** 받침 유무에 맞는 조사를 붙인다. 예: josa('강원', '과/와') → '강원과' */
type Pair = '은/는' | '이/가' | '을/를' | '과/와' | '으로/로'

const LATIN_BATCHIM = new Set(['L', 'M', 'N', 'R'])
const DIGIT_BATCHIM = new Set(['0', '1', '3', '6', '7', '8'])

function batchim(word: string): { has: boolean; rieul: boolean } {
  const ch = word.trim().slice(-1)
  const code = ch.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) {
    const jong = (code - 0xac00) % 28
    return { has: jong !== 0, rieul: jong === 8 }
  }
  if (/[A-Za-z]/.test(ch)) return { has: LATIN_BATCHIM.has(ch.toUpperCase()), rieul: ch.toUpperCase() === 'L' || ch.toUpperCase() === 'R' }
  if (/[0-9]/.test(ch)) return { has: DIGIT_BATCHIM.has(ch), rieul: ch === '8' }
  return { has: false, rieul: false }
}

/** '~이에요/예요' 처럼 받침에 따라 달라지는 서술격 어미 */
export function copula(word: string | number): string {
  return String(word) + (batchim(String(word)).has ? '이에요' : '예요')
}

export function josa(word: string | number, pair: Pair): string {
  const w = String(word)
  const { has, rieul } = batchim(w)
  const [withB, withoutB] = pair.split('/')
  if (pair === '으로/로') return w + (has && !rieul ? withB : withoutB)
  return w + (has ? withB : withoutB)
}
