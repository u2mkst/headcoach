/** 시드 기반 난수. 상태는 숫자 하나라 JSON 저장에 그대로 들어간다. */
export interface Rng {
  next(): number
  int(min: number, max: number): number
  range(min: number, max: number): number
  chance(p: number): boolean
  pick<T>(arr: readonly T[]): T
  weighted<T>(items: readonly T[], weight: (t: T) => number): T
  shuffle<T>(arr: readonly T[]): T[]
  poisson(lambda: number): number
  normal(mean: number, sd: number): number
  /** 현재 시드 상태 (다음 호출에 이어 쓰기 위해) */
  state(): number
}

export function createRng(seed: number): Rng {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const rng: Rng = {
    next,
    int: (min, max) => Math.floor(next() * (max - min + 1)) + min,
    range: (min, max) => next() * (max - min) + min,
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    weighted(items, weight) {
      const total = items.reduce((s, i) => s + Math.max(0, weight(i)), 0)
      if (total <= 0) return items[Math.floor(next() * items.length)]
      let r = next() * total
      for (const i of items) {
        r -= Math.max(0, weight(i))
        if (r <= 0) return i
      }
      return items[items.length - 1]
    },
    shuffle(arr) {
      const out = [...arr]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
    poisson(lambda) {
      const L = Math.exp(-lambda)
      let k = 0
      let p = 1
      do {
        k++
        p *= next()
      } while (p > L && k < 12)
      return k - 1
    },
    normal(mean, sd) {
      const u = Math.max(next(), 1e-9)
      const v = next()
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
    },
    state: () => a,
  }
  return rng
}
