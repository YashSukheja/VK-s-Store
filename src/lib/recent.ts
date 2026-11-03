/** The products a shopper opened most recently, newest first, kept on the phone. */
const KEY = 'vrack-recent'
const MAX = 10

export function recentIds(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string').slice(0, MAX) : []
  } catch {
    return []
  }
}

export function rememberViewed(id: string) {
  try {
    localStorage.setItem(KEY, JSON.stringify([id, ...recentIds().filter((x) => x !== id)].slice(0, MAX)))
  } catch {
    // Private mode: nothing is remembered.
  }
}
